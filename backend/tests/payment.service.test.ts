import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Prisma, StatutPaiementAfribaPay } from '@prisma/client';
import prisma from '../src/lib/prisma.js';
import * as afribapayService from '../src/services/afribapay.service.js';
import * as paymentService from '../src/services/payment.service.js';

vi.mock('../src/lib/prisma', () => {
  return {
    default: {
      acheteur: {
        findUnique: vi.fn(),
      },
      transactionAcheteur: {
        findFirst: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      prefinancement: {
        findFirst: vi.fn(),
        updateMany: vi.fn(),
      },
      paiementAfribaPay: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(),
      $queryRaw: vi.fn(),
    },
  };
});

vi.mock('../src/services/afribapay.service', () => {
  return {
    listPaymentMethods: vi.fn(),
    initiatePayin: vi.fn(),
    requestPayinOtp: vi.fn(),
    getPayinStatus: vi.fn(),
  };
});

describe('Payment Service — BigInt IDs, Server-Side Amounts, Idempotency & Webhooks', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      AFRIBAPAY_ENABLED: 'true',
      PAYMENT_OTP_FINGERPRINT_SECRET: 'test_secret_for_otp_fingerprint_min_32_chars_123',
      AFRIBAPAY_WEBHOOK_SECRET: 'test_webhook_shared_secret_abc123',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('BigInt Helper', () => {
    it('parses valid positive BigInt representations', () => {
      expect(paymentService.parsePositiveBigInt('42', 'ID')).toBe(42n);
      expect(paymentService.parsePositiveBigInt(100n, 'ID')).toBe(100n);
    });

    it('rejects invalid or negative BigInt strings', () => {
      expect(() => paymentService.parsePositiveBigInt('-5', 'ID')).toThrow('ID invalide');
      expect(() => paymentService.parsePositiveBigInt('abc', 'ID')).toThrow('ID invalide');
      expect(() => paymentService.parsePositiveBigInt('0', 'ID')).toThrow('ID invalide');
    });
  });

  describe('Payment Initiation', () => {
    it('initiates a payment for an order with server-calculated price', async () => {
      (prisma.acheteur.findUnique as any).mockResolvedValue({
        id: 10n,
        phoneVerified: true,
      });

      (afribapayService.listPaymentMethods as any).mockResolvedValue([
        {
          countryCode: 'CM',
          currency: 'XAF',
          prefix: '237',
          operators: [{ code: 'mtn', name: 'MTN', requiresOtp: false }],
        },
      ]);

      const mockPaymentRecord = {
        id: 1n,
        acheteurId: 10n,
        transactionAcheteurId: 50n,
        prefinancementId: null,
        idempotencyKey: null,
        requestFingerprint: null,
        orderId: 'sitcha-test-order',
        providerTransactionId: null,
        providerLink: null,
        type: 'ORDER',
        montant: new Prisma.Decimal('10000'),
        tauxMargeBrute: new Prisma.Decimal('10.00'),
        fraisAfribaPay: null,
        montantMargeBrute: null,
        margeReelleSitcha: null,
        montantBaseRedistribution: null,
        devise: 'XAF',
        pays: 'CM',
        operateur: 'mtn',
        telephoneSuffixe: '1234',
        statut: StatutPaiementAfribaPay.PENDING,
        dateCreation: new Date(),
        dateMaj: new Date(),
      };

      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        const tx = {
          $queryRaw: vi.fn(),
          paiementAfribaPay: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockPaymentRecord),
          },
          transactionAcheteur: {
            findFirst: vi.fn().mockResolvedValue({
              id: 50n,
              acheteurId: 10n,
              quantite: new Prisma.Decimal('10'),
              prixConvenu: new Prisma.Decimal('1000'),
              statut: 'en_attente',
              recolteOffre: { quantiteDisponible: new Prisma.Decimal('100') },
            }),
            update: vi.fn(),
          },
        };
        return callback(tx);
      });

      (afribapayService.initiatePayin as any).mockResolvedValue({
        transactionId: 'afp-tx-999',
        status: 'PENDING',
        providerFee: '100.00',
        providerLink: null,
      });

      (prisma.paiementAfribaPay.update as any).mockResolvedValue({
        ...mockPaymentRecord,
        providerTransactionId: 'afp-tx-999',
        fraisAfribaPay: new Prisma.Decimal('100.00'),
      });

      const result = await paymentService.initiatePayment('10', {
        resourceType: 'ORDER',
        resourceId: '50',
        countryCode: 'CM',
        operator: 'mtn',
        phoneNumber: '670001234',
      });

      expect(result.reused).toBe(false);
      expect(result.payment.id).toBe('1');
      expect(result.payment.amount).toBe('10000');
      expect(result.payment.providerTransactionId).toBe('afp-tx-999');
    });

    it('returns existing active payment idempotently without calling provider again', async () => {
      (prisma.acheteur.findUnique as any).mockResolvedValue({
        id: 10n,
        phoneVerified: true,
      });

      (afribapayService.listPaymentMethods as any).mockResolvedValue([
        {
          countryCode: 'CM',
          currency: 'XAF',
          prefix: '237',
          operators: [{ code: 'mtn', name: 'MTN', requiresOtp: false }],
        },
      ]);

      const existingPayment = {
        id: 1n,
        acheteurId: 10n,
        transactionAcheteurId: 50n,
        prefinancementId: null,
        orderId: 'sitcha-existing',
        providerTransactionId: 'afp-tx-123',
        providerLink: null,
        type: 'ORDER',
        montant: new Prisma.Decimal('10000'),
        tauxMargeBrute: new Prisma.Decimal('10.00'),
        fraisAfribaPay: new Prisma.Decimal('100.00'),
        devise: 'XAF',
        pays: 'CM',
        operateur: 'mtn',
        telephoneSuffixe: '1234',
        statut: StatutPaiementAfribaPay.PENDING,
        dateCreation: new Date(),
        dateMaj: new Date(),
      };

      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        const tx = {
          $queryRaw: vi.fn(),
          paiementAfribaPay: {
            findFirst: vi.fn().mockResolvedValue(existingPayment),
          },
        };
        return callback(tx);
      });

      const result = await paymentService.initiatePayment('10', {
        resourceType: 'ORDER',
        resourceId: '50',
        countryCode: 'CM',
        operator: 'mtn',
        phoneNumber: '670001234',
      });

      expect(result.reused).toBe(true);
      expect(result.payment.id).toBe('1');
      expect(afribapayService.initiatePayin).not.toHaveBeenCalled();
    });
  });

  describe('Webhook Processing', () => {
    it('rejects webhook if secret header does not match configured secret', async () => {
      await expect(
        paymentService.handleAfribaPayWebhook({ order_id: 'sitcha-1' }, 'wrong_secret'),
      ).rejects.toThrow('Authentification webhook invalide');
    });

    it('returns alreadyProcessed if payment is already in SUCCESS state', async () => {
      (prisma.paiementAfribaPay.findUnique as any).mockResolvedValue({
        id: 1n,
        orderId: 'sitcha-1',
        statut: StatutPaiementAfribaPay.SUCCESS,
      });

      const result = await paymentService.handleAfribaPayWebhook(
        { order_id: 'sitcha-1' },
        'test_webhook_shared_secret_abc123',
      );

      expect(result.received).toBe(true);
      expect(result.alreadyProcessed).toBe(true);
      expect(result.status).toBe(StatutPaiementAfribaPay.SUCCESS);
      expect(afribapayService.getPayinStatus).not.toHaveBeenCalled();
    });

    it('re-verifies status with AfribaPay and transitions to SUCCESS atomically', async () => {
      const pendingPayment = {
        id: 5n,
        orderId: 'sitcha-5',
        transactionAcheteurId: 20n,
        montant: new Prisma.Decimal('20000'),
        tauxMargeBrute: new Prisma.Decimal('10.00'),
        fraisAfribaPay: null,
        providerTransactionId: 'afp-tx-5',
        statut: StatutPaiementAfribaPay.PENDING,
      };

      (prisma.paiementAfribaPay.findUnique as any).mockResolvedValue(pendingPayment);

      (afribapayService.getPayinStatus as any).mockResolvedValue({
        transactionId: 'afp-tx-5',
        status: 'SUCCESS',
        providerFee: '200.00',
      });

      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        const tx = {
          paiementAfribaPay: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          transactionAcheteur: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
        };
        return callback(tx);
      });

      (prisma.paiementAfribaPay.findUniqueOrThrow as any).mockResolvedValue({
        ...pendingPayment,
        statut: StatutPaiementAfribaPay.SUCCESS,
      });

      const result = await paymentService.handleAfribaPayWebhook(
        { order_id: 'sitcha-5' },
        'test_webhook_shared_secret_abc123',
      );

      expect(result.received).toBe(true);
      expect(result.alreadyProcessed).toBe(false);
      expect(result.status).toBe(StatutPaiementAfribaPay.SUCCESS);
      expect(afribapayService.getPayinStatus).toHaveBeenCalledWith('sitcha-5', 'afp-tx-5');
    });
  });
});
