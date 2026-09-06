import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { registerBuyer, verifyOtp, login, registerSeller } from '../src/controllers/auth.controller.js';
import prisma from '../src/lib/prisma.js';
import bcrypt from 'bcrypt';

vi.mock('../src/lib/prisma', () => {
  return {
    default: {
      acheteur: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
      agriculteur: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
      gIC: { findFirst: vi.fn(), create: vi.fn() },
      bassinProduction: { findFirst: vi.fn() },
      otpCode: { upsert: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    }
  };
});

describe('Auth Controller Unit Tests', () => {
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

  describe('registerBuyer', () => {
    it('should register a new buyer and return requireOtp', async () => {
      req = {
        body: { companyName: 'Test Corp', phone: '699112233', pin: '1234' }
      };

      vi.mocked(prisma.acheteur.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.acheteur.create).mockResolvedValue({ id: 1 } as any);
      vi.mocked(prisma.otpCode.upsert).mockResolvedValue({} as any);

      await registerBuyer(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        requireOtp: true,
        phone: '+237699112233'
      }));
    });

    it('should return 409 if phone already exists', async () => {
      req = {
        body: { companyName: 'Test Corp', phone: '699112233', pin: '1234' }
      };

      vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({ id: 1, phoneVerified: true } as any);

      await registerBuyer(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(409);
    });
  });

  describe('login', () => {
    it('should login an existing buyer successfully', async () => {
      req = {
        body: { phone: '699112233', pin: '1234' }
      };

      const pinHash = await bcrypt.hash('1234', 10);
      vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
        id: 1,
        pinHash,
        phoneVerified: true,
        contact: '+237699112233',
        nomEntreprise: 'Test Corp'
      } as any);

      await login(req as Request, res as Response);

      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        token: expect.any(String),
        user: expect.objectContaining({ role: 'buyer' })
      }));
    });

    it('should require otp if not phoneVerified', async () => {
      req = {
        body: { phone: '699112233', pin: '1234' }
      };

      const pinHash = await bcrypt.hash('1234', 10);
      vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
        id: 1,
        pinHash,
        phoneVerified: false,
        contact: '+237699112233'
      } as any);

      await login(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        requireOtp: true
      }));
    });
  });
});
