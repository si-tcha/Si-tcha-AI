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
        findUnique: vi.fn(),
      },
      agriculteur: {
        findUnique: vi.fn(),
      },
      recolteOffre: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      gIC: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
    },
  };
});

describe('Catalog & GIC Endpoints — RBAC, Data Fidelity & Error Handling', () => {
  const secret = getJwtSecret();

  const activeBuyerToken = jwt.sign(
    { id: '100', role: 'buyer', phone: '+237699111111', nom: 'Entreprise Achat' },
    secret,
    { expiresIn: '1h' }
  );

  const pendingBuyerToken = jwt.sign(
    { id: '101', role: 'buyer', phone: '+237699111112', nom: 'Acheteur En Attente' },
    secret,
    { expiresIn: '1h' }
  );

  const sellerToken = jwt.sign(
    { id: '200', role: 'seller', phone: '+237677222222', nom: 'Agriculteur' },
    secret,
    { expiresIn: '1h' }
  );

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock user lookup for active buyer
    (prisma.acheteur.findUnique as any).mockImplementation(({ where }: any) => {
      if (where.id === BigInt(100)) {
        return Promise.resolve({
          id: BigInt(100),
          nomEntreprise: 'Entreprise Achat',
          contact: '+237699111111',
          phoneVerified: true,
          isVerified: true,
        });
      }
      if (where.id === BigInt(101)) {
        return Promise.resolve({
          id: BigInt(101),
          nomEntreprise: 'Acheteur En Attente',
          contact: '+237699111112',
          phoneVerified: false,
          isVerified: false,
        });
      }
      return Promise.resolve(null);
    });

    (prisma.agriculteur.findUnique as any).mockImplementation(({ where }: any) => {
      if (where.id === BigInt(200)) {
        return Promise.resolve({
          id: BigInt(200),
          nom: 'Agriculteur',
          contact: '+237677222222',
          gicId: BigInt(10),
          estLeader: false,
          statut: 'APPROUVE',
          phoneVerified: true,
          isVerified: true,
        });
      }
      return Promise.resolve(null);
    });
  });

  describe('Protection & Contrôle d’Accès (RBAC)', () => {
    it('GET /api/catalog/products sans token doit retourner 401', async () => {
      const res = await request(app).get('/api/catalog/products');
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Non autorisé/);
    });

    it('GET /api/catalog/products avec rôle vendeur doit retourner 403', async () => {
      const res = await request(app)
        .get('/api/catalog/products')
        .set('Authorization', `Bearer ${sellerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Accès refusé/);
    });

    it('GET /api/catalog/products avec acheteur inactif doit retourner 403', async () => {
      const res = await request(app)
        .get('/api/catalog/products')
        .set('Authorization', `Bearer ${pendingBuyerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/vérification téléphonique/);
    });

    it('GET /api/gics/public sans token doit retourner 401', async () => {
      const res = await request(app).get('/api/gics/public');
      expect(res.status).toBe(401);
    });

    it('GET /api/gics/public avec rôle vendeur doit retourner 403', async () => {
      const res = await request(app)
        .get('/api/gics/public')
        .set('Authorization', `Bearer ${sellerToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('Fidélité des données Catalogue & Déterminisme', () => {
    it('GET /api/catalog/products pour acheteur actif doit utiliser les vrais prix et unités de ProduitAgricole (aucun 500 en dur)', async () => {
      const mockOffers = [
        {
          id: BigInt(1),
          quantiteDisponible: 150,
          dateDispoEstimee: new Date('2026-09-15T00:00:00.000Z'),
          maturite: 'Mûr',
          photoURL: null,
          produitAgricole: {
            id: BigInt(10),
            nom: 'Cacao Grade 1',
            categorie: 'Fèves',
            prix: { toString: () => '1750.50' },
            unite: 'sac de 50kg',
            imageURL: 'https://images.example.com/cacao.jpg',
          },
          gicId: BigInt(5),
          gic: {
            id: BigInt(5),
            nom: 'GIC Planteurs Unis',
            identifiantREF: 'GIC-PLANTEURS-01',
            bassinProduction: { nom: 'Centre' },
          },
        },
      ];

      (prisma.recolteOffre.findMany as any).mockResolvedValue(mockOffers);
      (prisma.recolteOffre.count as any).mockResolvedValue(1);

      const res = await request(app)
        .get('/api/catalog/products?page=1&limit=10')
        .set('Authorization', `Bearer ${activeBuyerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.products).toHaveLength(1);

      const prod = res.body.products[0];
      expect(prod.id).toBe('1');
      expect(prod.name).toBe('Cacao Grade 1');
      // Prix réel serveur, absolument pas le faux 500
      expect(prod.price).toBe('1750.50');
      expect(prod.price).not.toBe('500');
      // Unité réelle serveur, absolument pas 'régime' ou arbitraire
      expect(prod.unit).toBe('sac de 50kg');
      expect(prod.volumeDisponible).toBe(150);
      expect(prod.dateDispo).toBe('2026-09-15');

      // Vérifier le filtrage et l'ordre déterministe
      expect(prisma.recolteOffre.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            quantiteDisponible: { gt: 0 },
            produitAgricole: { prix: { not: null } },
          },
          orderBy: [{ id: 'asc' }],
          skip: 0,
          take: 10,
        })
      );
    });

    it('GET /api/catalog/products doit retourner les métadonnées de pagination réelles', async () => {
      (prisma.recolteOffre.findMany as any).mockResolvedValue([]);
      (prisma.recolteOffre.count as any).mockResolvedValue(25);

      const res = await request(app)
        .get('/api/catalog/products?page=2&limit=10')
        .set('Authorization', `Bearer ${activeBuyerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.meta).toEqual({
        total: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
      });
    });

    it('GET /api/catalog/products doit propager une vraie erreur HTTP 500 en cas d’échec base de données', async () => {
      (prisma.recolteOffre.findMany as any).mockRejectedValue(new Error('Postgres connection timeout'));

      const res = await request(app)
        .get('/api/catalog/products')
        .set('Authorization', `Bearer ${activeBuyerToken}`);

      // Ne doit JAMAIS retourner HTTP 200 avec une liste vide
      expect(res.status).toBe(500);
      expect(res.body.products).toBeUndefined();
      expect(res.body.message).toBeDefined();
    });

    it('GET /api/gics/public doit retourner les GIC avec ordre déterministe et pagination', async () => {
      const mockGics = [
        {
          id: BigInt(1),
          nom: 'GIC Cacao Ouest',
          identifiantREF: 'REF-001',
          logoURL: 'https://logo.png',
          bassinProduction: { nom: 'Ouest' },
          gicNeedEntries: [],
        },
      ];

      (prisma.gIC.findMany as any).mockResolvedValue(mockGics);
      (prisma.gIC.count as any).mockResolvedValue(1);

      const res = await request(app)
        .get('/api/gics/public?page=1&limit=5')
        .set('Authorization', `Bearer ${activeBuyerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.gics).toHaveLength(1);
      expect(res.body.gics[0].name).toBe('GIC Cacao Ouest');
      expect(prisma.gIC.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ id: 'asc' }],
        })
      );
    });

    it('GET /api/gics/public doit propager une erreur HTTP 500 en cas d’erreur DB', async () => {
      (prisma.gIC.findMany as any).mockRejectedValue(new Error('DB failure'));

      const res = await request(app)
        .get('/api/gics/public')
        .set('Authorization', `Bearer ${activeBuyerToken}`);

      expect(res.status).toBe(500);
    });
  });
});
