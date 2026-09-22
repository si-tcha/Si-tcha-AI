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
      donneesMeteo: {
        findFirst: vi.fn(),
      },
      donneesSol: {
        findFirst: vi.fn(),
      },
      alerteMeteo: {
        findMany: vi.fn(),
      },
      donneeMarche: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
      transactionAcheteur: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      prefinancingEntry: {
        findMany: vi.fn(),
        create: vi.fn(),
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

  const pendingBuyerToken = jwt.sign(
    { id: '101', role: 'buyer', phone: '+237699111112', nom: 'Entreprise Non Verifiee' },
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

  const sellerPendingLeaderToken = jwt.sign(
    { id: '301', role: 'seller', phone: '+237688333334', nom: 'Leader En Attente' },
    secret,
    { expiresIn: '1h' }
  );

  const sellerPendingMemberToken = jwt.sign(
    { id: '302', role: 'seller', phone: '+237688333335', nom: 'Membre En Attente' },
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
      vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
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
      expect(res.body.message).toMatch(/Accès refusé|Seuls les leaders de GIC/i);
    });

    it('should return 403 when a seller who is NOT a leader tries to access GIC leader endpoint', async () => {
      vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue({
        id: BigInt(200),
        nom: 'Agriculteur Membre',
        contact: '+237677222222',
        gicId: BigInt(1),
        estLeader: false,
        statut: 'APPROUVE',
        phoneVerified: true,
        isVerified: true,
      } as any);

      const res = await request(app)
        .get('/api/gics/members/pending')
        .set('Authorization', `Bearer ${sellerNonLeaderToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Seuls les leaders de GIC/i);
    });

    it('should return 200 when a valid GIC leader consults pending members', async () => {
      vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue({
        id: BigInt(300),
        nom: 'Leader Coop',
        contact: '+237688333333',
        gicId: BigInt(1),
        estLeader: true,
        statut: 'APPROUVE',
        phoneVerified: true,
        isVerified: true,
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
      vi.mocked(prisma.agriculteur.findUnique).mockImplementation(async ({ where }: any) => {
        if (where.id === BigInt(300)) {
          return {
            id: BigInt(300),
            nom: 'Leader Coop',
            contact: '+237688333333',
            gicId: BigInt(1),
            estLeader: true,
            statut: 'APPROUVE',
            phoneVerified: true,
            isVerified: true,
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
      vi.mocked(prisma.agriculteur.findUnique).mockImplementation(async ({ where }: any) => {
        if (where.id === BigInt(300)) {
          return {
            id: BigInt(300),
            nom: 'Leader Coop',
            contact: '+237688333333',
            gicId: BigInt(1),
            estLeader: true,
            statut: 'APPROUVE',
            phoneVerified: true,
            isVerified: true,
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
      vi.mocked(prisma.agriculteur.findUnique).mockImplementation(async ({ where }: any) => {
        if (where.id === BigInt(300)) {
          return {
            id: BigInt(300),
            nom: 'Leader Coop',
            contact: '+237688333333',
            gicId: BigInt(1),
            estLeader: true,
            statut: 'APPROUVE',
            phoneVerified: true,
            isVerified: true,
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

  describe('Business Authorization Enforcement (protect vs requireActive)', () => {
    it('should allow pending seller to access /api/auth/me (200 with pending status)', async () => {
      vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue({
        id: BigInt(302),
        nom: 'Membre En Attente',
        contact: '+237688333335',
        gicId: BigInt(1),
        estLeader: false,
        statut: 'EN_ATTENTE',
        phoneVerified: true,
        isVerified: true,
      } as any);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${sellerPendingMemberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.role).toBe('seller');
      expect(res.body.user.status).toBe('pending');
      expect(res.body.user.statut).toBe('EN_ATTENTE');
    });

    it('should block pending seller from business route /api/gic/harvests (403)', async () => {
      vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue({
        id: BigInt(302),
        nom: 'Membre En Attente',
        contact: '+237688333335',
        gicId: BigInt(1),
        estLeader: false,
        statut: 'EN_ATTENTE',
        phoneVerified: true,
        isVerified: true,
      } as any);

      const res = await request(app)
        .get('/api/gic/harvests')
        .set('Authorization', `Bearer ${sellerPendingMemberToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Accès réservé aux producteurs approuvés/i);
    });

    it('should block pending leader from GIC management (403)', async () => {
      vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue({
        id: BigInt(301),
        nom: 'Leader En Attente',
        contact: '+237688333334',
        gicId: BigInt(1),
        estLeader: true,
        statut: 'EN_ATTENTE',
        phoneVerified: true,
        isVerified: true,
      } as any);

      const res = await request(app)
        .get('/api/gics/members/pending')
        .set('Authorization', `Bearer ${sellerPendingLeaderToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Accès réservé aux producteurs approuvés|Seuls les leaders/i);
    });

    it('should block unverified buyer from business route /api/buyer/orders (403)', async () => {
      vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
        id: BigInt(101),
        nomEntreprise: 'Entreprise Non Verifiee',
        contact: '+237699111112',
        phoneVerified: false,
        isVerified: false,
      } as any);

      const res = await request(app)
        .get('/api/buyer/orders')
        .set('Authorization', `Bearer ${pendingBuyerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Compte acheteur en attente de vérification téléphonique/i);
    });
  });

  describe('Identity Non-Reassignment (Strict ID resolution)', () => {
    it('should return 401 if token user ID no longer exists, even if contact matches another user', async () => {
      const deletedUserToken = jwt.sign(
        { id: '99999', role: 'seller', phone: '+237677000999' },
        secret,
        { expiresIn: '1h' }
      );

      // findUnique by id: 99999 returns null (account was deleted)
      vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${deletedUserToken}`);

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/compte utilisateur introuvable/i);
    });
  });

  describe('Weather Controller Access Control', () => {
    it('should allow approved seller to access weather dashboard', async () => {
      vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue({
        id: BigInt(300),
        nom: 'Leader Coop',
        contact: '+237688333333',
        gicId: BigInt(1),
        estLeader: true,
        statut: 'APPROUVE',
        phoneVerified: true,
        isVerified: true,
      } as any);

      vi.mocked(prisma.donneesMeteo.findFirst).mockResolvedValue({
        id: BigInt(1),
        temperature: 26,
        description: 'clear sky',
        timestampMesure: new Date(),
      } as any);

      vi.mocked(prisma.donneesSol.findFirst).mockResolvedValue({
        id: BigInt(1),
        temperatureSurface: 24,
        timestampMesure: new Date(),
      } as any);

      vi.mocked(prisma.alerteMeteo.findMany).mockResolvedValue([]);
      vi.mocked(prisma.gIC.findUnique).mockResolvedValue({ previsionsMeteo: [] } as any);

      const res = await request(app)
        .get('/api/weather/dashboard')
        .set('Authorization', `Bearer ${sellerLeaderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should return 403 when buyer tries to access weather dashboard', async () => {
      vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
        id: BigInt(100),
        nomEntreprise: 'Entreprise Achat',
        contact: '+237699111111',
        phoneVerified: true,
        isVerified: true,
      } as any);

      const res = await request(app)
        .get('/api/weather/dashboard')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Accès refusé|Accès réservé aux producteurs/i);
    });

    it('should return 403 when admin tries to access weather dashboard', async () => {
      vi.mocked(prisma.admin.findUnique).mockResolvedValue({
        id: 'admin-1',
        nom: 'SuperAdmin',
        contact: '+237699000000',
      } as any);

      const res = await request(app)
        .get('/api/weather/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Accès refusé|Accès réservé aux producteurs/i);
    });
  });

  describe('Market Dashboard Role-Based Advice', () => {
    beforeEach(() => {
      vi.mocked(prisma.donneeMarche.findMany).mockResolvedValue([
        {
          id: BigInt(1),
          produitAgricoleId: BigInt(10),
          bassinProductionId: BigInt(20),
          prixMoyen: 1500,
          prixMin: 1400,
          prixMax: 1600,
          dateReleve: new Date('2026-09-02'),
          produitAgricole: { nom: 'Manioc' },
          bassinProduction: { nom: 'Centre', region: 'Centre' },
        },
        {
          id: BigInt(2),
          produitAgricoleId: BigInt(10),
          bassinProductionId: BigInt(20),
          prixMoyen: 1200,
          prixMin: 1100,
          prixMax: 1300,
          dateReleve: new Date('2026-09-01'),
          produitAgricole: { nom: 'Manioc' },
          bassinProduction: { nom: 'Centre', region: 'Centre' },
        },
      ] as any);
    });

    it('should give seller advice to seller (vendre)', async () => {
      vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue({
        id: BigInt(300),
        nom: 'Leader Coop',
        contact: '+237688333333',
        gicId: BigInt(1),
        estLeader: true,
        statut: 'APPROUVE',
        phoneVerified: true,
        isVerified: true,
      } as any);

      const res = await request(app)
        .get('/api/market/dashboard')
        .set('Authorization', `Bearer ${sellerLeaderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data[0].conseil).toMatch(/vendre/i);
    });

    it('should give buyer advice to buyer (acheter)', async () => {
      vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
        id: BigInt(100),
        nomEntreprise: 'Entreprise Achat',
        contact: '+237699111111',
        phoneVerified: true,
        isVerified: true,
      } as any);

      const res = await request(app)
        .get('/api/market/dashboard')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data[0].conseil).toMatch(/acheter/i);
    });

    it('should give explicit macro advice to admin (surveiller)', async () => {
      vi.mocked(prisma.admin.findUnique).mockResolvedValue({
        id: 'admin-1',
        nom: 'SuperAdmin',
        contact: '+237699000000',
      } as any);

      const res = await request(app)
        .get('/api/market/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data[0].conseil).toMatch(/Surveiller/i);
    });
  });

  describe('Admin Access Control (403 vs 200)', () => {
    it('should return 403 when a non-admin (seller or buyer) attempts to access admin route', async () => {
      vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
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
      expect(res.body.message).toMatch(/Accès refusé|droits d'administrateur/i);
    });

    it('should return 200 when a valid admin accesses admin route', async () => {
      vi.mocked(prisma.admin.findUnique).mockResolvedValue({
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

  describe('Centralized Role Guard (requireRole) and Route Matrix', () => {
    it('should reject buyer with 403 on seller-only routes (/api/gic/profile)', async () => {
      vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
        id: BigInt(100),
        nomEntreprise: 'Entreprise Achat',
        contact: '+237699111111',
        phoneVerified: true,
        isVerified: true,
      } as any);

      const res = await request(app)
        .get('/api/gic/profile')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Accès refusé/i);
    });

    it('should reject seller with 403 on buyer-only routes (/api/buyer/orders)', async () => {
      vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue({
        id: BigInt(300),
        nom: 'Leader Coop',
        contact: '+237688333333',
        gicId: BigInt(1),
        estLeader: true,
        statut: 'APPROUVE',
        phoneVerified: true,
        isVerified: true,
      } as any);

      const res = await request(app)
        .get('/api/buyer/orders')
        .set('Authorization', `Bearer ${sellerLeaderToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Accès refusé/i);
    });

    it('should reject admin with 403 on strictly seller routes and strictly buyer routes', async () => {
      vi.mocked(prisma.admin.findUnique).mockResolvedValue({
        id: 'admin-1',
        nom: 'SuperAdmin',
        contact: '+237699000000',
      } as any);

      const resSellerRoute = await request(app)
        .get('/api/gic/profile')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resSellerRoute.status).toBe(403);
      expect(resSellerRoute.body.message).toMatch(/Accès refusé/i);

      const resBuyerRoute = await request(app)
        .get('/api/buyer/orders')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resBuyerRoute.status).toBe(403);
      expect(resBuyerRoute.body.message).toMatch(/Accès refusé/i);
    });

    it('should allow both seller and buyer on shared prefinancing route (200)', async () => {
      // 1. Seller access
      vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue({
        id: BigInt(300),
        nom: 'Leader Coop',
        contact: '+237688333333',
        gicId: BigInt(1),
        estLeader: true,
        statut: 'APPROUVE',
        phoneVerified: true,
        isVerified: true,
      } as any);
      vi.mocked(prisma.prefinancingEntry.findMany).mockResolvedValue([]);

      const resSeller = await request(app)
        .get('/api/prefinancing/deals')
        .set('Authorization', `Bearer ${sellerLeaderToken}`);
      expect(resSeller.status).toBe(200);
      expect(resSeller.body).toHaveProperty('deals');

      // 2. Buyer access
      vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
        id: BigInt(100),
        nomEntreprise: 'Entreprise Achat',
        contact: '+237699111111',
        phoneVerified: true,
        isVerified: true,
      } as any);

      const resBuyer = await request(app)
        .get('/api/prefinancing/deals')
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(resBuyer.status).toBe(200);
      expect(resBuyer.body).toHaveProperty('deals');
    });

    it('should allow approved verified seller to access seller routes (/api/gic/profile)', async () => {
      vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue({
        id: BigInt(300),
        nom: 'Leader Coop',
        contact: '+237688333333',
        gicId: BigInt(1),
        estLeader: true,
        statut: 'APPROUVE',
        phoneVerified: true,
        isVerified: true,
      } as any);

      vi.mocked(prisma.gIC.findUnique).mockResolvedValue({
        id: BigInt(1),
        nom: 'GIC des Planteurs',
        identifiantREF: 'GIC-PLANT',
        bassinProduction: { nom: 'Ouest' },
        statutLegalisation: 'APPROUVE',
        activitesPrincipales: 'Cacao',
        agriculteurs: [{ id: BigInt(300), nom: 'Leader Coop', contact: '+237688333333', estLeader: true, timestampMaj: new Date() }],
        timestampMaj: new Date(),
        reglementInterieur: '',
        gicNeedEntries: [],
      } as any);

      const res = await request(app)
        .get('/api/gic/profile')
        .set('Authorization', `Bearer ${sellerLeaderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.profile.name).toBe('GIC des Planteurs');
    });

    it('should allow verified buyer to access buyer routes (/api/buyer/orders)', async () => {
      vi.mocked(prisma.acheteur.findUnique).mockResolvedValue({
        id: BigInt(100),
        nomEntreprise: 'Entreprise Achat',
        contact: '+237699111111',
        phoneVerified: true,
        isVerified: true,
      } as any);

      vi.mocked(prisma.transactionAcheteur.findMany).mockResolvedValue([]);
      vi.mocked(prisma.transactionAcheteur.count).mockResolvedValue(0);

      const res = await request(app)
        .get('/api/buyer/orders')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('orders');
    });
  });
});
