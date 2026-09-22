import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { generateSecureOtp, AppOtpProvider, defaultOtpProvider } from '../src/services/otpProvider.js';
import { registerBuyer, registerSeller, verifyOtp } from '../src/controllers/auth.controller.js';
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
    vi.mocked(prisma.acheteur.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue(null);
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

  describe('Disabled OTP Provider Mode (503 Before DB Write)', () => {
    it('should return 503 immediately for buyer without creating records in DB', async () => {
      const originalOtpProvider = process.env.OTP_PROVIDER;
      process.env.OTP_PROVIDER = 'disabled';

      req = {
        body: { companyName: 'Entreprise Disabled', phone: '699112233', pin: '1234' },
      };

      await registerBuyer(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/SMS est désactivé ou non configuré/i),
        })
      );
      expect(prisma.acheteur.create).not.toHaveBeenCalled();
      expect(prisma.otpCode.upsert).not.toHaveBeenCalled();

      process.env.OTP_PROVIDER = originalOtpProvider;
    });

    it('should return 503 immediately for seller without creating records in DB', async () => {
      const originalOtpProvider = process.env.OTP_PROVIDER;
      process.env.OTP_PROVIDER = 'disabled';

      req = {
        body: { fullName: 'Producteur Disabled', phone: '677223344', pin: '5678', gicName: 'GIC Disabled' },
      };

      await registerSeller(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/SMS est désactivé ou non configuré/i),
        })
      );
      expect(prisma.agriculteur.create).not.toHaveBeenCalled();
      expect(prisma.gIC.create).not.toHaveBeenCalled();
      expect(prisma.otpCode.upsert).not.toHaveBeenCalled();

      process.env.OTP_PROVIDER = originalOtpProvider;
    });
  });

  describe('Cross-Role Registration Rejection (409)', () => {
    it('should reject buyer registration if phone is already registered as seller', async () => {
      req = {
        body: { companyName: 'Entreprise X', phone: '699112233', pin: '1234' },
      };

      vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue({
        id: BigInt(5),
        contact: '+237699112233',
      } as any);

      await registerBuyer(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/déjà associé à un compte producteur/i),
        })
      );
      expect(prisma.acheteur.create).not.toHaveBeenCalled();
    });

    it('should reject seller registration if phone is already registered as buyer', async () => {
      req = {
        body: { fullName: 'Fermier Y', phone: '677223344', pin: '1234', gicName: 'Mon GIC' },
      };

      vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
        id: BigInt(8),
        contact: '+237677223344',
      } as any);

      await registerSeller(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/déjà associé à un compte acheteur/i),
        })
      );
      expect(prisma.agriculteur.create).not.toHaveBeenCalled();
    });
  });

  describe('verifyOtp Role Validation and Status Handling', () => {
    it('should return 400 if role is missing in verifyOtp', async () => {
      req = {
        body: { phone: '699112233', code: '123456' },
      };

      await verifyOtp(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/Rôle requis/i),
        })
      );
    });

    it('should return 400 if role is invalid in verifyOtp', async () => {
      req = {
        body: { phone: '699112233', code: '123456', role: 'invalid_role' },
      };

      await verifyOtp(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/Rôle requis/i),
        })
      );
    });

    it('should verify buyer and return status active', async () => {
      req = {
        body: { phone: '699112233', code: '123456', role: 'buyer' },
      };

      vi.mocked(prisma.otpCode.findUnique).mockResolvedValue({
        phone: '+237699112233',
        code: '123456',
        expiresAt: new Date(Date.now() + 60000),
      } as any);

      vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
        id: BigInt(10),
        contact: '+237699112233',
        nomEntreprise: 'Acheteur Pro',
        phoneVerified: false,
      } as any);

      vi.mocked(prisma.acheteur.update).mockResolvedValue({} as any);
      vi.mocked(prisma.otpCode.delete).mockResolvedValue({} as any);

      await verifyOtp(req as Request, res as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          token: expect.any(String),
          user: expect.objectContaining({
            role: 'buyer',
            status: 'active',
          }),
        })
      );
    });

    it('should verify pending seller and return status pending (not active)', async () => {
      req = {
        body: { phone: '677223344', code: '654321', role: 'seller' },
      };

      vi.mocked(prisma.otpCode.findUnique).mockResolvedValue({
        phone: '+237677223344',
        code: '654321',
        expiresAt: new Date(Date.now() + 60000),
      } as any);

      vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue({
        id: BigInt(20),
        contact: '+237677223344',
        nom: 'Fermier En Attente',
        gicId: BigInt(1),
        estLeader: false,
        statut: 'EN_ATTENTE',
        phoneVerified: false,
      } as any);

      vi.mocked(prisma.agriculteur.update).mockResolvedValue({} as any);
      vi.mocked(prisma.otpCode.delete).mockResolvedValue({} as any);

      await verifyOtp(req as Request, res as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          token: expect.any(String),
          user: expect.objectContaining({
            role: 'seller',
            status: 'pending',
            statut: 'EN_ATTENTE',
          }),
        })
      );
    });

    it('should verify approved seller and return status active', async () => {
      req = {
        body: { phone: '677223344', code: '654321', role: 'seller' },
      };

      vi.mocked(prisma.otpCode.findUnique).mockResolvedValue({
        phone: '+237677223344',
        code: '654321',
        expiresAt: new Date(Date.now() + 60000),
      } as any);

      vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue({
        id: BigInt(21),
        contact: '+237677223344',
        nom: 'Fermier Approuve',
        gicId: BigInt(1),
        estLeader: true,
        statut: 'APPROUVE',
        phoneVerified: false,
      } as any);

      vi.mocked(prisma.agriculteur.update).mockResolvedValue({} as any);
      vi.mocked(prisma.otpCode.delete).mockResolvedValue({} as any);

      await verifyOtp(req as Request, res as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          token: expect.any(String),
          user: expect.objectContaining({
            role: 'seller',
            status: 'active',
            statut: 'APPROUVE',
          }),
        })
      );
    });
  });

  describe('Ambiguous Accounts and Role Mismatch in verifyOtp', () => {
    it('should return 409 when a phone number is ambiguous (exists in both Buyer and Seller tables)', async () => {
      req = {
        body: { phone: '699112233', code: '123456', role: 'buyer' },
      };

      vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
        id: BigInt(10),
        contact: '+237699112233',
        nomEntreprise: 'Acheteur Dual',
        phoneVerified: false,
      } as any);

      vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue({
        id: BigInt(20),
        contact: '+237699112233',
        nom: 'Producteur Dual',
        phoneVerified: false,
      } as any);

      vi.mocked(prisma.otpCode.findUnique).mockResolvedValue({
        phone: '+237699112233',
        code: '123456',
        expiresAt: new Date(Date.now() + 60000),
      } as any);

      await verifyOtp(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/Conflit d'identité/i),
        })
      );
      expect(prisma.acheteur.update).not.toHaveBeenCalled();
      expect(prisma.agriculteur.update).not.toHaveBeenCalled();
      expect(prisma.otpCode.delete).not.toHaveBeenCalled();
      expect(jsonMock).not.toHaveBeenCalledWith(expect.objectContaining({ token: expect.anything() }));
    });

    it('should return 404 when requested role is buyer but only seller account exists', async () => {
      req = {
        body: { phone: '677223344', code: '123456', role: 'buyer' },
      };

      vi.mocked(prisma.acheteur.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue({
        id: BigInt(20),
        contact: '+237677223344',
        nom: 'Fermier Seul',
      } as any);

      await verifyOtp(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/Compte acheteur introuvable/i),
        })
      );
      expect(prisma.acheteur.update).not.toHaveBeenCalled();
      expect(prisma.otpCode.delete).not.toHaveBeenCalled();
    });

    it('should return 404 when requested role is seller but only buyer account exists', async () => {
      req = {
        body: { phone: '699112233', code: '123456', role: 'seller' },
      };

      vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
        id: BigInt(10),
        contact: '+237699112233',
        nomEntreprise: 'Acheteur Seul',
      } as any);
      vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue(null);

      await verifyOtp(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/Compte producteur introuvable/i),
        })
      );
      expect(prisma.agriculteur.update).not.toHaveBeenCalled();
      expect(prisma.otpCode.delete).not.toHaveBeenCalled();
    });
  });

  describe('SMS Provider Failure Resilience (503 and Retryability in all envs)', () => {
    it('should return 503 on SMS failure during registerBuyer and allow retry', async () => {
      const sendSpy = vi.spyOn(defaultOtpProvider, 'sendSms').mockResolvedValueOnce({
        success: false,
        message: 'Provider down',
        provider: 'test',
        error: 'Network timeout',
      });

      req = {
        body: { companyName: 'Entreprise Retryable', phone: '699554433', pin: '1234' },
      };

      vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.acheteur.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.acheteur.create).mockResolvedValue({ id: BigInt(99) } as any);
      vi.mocked(prisma.otpCode.upsert).mockResolvedValue({} as any);

      // 1. Premier essai échoue à cause du fournisseur SMS
      await registerBuyer(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/service SMS est indisponible/i),
          error: 'Network timeout',
        })
      );

      // 2. Le compte reste non vérifié en base, le rejeu est possible
      vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
        id: BigInt(99),
        contact: '+237699554433',
        phoneVerified: false,
        isVerified: false,
      } as any);
      vi.mocked(prisma.acheteur.update).mockResolvedValue({ id: BigInt(99) } as any);

      statusMock.mockClear();
      jsonMock.mockClear();

      sendSpy.mockResolvedValueOnce({
        success: true,
        message: 'SMS envoyé',
        provider: 'test',
      });

      await registerBuyer(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          requireOtp: true,
          phone: '+237699554433',
        })
      );

      sendSpy.mockRestore();
    });

    it('should return 503 on SMS failure during registerSeller and allow retry', async () => {
      const sendSpy = vi.spyOn(defaultOtpProvider, 'sendSms').mockResolvedValueOnce({
        success: false,
        message: 'Provider down',
        provider: 'test',
        error: 'Network timeout',
      });

      req = {
        body: { fullName: 'Fermier Retryable', phone: '677665544', pin: '1234', gicName: 'GIC Test' },
      };

      vi.mocked(prisma.acheteur.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.gIC.findFirst).mockResolvedValue({ id: BigInt(1) } as any);
      vi.mocked(prisma.agriculteur.count).mockResolvedValue(1);
      vi.mocked(prisma.agriculteur.create).mockResolvedValue({ id: BigInt(88) } as any);
      vi.mocked(prisma.otpCode.upsert).mockResolvedValue({} as any);

      // 1. Premier essai échoue
      await registerSeller(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/service SMS est indisponible/i),
        })
      );

      // 2. Le compte reste non vérifié en base, le rejeu est possible
      vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue({
        id: BigInt(88),
        contact: '+237677665544',
        phoneVerified: false,
        isVerified: false,
      } as any);
      vi.mocked(prisma.agriculteur.update).mockResolvedValue({ id: BigInt(88) } as any);

      statusMock.mockClear();
      jsonMock.mockClear();

      sendSpy.mockResolvedValueOnce({
        success: true,
        message: 'SMS envoyé',
        provider: 'test',
      });

      await registerSeller(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          requireOtp: true,
          phone: '+237677665544',
        })
      );

      sendSpy.mockRestore();
    });
  });
});
