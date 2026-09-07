import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { defaultOtpProvider } from '../src/services/otpProvider.js';

vi.mock('../src/lib/prisma', () => {
  return {
    default: {
      acheteur: {
        findUnique: vi.fn(),
      },
      agriculteur: {
        findUnique: vi.fn(),
      },
      otpCode: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
});

describe('POST /api/auth/resend-otp Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.acheteur.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.otpCode.upsert).mockResolvedValue({} as any);
  });

  it('should return 400 if role is invalid', async () => {
    const res = await request(app)
      .post('/api/auth/resend-otp')
      .send({ phone: '699112233', role: 'invalid_role' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Erreur de validation|Rôle requis/i);
    expect(prisma.otpCode.upsert).not.toHaveBeenCalled();
  });

  it('should return 400 if phone is invalid', async () => {
    const res = await request(app)
      .post('/api/auth/resend-otp')
      .send({ phone: '123', role: 'buyer' });

    expect(res.status).toBe(400);
    expect(prisma.otpCode.upsert).not.toHaveBeenCalled();
  });

  it('should return 409 when phone number is ambiguous (both buyer and seller exist)', async () => {
    vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
      id: BigInt(1),
      contact: '+237699112233',
      phoneVerified: false,
    } as any);
    vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue({
      id: BigInt(2),
      contact: '+237699112233',
      phoneVerified: false,
    } as any);

    const res = await request(app)
      .post('/api/auth/resend-otp')
      .send({ phone: '699112233', role: 'buyer' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/Conflit d'identité/i);
    expect(prisma.otpCode.upsert).not.toHaveBeenCalled();
  });

  it('should return 404 when requested account does not exist', async () => {
    vi.mocked(prisma.acheteur.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/resend-otp')
      .send({ phone: '699112233', role: 'buyer' });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Compte acheteur introuvable/i);
    expect(prisma.otpCode.upsert).not.toHaveBeenCalled();
  });

  it('should return 400 if requested buyer account is already verified', async () => {
    vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
      id: BigInt(1),
      contact: '+237699112233',
      phoneVerified: true,
      isVerified: true,
    } as any);

    const res = await request(app)
      .post('/api/auth/resend-otp')
      .send({ phone: '699112233', role: 'buyer' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/déjà vérifié/i);
    expect(prisma.otpCode.upsert).not.toHaveBeenCalled();
  });

  it('should return 400 if requested seller account is already verified', async () => {
    vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue({
      id: BigInt(2),
      contact: '+237677223344',
      phoneVerified: true,
      isVerified: true,
    } as any);

    const res = await request(app)
      .post('/api/auth/resend-otp')
      .send({ phone: '677223344', role: 'seller' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/déjà vérifié/i);
    expect(prisma.otpCode.upsert).not.toHaveBeenCalled();
  });

  it('should return 503 before DB write if OTP_PROVIDER=disabled', async () => {
    const originalProvider = process.env.OTP_PROVIDER;
    process.env.OTP_PROVIDER = 'disabled';

    vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
      id: BigInt(1),
      contact: '+237699112233',
      phoneVerified: false,
    } as any);

    const res = await request(app)
      .post('/api/auth/resend-otp')
      .send({ phone: '699112233', role: 'buyer' });

    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/service SMS est désactivé/i);
    expect(prisma.otpCode.upsert).not.toHaveBeenCalled();

    process.env.OTP_PROVIDER = originalProvider;
  });

  it('should return 503 if SMS provider fails to send message', async () => {
    vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
      id: BigInt(1),
      contact: '+237699112233',
      phoneVerified: false,
    } as any);

    const sendSpy = vi.spyOn(defaultOtpProvider, 'sendSms').mockResolvedValueOnce({
      success: false,
      message: 'Provider down',
      provider: 'test',
      error: 'Network timeout',
    });

    const res = await request(app)
      .post('/api/auth/resend-otp')
      .send({ phone: '699112233', role: 'buyer' });

    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/service SMS est indisponible/i);

    sendSpy.mockRestore();
  });

  it('should successfully resend OTP with 200 without emitting JWT', async () => {
    vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
      id: BigInt(1),
      contact: '+237699112233',
      phoneVerified: false,
    } as any);

    const res = await request(app)
      .post('/api/auth/resend-otp')
      .send({ phone: '699112233', role: 'buyer' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/nouveau code de vérification a été envoyé/i);
    expect(res.body.requireOtp).toBe(true);
    expect(res.body.phone).toBe('+237699112233');
    expect(res.body.token).toBeUndefined();
    expect(prisma.otpCode.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { phone: '+237699112233' },
        update: expect.objectContaining({
          code: expect.stringMatching(/^\d{6}$/),
        }),
      })
    );
  });

  it('should enforce rate limiting (return 429 after exceeding limit)', async () => {
    vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
      id: BigInt(1),
      contact: '+237699112233',
      phoneVerified: false,
    } as any);

    let hitRateLimit = false;
    let lastRes;
    for (let i = 0; i < 20; i++) {
      lastRes = await request(app)
        .post('/api/auth/resend-otp')
        .send({ phone: '699112233', role: 'buyer' });
      if (lastRes.status === 429) {
        hitRateLimit = true;
        break;
      }
    }

    expect(hitRateLimit).toBe(true);
    expect(lastRes?.status).toBe(429);
    expect(lastRes?.body.message).toMatch(/Trop de demandes de code OTP/i);
  });
});
