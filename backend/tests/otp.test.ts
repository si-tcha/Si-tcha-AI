import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { generateSecureOtp, AppOtpProvider } from '../src/services/otpProvider.js';
import { registerBuyer, registerSeller } from '../src/controllers/auth.controller.js';
import prisma from '../src/lib/prisma.js';

vi.mock('../src/lib/prisma', () => {
  return {
    default: {
      acheteur: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      agriculteur: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      gIC: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      bassinProduction: {
        findFirst: vi.fn(),
      },
      otpCode: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
});

describe('OTP Provider and SMS Resilience Tests', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: any;
  let statusMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    res = {
      status: statusMock,
      json: jsonMock,
    };
  });

  describe('generateSecureOtp', () => {
    it('should generate a 6-digit numeric OTP string', () => {
      const otp = generateSecureOtp(6);
      expect(otp).toHaveLength(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
    });

    it('should generate different codes on subsequent invocations', () => {
      const set = new Set();
      for (let i = 0; i < 20; i++) {
        set.add(generateSecureOtp(6));
      }
      expect(set.size).toBeGreaterThan(15);
    });
  });

  describe('AppOtpProvider with OTP_PROVIDER=disabled', () => {
    it('should report mode disabled and fail gracefully without sending real SMS', async () => {
      const originalEnv = process.env.OTP_PROVIDER;
      process.env.OTP_PROVIDER = 'disabled';

      const provider = new AppOtpProvider();
      expect(provider.getMode()).toBe('disabled');

      const result = await provider.sendSms('+237699001122', 'Test message');
      expect(result.success).toBe(false);
      expect(result.provider).toBe('disabled');
      expect(result.error).toBeDefined();

      process.env.OTP_PROVIDER = originalEnv;
    });
  });

  describe('Re-registration Resilience on Unverified Phone Numbers', () => {
    it('should allow buyer re-registration if previously created account is not verified', async () => {
      req = {
        body: { companyName: 'Entreprise Unverified', phone: '699112233', pin: '1234' },
      };

      // Existing unverified account
      vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
        id: BigInt(1),
        contact: '+237699112233',
        phoneVerified: false,
        isVerified: false,
      } as any);

      vi.mocked(prisma.acheteur.update).mockResolvedValue({ id: BigInt(1) } as any);
      vi.mocked(prisma.otpCode.upsert).mockResolvedValue({} as any);

      await registerBuyer(req as Request, res as Response);

      // Should succeed with 201 instead of blocking with 409
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(prisma.acheteur.update).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          requireOtp: true,
          phone: '+237699112233',
        })
      );
    });

    it('should block buyer registration with 409 if account is already verified', async () => {
      req = {
        body: { companyName: 'Entreprise Verified', phone: '699112233', pin: '1234' },
      };

      vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
        id: BigInt(1),
        contact: '+237699112233',
        phoneVerified: true,
        isVerified: true,
      } as any);

      await registerBuyer(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/déjà associé à un compte acheteur vérifié/i),
        })
      );
    });

    it('should allow seller re-registration if previously created account is not verified', async () => {
      req = {
        body: { fullName: 'Fermier Paul', phone: '677223344', pin: '5678', gicName: 'GIC Espoir' },
      };

      vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue({
        id: BigInt(2),
        contact: '+237677223344',
        phoneVerified: false,
        isVerified: false,
      } as any);

      vi.mocked(prisma.gIC.findFirst).mockResolvedValue({ id: BigInt(10), nom: 'GIC Espoir' } as any);
      vi.mocked(prisma.agriculteur.update).mockResolvedValue({ id: BigInt(2) } as any);
      vi.mocked(prisma.otpCode.upsert).mockResolvedValue({} as any);

      await registerSeller(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(prisma.agriculteur.update).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          requireOtp: true,
          phone: '+237677223344',
        })
      );
    });

    it('should block seller registration with 409 if account is already verified', async () => {
      req = {
        body: { fullName: 'Fermier Paul', phone: '677223344', pin: '5678', gicName: 'GIC Espoir' },
      };

      vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue({
        id: BigInt(2),
        contact: '+237677223344',
        phoneVerified: true,
        isVerified: true,
      } as any);

      await registerSeller(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/déjà associé à un compte producteur vérifié/i),
        })
      );
    });
  });
});
