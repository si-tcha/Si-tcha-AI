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

const GENERIC_PUBLIC_MESSAGE =
  'Si les informations correspondent à un compte en attente de validation, un code OTP a été envoyé.';

describe('POST /api/auth/resend-otp Hardened Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.acheteur.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.otpCode.upsert).mockResolvedValue({} as any);
    vi.spyOn(defaultOtpProvider, 'getMode').mockReturnValue('test');
    vi.spyOn(defaultOtpProvider, 'sendSms').mockResolvedValue({
      success: true,
      message: 'SMS envoyé',
      provider: 'test',
    });
  });

  it('should return 400 if validation fails on role or phone', async () => {
    const resRole = await request(app)
      .post('/api/auth/resend-otp')
      .send({ phone: '699112233', role: 'admin' });

    expect(resRole.status).toBe(400);
    expect(prisma.otpCode.upsert).not.toHaveBeenCalled();

    const resPhone = await request(app)
      .post('/api/auth/resend-otp')
      .send({ phone: '1234', role: 'buyer' });

    expect(resPhone.status).toBe(400);
    expect(prisma.otpCode.upsert).not.toHaveBeenCalled();
  });

  it('should return 503 controlled response when provider is disabled (via getMode)', async () => {
    vi.spyOn(defaultOtpProvider, 'getMode').mockReturnValue('disabled');

    const res = await request(app)
      .post('/api/auth/resend-otp')
      .send({ phone: '699112233', role: 'buyer' });

    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/service SMS est actuellement désactivé/i);
    expect(res.body.token).toBeUndefined();
    expect(prisma.otpCode.upsert).not.toHaveBeenCalled();
    expect(defaultOtpProvider.sendSms).not.toHaveBeenCalled();
  });

  it('should prevent enumeration: non-existent account returns generic 200 without DB OTP', async () => {
    vi.mocked(prisma.acheteur.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/resend-otp')
      .send({ phone: '699112233', role: 'buyer' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(GENERIC_PUBLIC_MESSAGE);
    expect(res.body.requireOtp).toBe(true);
    expect(res.body.token).toBeUndefined();
    expect(prisma.otpCode.upsert).not.toHaveBeenCalled();
    expect(defaultOtpProvider.sendSms).not.toHaveBeenCalled();
  });

  it('should prevent enumeration: incorrect role returns generic 200 without DB OTP', async () => {
    // Le numéro correspond à un buyer, mais la requête demande seller
    vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
      id: BigInt(1),
      contact: '+237699112233',
      phoneVerified: false,
    } as any);
    vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/resend-otp')
      .send({ phone: '699112233', role: 'seller' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(GENERIC_PUBLIC_MESSAGE);
    expect(res.body.requireOtp).toBe(true);
    expect(res.body.token).toBeUndefined();
    expect(prisma.otpCode.upsert).not.toHaveBeenCalled();
    expect(defaultOtpProvider.sendSms).not.toHaveBeenCalled();
  });

  it('should prevent enumeration: already verified account returns generic 200 without DB OTP', async () => {
    vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
      id: BigInt(1),
      contact: '+237699112233',
      phoneVerified: true,
      isVerified: true,
    } as any);

    const res = await request(app)
      .post('/api/auth/resend-otp')
      .send({ phone: '699112233', role: 'buyer' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(GENERIC_PUBLIC_MESSAGE);
    expect(res.body.requireOtp).toBe(true);
    expect(res.body.token).toBeUndefined();
    expect(prisma.otpCode.upsert).not.toHaveBeenCalled();
    expect(defaultOtpProvider.sendSms).not.toHaveBeenCalled();
  });

  it('should persist OTP in DB BEFORE calling provider SMS', async () => {
    vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
      id: BigInt(1),
      contact: '+237699112233',
      phoneVerified: false,
    } as any);

    const callOrder: string[] = [];

    vi.mocked(prisma.otpCode.upsert).mockImplementation(async () => {
      callOrder.push('prisma.upsert');
      return {} as any;
    });

    vi.spyOn(defaultOtpProvider, 'sendSms').mockImplementation(async () => {
      callOrder.push('provider.sendSms');
      return { success: true, message: 'SMS envoyé', provider: 'test' };
    });

    const res = await request(app)
      .post('/api/auth/resend-otp')
      .send({ phone: '699112233', role: 'buyer' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(GENERIC_PUBLIC_MESSAGE);
    expect(res.body.token).toBeUndefined();
    expect(callOrder).toEqual(['prisma.upsert', 'provider.sendSms']);
  });

  it('should return 503 if provider SMS fails after persistence, leaving account unverified', async () => {
    vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
      id: BigInt(1),
      contact: '+237699112233',
      phoneVerified: false,
    } as any);

    vi.spyOn(defaultOtpProvider, 'sendSms').mockResolvedValueOnce({
      success: false,
      message: 'Échec de transmission SMS',
      provider: 'test',
      error: 'Gateway timeout',
    });

    const res = await request(app)
      .post('/api/auth/resend-otp')
      .send({ phone: '699112233', role: 'buyer' });

    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/service SMS est temporairement indisponible/i);
    expect(res.body.token).toBeUndefined();
    expect(prisma.otpCode.upsert).toHaveBeenCalledTimes(1);
  });

  it('should successfully resend OTP with 200 without emitting JWT', async () => {
    vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue({
      id: BigInt(42),
      contact: '+237677889900',
      phoneVerified: false,
    } as any);

    const res = await request(app)
      .post('/api/auth/resend-otp')
      .send({ phone: '677889900', role: 'seller' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(GENERIC_PUBLIC_MESSAGE);
    expect(res.body.requireOtp).toBe(true);
    expect(res.body.token).toBeUndefined();
    expect(prisma.otpCode.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { phone: '+237677889900' },
        update: expect.objectContaining({
          code: expect.stringMatching(/^\d{6}$/),
        }),
      })
    );
  });

  it('should enforce strict rate limiting (429 returned after exceeding limit)', async () => {
    vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
      id: BigInt(1),
      contact: '+237699112233',
      phoneVerified: false,
    } as any);

    let hitLimit = false;
    let finalResponse;

    for (let i = 0; i < 20; i++) {
      finalResponse = await request(app)
        .post('/api/auth/resend-otp')
        .send({ phone: '699112233', role: 'buyer' });

      if (finalResponse.status === 429) {
        hitLimit = true;
        break;
      }
    }

    expect(hitLimit).toBe(true);
    expect(finalResponse?.status).toBe(429);
    expect(finalResponse?.body.message).toMatch(/Trop de demandes de code OTP/i);
  });
});
