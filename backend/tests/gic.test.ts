import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { getGicProfile, updateGicProfile, getGicHarvests, createGicHarvest, getGicExpenses, createGicExpense } from '../src/controllers/gic.controller.js';
import prisma from '../src/lib/prisma.js';
import { AuthRequest } from '../src/controllers/auth.controller.js';

vi.mock('../src/lib/prisma', () => {
  return {
    default: {
      gIC: { findUnique: vi.fn(), update: vi.fn() },
      recolteOffre: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
      produitAgricole: { findFirst: vi.fn(), create: vi.fn() },
      chargeFinanciere: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
    }
  };
});

describe('GIC Controller Unit Tests', () => {
  let req: Partial<AuthRequest>;
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

  describe('getGicProfile', () => {
    it('should return 403 if user is not a seller with gicId', async () => {
      req = { user: { id: '1', role: 'buyer', phone: '123', status: 'active', name: 'Buyer' } };
      await getGicProfile(req as AuthRequest, res as Response);
      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it('should return gic profile if user is valid seller', async () => {
      req = { user: { id: '1', role: 'seller', phone: '123', gicId: '1', gicRole: 'leader', status: 'active', name: 'Seller' } };
      
      const mockGic = {
        id: BigInt(1),
        nom: 'GIC Test',
        identifiantREF: 'REF1',
        statutLegalisation: 'Valid',
        activitesPrincipales: 'Agri',
        timestampMaj: new Date(),
        bassinProduction: { nom: 'Ouest' },
        agriculteurs: [{ id: BigInt(1), nom: 'Seller', contact: '123', estLeader: true, timestampMaj: new Date() }],
        besoins: []
      };
      
      vi.mocked(prisma.gIC.findUnique).mockResolvedValue(mockGic as any);

      await getGicProfile(req as AuthRequest, res as Response);

      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        profile: expect.objectContaining({ name: 'GIC Test', bassin: 'Ouest' }),
        members: expect.any(Array),
        needs: expect.any(Array)
      }));
    });
  });

  describe('createGicHarvest', () => {
    it('should create harvest and return 201', async () => {
      req = { 
        user: { id: '1', role: 'seller', phone: '123', gicId: '1', gicRole: 'leader', status: 'active', name: 'Seller' },
        body: { product: 'Tomate', volume: 100 }
      };

      vi.mocked(prisma.produitAgricole.findFirst).mockResolvedValue({ id: BigInt(1), nom: 'Tomate' } as any);
      vi.mocked(prisma.recolteOffre.create).mockResolvedValue({
        id: BigInt(1),
        quantiteDisponible: 100,
        dateDispoEstimee: new Date(),
        timestampMaj: new Date(),
        produitAgricole: { nom: 'Tomate' }
      } as any);

      await createGicHarvest(req as AuthRequest, res as Response);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        harvest: expect.objectContaining({ product: 'Tomate', volume: 100 })
      }));
    });
  });

  describe('createGicExpense', () => {
    it('should create expense and return 201', async () => {
      req = { 
        user: { id: '1', role: 'seller', phone: '123', gicId: '1', gicRole: 'leader', status: 'active', name: 'Seller' },
        body: { label: 'Semences', amount: 50000, category: 'Intrants' }
      };

      vi.mocked(prisma.chargeFinanciere.create).mockResolvedValue({
        id: BigInt(1),
        typeCharge: 'Semences',
        montant: 50000,
        timestampMaj: new Date()
      } as any);

      await createGicExpense(req as AuthRequest, res as Response);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        expense: expect.objectContaining({ label: 'Semences', amount: 50000 })
      }));
    });
  });
});
