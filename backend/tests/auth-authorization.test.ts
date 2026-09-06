import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { getJwtSecret } from '../src/middlewares/auth.js';

vi.mock('../src/lib/prisma', () => {
  return {
    default: {
      acheteur: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
      agriculteur: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      admin: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
      gIC: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      bassinProduction: {
        findFirst: vi.fn(),
      },
      recolteOffre: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
    },
  };
});

describe('Authorization and RBAC Integration Tests', () => {
  const secret = getJwtSecret();

  const buyerToken = jwt.sign(
    { id: '100', role: 'buyer', phone: '+237699111111', nom: 'Entreprise Achat' },
    secret,
    { expiresIn: '1h' }
  );

  const sellerNonLeaderToken = jwt.sign(
    { id: '200', role: 'seller', phone: '+237677222222', nom: 'Agriculteur Membre' },
    secret,
    { expiresIn: '1h' }
  );

  const sellerLeaderToken = jwt.sign(
    { id: '300', role: 'seller', phone: '+237688333333', nom: 'Leader Coop' },
    secret,
    { expiresIn: '1h' }
  );

  const adminToken = jwt.sign(
    { id: 'admin-1', role: 'admin', nom: 'SuperAdmin' },
    secret,
    { expiresIn: '1h' }
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication Enforcement (401)', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const res = await request(app).get('/api/gics/members/pending');
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Non autorisé/i);
    });

    it('should return 401 when Authorization token is invalid', async () => {
      const res = await request(app)
        .get('/api/gics/members/pending')
        .set('Authorization', 'Bearer invalid-token-string');
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Non autorisé/i);
    });
  });

  describe('GIC Leader Access Control (403 vs 200)', () => {
    it('should return 403 when a buyer tries to access GIC leader endpoint', async () => {
      vi.mocked(prisma.acheteur.findFirst).mockResolvedValue({
        id: BigInt(100),
        nomEntreprise: 'Entreprise Achat',
        contact: '+237699111111',
        phoneVerified: true,
        isVerified: true,
      } as any);

      const res = await request(app)
        .get('/api/gics/members/pending')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Seuls les leaders de GIC/i);
    });

    it('should return 403 when a seller who is NOT a leader tries to access GIC leader endpoint', async () => {
      vi.mocked(prisma.agriculteur.findFirst).mockResolvedValue({
        id: BigInt(200),
        nom: 'Agriculteur Membre',
        contact: '+237677222222',
        gicId: BigInt(1),
        estLeader: false,
        statut: 'APPROUVE',
        phoneVerified: true,
        isVerified: true,
      } as any);

      vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue({
        id: BigInt(200),
        gicId: BigInt(1),
        estLeader: false,
        statut: 'APPROUVE',
      } as any);

      const res = await request(app)
        .get('/api/gics/members/pending')
        .set('Authorization', `Bearer ${sellerNonLeaderToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Seuls les leaders de GIC/i);
    });

    it('should return 200 when a valid GIC leader consults pending members', async () => {
      vi.mocked(prisma.agriculteur.findFirst).mockResolvedValue({
        id: BigInt(300),
        nom: 'Leader Coop',
        contact: '+237688333333',
        gicId: BigInt(1),
        estLeader: true,
        statut: 'APPROUVE',
        phoneVerified: true,
        isVerified: true,
      } as any);

      vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue({
        id: BigInt(300),
        gicId: BigInt(1),
        estLeader: true,
        statut: 'APPROUVE',
      } as any);

      vi.mocked(prisma.agriculteur.findMany).mockResolvedValue([
        {
          id: BigInt(401),
          nom: 'Candidat 1',
          contact: '+237670000001',
          timestampMaj: new Date(),
        },
      ] as any);

      const res = await request(app)
        .get('/api/gics/members/pending')
        .set('Authorization', `Bearer ${sellerLeaderToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].nom).toBe('Candidat 1');
    });

    it('should return 200 when a GIC leader approves a member of their own GIC', async () => {
      vi.mocked(prisma.agriculteur.findFirst).mockResolvedValue({
        id: BigInt(300),
        nom: 'Leader Coop',
        contact: '+237688333333',
        gicId: BigInt(1),
        estLeader: true,
        statut: 'APPROUVE',
        phoneVerified: true,
        isVerified: true,
      } as any);

      // isGicLeader check
      vi.mocked(prisma.agriculteur.findUnique).mockImplementation(async ({ where }: any) => {
        if (where.id === BigInt(300)) {
          return {
            id: BigInt(300),
            gicId: BigInt(1),
            estLeader: true,
            statut: 'APPROUVE',
          } as any;
        }
        if (where.id === BigInt(401)) {
          return {
            id: BigInt(401),
            nom: 'Candidat 1',
            gicId: BigInt(1),
            estLeader: false,
            statut: 'EN_ATTENTE',
          } as any;
        }
        return null;
      });

      vi.mocked(prisma.agriculteur.update).mockResolvedValue({
        id: BigInt(401),
        nom: 'Candidat 1',
        gicId: BigInt(1),
        statut: 'APPROUVE',
        timestampMaj: new Date(),
      } as any);

      const res = await request(app)
        .patch('/api/gics/members/401/status')
        .set('Authorization', `Bearer ${sellerLeaderToken}`)
        .send({ status: 'APPROUVE' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/approuvé avec succès/i);
    });

    it('should return 403 when a GIC leader tries to manage a member from another GIC', async () => {
      vi.mocked(prisma.agriculteur.findFirst).mockResolvedValue({
        id: BigInt(300),
        nom: 'Leader Coop',
        contact: '+237688333333',
        gicId: BigInt(1),
        estLeader: true,
        statut: 'APPROUVE',
        phoneVerified: true,
        isVerified: true,
      } as any);

      // Leader belongs to GIC 1, but member belongs to GIC 2
      vi.mocked(prisma.agriculteur.findUnique).mockImplementation(async ({ where }: any) => {
        if (where.id === BigInt(300)) {
          return {
            id: BigInt(300),
            gicId: BigInt(1),
            estLeader: true,
            statut: 'APPROUVE',
          } as any;
        }
        if (where.id === BigInt(501)) {
          return {
            id: BigInt(501),
            nom: 'Membre Autre GIC',
            gicId: BigInt(2), // GIC différent!
            estLeader: false,
            statut: 'EN_ATTENTE',
          } as any;
        }
        return null;
      });

      const res = await request(app)
        .patch('/api/gics/members/501/status')
        .set('Authorization', `Bearer ${sellerLeaderToken}`)
        .send({ status: 'APPROUVE' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/propres membres|Action non autorisée/i);
    });

    it('should return 404 when target member does not exist', async () => {
      vi.mocked(prisma.agriculteur.findFirst).mockResolvedValue({
        id: BigInt(300),
        nom: 'Leader Coop',
        contact: '+237688333333',
        gicId: BigInt(1),
        estLeader: true,
        statut: 'APPROUVE',
        phoneVerified: true,
        isVerified: true,
      } as any);

      vi.mocked(prisma.agriculteur.findUnique).mockImplementation(async ({ where }: any) => {
        if (where.id === BigInt(300)) {
          return {
            id: BigInt(300),
            gicId: BigInt(1),
            estLeader: true,
            statut: 'APPROUVE',
          } as any;
        }
        return null; // member 999 not found
      });

      const res = await request(app)
        .patch('/api/gics/members/999/status')
        .set('Authorization', `Bearer ${sellerLeaderToken}`)
        .send({ status: 'APPROUVE' });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/introuvable/i);
    });
  });

  describe('Admin Access Control (403 vs 200)', () => {
    it('should return 403 when a non-admin (seller or buyer) attempts to access admin route', async () => {
      vi.mocked(prisma.acheteur.findFirst).mockResolvedValue({
        id: BigInt(100),
        nomEntreprise: 'Entreprise Achat',
        contact: '+237699111111',
        phoneVerified: true,
        isVerified: true,
      } as any);

      const res = await request(app)
        .get('/api/admin/gics')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/droits d'administrateur/i);
    });

    it('should return 200 when a valid admin accesses admin route', async () => {
      vi.mocked(prisma.admin.findFirst).mockResolvedValue({
        id: 'admin-1',
        nom: 'SuperAdmin',
        contact: '+237699000000',
      } as any);

      vi.mocked(prisma.gIC.findMany).mockResolvedValue([
        {
          id: BigInt(1),
          nom: 'GIC des Producteurs',
          identifiantREF: 'GIC-001',
          bassinProduction: { nom: 'Ouest' },
          agriculteurs: [],
        },
      ] as any);

      const res = await request(app)
        .get('/api/admin/gics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
