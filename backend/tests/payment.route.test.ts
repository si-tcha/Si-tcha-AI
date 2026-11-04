import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import * as paymentService from '../src/services/payment.service.js';
import { getJwtSecret } from '../src/middlewares/auth.js';

vi.mock('../src/lib/prisma', () => {
  return {
    default: {
      acheteur: {
        findUnique: vi.fn(),
      },
      agriculteur: {
        findUnique: vi.fn(),
      },
      paiementAfribaPay: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
    },
  };
});

vi.mock('../src/services/payment.service', () => {
  return {
    getAvailablePaymentMethods: vi.fn(),
    findPaymentForResource: vi.fn(),
    initiatePayment: vi.fn(),
    confirmPaymentWithOtp: vi.fn(),
    getPaymentStatus: vi.fn(),
    handleAfribaPayWebhook: vi.fn(),
  };
});

describe('Payment API Routes — Auth Guards, Endpoints & Webhook', () => {
  const secret = getJwtSecret();

  const buyerToken = jwt.sign(
    { id: '100', role: 'buyer', phone: '+237699111111', nom: 'Buyer Test' },
    secret,
    { expiresIn: '1h' },
  );

  const sellerToken = jwt.sign(
    { id: '200', role: 'seller', phone: '+237677222222', nom: 'Seller Test' },
    secret,
    { expiresIn: '1h' },
  );

  beforeEach(() => {
    vi.clearAllMocks();

    (prisma.acheteur.findUnique as any).mockResolvedValue({
      id: 100n,
      nomEntreprise: 'Test Entreprise',
      contact: '+237699111111',
      phoneVerified: true,
      isVerified: true,
    });

    (prisma.agriculteur.findUnique as any).mockResolvedValue({
      id: 200n,
      nom: 'Test Agriculteur',
      contact: '+237677222222',
      phoneVerified: true,
      isVerified: true,
      statut: 'APPROUVE',
      gicId: 1n,
      estLeader: false,
    });
  });

  describe('Authorization Guards', () => {
    it('returns 401 when no token is provided for protected route', async () => {
      const res = await request(app).get('/api/payments/methods');
      expect(res.status).toBe(401);
    });

    it('returns 403 when a non-buyer attempts to access payment routes', async () => {
      const res = await request(app)
        .get('/api/payments/methods')
        .set('Authorization', `Bearer ${sellerToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/payments/methods', () => {
    it('returns available payment methods for buyer', async () => {
      (paymentService.getAvailablePaymentMethods as any).mockResolvedValue([
        { countryCode: 'CM', currency: 'XAF', operators: [] },
      ]);

      const res = await request(app)
        .get('/api/payments/methods?countryCode=CM')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.countries).toHaveLength(1);
      expect(paymentService.getAvailablePaymentMethods).toHaveBeenCalledWith('CM');
    });
  });

  describe('POST /api/payments', () => {
    it('initiates payment successfully', async () => {
      (paymentService.initiatePayment as any).mockResolvedValue({
        payment: { id: '1', status: 'PENDING' },
        reused: false,
      });

      const res = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          resourceType: 'ORDER',
          resourceId: '42',
          countryCode: 'CM',
          operator: 'mtn',
          phoneNumber: '670000000',
        });

      expect(res.status).toBe(202);
      expect(res.body.payment.id).toBe('1');
    });

    it('returns 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          resourceType: 'ORDER',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/payments/webhook', () => {
    it('processes webhook notification successfully without authentication token', async () => {
      (paymentService.handleAfribaPayWebhook as any).mockResolvedValue({
        received: true,
        status: 'SUCCESS',
      });

      const res = await request(app)
        .post('/api/payments/webhook')
        .set('X-Afribapay-Signature', 'valid_sig')
        .send({
          order_id: 'sitcha-order-99',
          status: 'SUCCESS',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SUCCESS');
      expect(paymentService.handleAfribaPayWebhook).toHaveBeenCalled();
    });

    it('processes base64-encoded afp_data webhook payload', async () => {
      (paymentService.handleAfribaPayWebhook as any).mockResolvedValue({
        received: true,
        status: 'SUCCESS',
      });

      const rawJson = JSON.stringify({ order_id: 'sitcha-order-100', status: 'SUCCESS' });
      const base64Data = Buffer.from(rawJson).toString('base64');

      const res = await request(app)
        .post('/api/payments/webhook')
        .send({ afp_data: base64Data });

      expect(res.status).toBe(200);
      expect(paymentService.handleAfribaPayWebhook).toHaveBeenCalledWith(
        { order_id: 'sitcha-order-100', status: 'SUCCESS' },
        undefined,
      );
    });
  });
});
