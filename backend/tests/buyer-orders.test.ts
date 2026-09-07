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
        findUnique: vi.fn(),
        updateMany: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      transactionAcheteur: {
        findMany: vi.fn(),
        create: vi.fn(),
        count: vi.fn(),
      },
      $transaction: vi.fn(),
    },
  };
});

describe('Buyer Orders Endpoints — Atomic Creation, Stock Control, Idempotency & History', () => {
  const secret = getJwtSecret();

  const buyer1Token = jwt.sign(
    { id: '100', role: 'buyer', phone: '+237699111111', nom: 'Buyer One' },
    secret,
    { expiresIn: '1h' }
  );

  const buyer2Token = jwt.sign(
    { id: '200', role: 'buyer', phone: '+237699222222', nom: 'Buyer Two' },
    secret,
    { expiresIn: '1h' }
  );

  const sellerToken = jwt.sign(
    { id: '300', role: 'seller', phone: '+237677333333', nom: 'Seller' },
    secret,
    { expiresIn: '1h' }
  );

  beforeEach(() => {
    vi.clearAllMocks();

    (prisma.transactionAcheteur.findMany as any).mockResolvedValue([]);
    (prisma.transactionAcheteur.count as any).mockResolvedValue(0);
    (prisma.recolteOffre.updateMany as any).mockResolvedValue({ count: 1 });

    (prisma.acheteur.findUnique as any).mockImplementation(({ where }: any) => {
      if (where.id === BigInt(100)) {
        return Promise.resolve({
          id: BigInt(100),
          nomEntreprise: 'Buyer One Corp',
          contact: '+237699111111',
          phoneVerified: true,
          isVerified: true,
        });
      }
      if (where.id === BigInt(200)) {
        return Promise.resolve({
          id: BigInt(200),
          nomEntreprise: 'Buyer Two Corp',
          contact: '+237699222222',
          phoneVerified: true,
          isVerified: true,
        });
      }
      return Promise.resolve(null);
    });

    (prisma.agriculteur.findUnique as any).mockImplementation(({ where }: any) => {
      if (where.id === BigInt(300)) {
        return Promise.resolve({
          id: BigInt(300),
          nom: 'Seller Corp',
          contact: '+237677333333',
          phoneVerified: true,
          isVerified: true,
          statut: 'APPROUVE',
          gicId: BigInt(10),
          estLeader: false,
        });
      }
      return Promise.resolve(null);
    });

    (prisma.$transaction as any).mockImplementation(async (callback: any) => {
      // Exécute la transaction avec le mock prisma lui-même comme client transactionnel
      return await callback(prisma);
    });
  });

  describe('Validation des Payloads & Protection (400, 401, 403)', () => {
    it('doit refuser l’accès sans token (401)', async () => {
      const res = await request(app)
        .post('/api/buyer/orders')
        .send({ type: 'commande_ferme', items: [{ productId: '1', quantity: 10 }] });
      expect(res.status).toBe(401);
    });

    it('doit refuser l’accès aux non-acheteurs (403)', async () => {
      const res = await request(app)
        .post('/api/buyer/orders')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ type: 'commande_ferme', items: [{ productId: '1', quantity: 10 }] });
      expect(res.status).toBe(403);
    });

    it('doit rejeter une requête sans type ou avec type invalide (400)', async () => {
      const res = await request(app)
        .post('/api/buyer/orders')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({ type: 'invalid_type', items: [{ productId: '1', quantity: 10 }] });
      expect(res.status).toBe(400);
    });

    it('doit rejeter un panier vide (400)', async () => {
      const res = await request(app)
        .post('/api/buyer/orders')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({ type: 'commande_ferme', items: [] });
      expect(res.status).toBe(400);
    });

    it('doit rejeter une quantité nulle ou négative (400)', async () => {
      const res = await request(app)
        .post('/api/buyer/orders')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({ type: 'commande_ferme', items: [{ productId: '1', quantity: 0 }] });
      expect(res.status).toBe(400);
    });

    it('doit refuser les doublons d’une même offre dans la requête (400)', async () => {
      const res = await request(app)
        .post('/api/buyer/orders')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({
          type: 'commande_ferme',
          items: [
            { productId: '1', quantity: 10 },
            { productId: '1', quantity: 5 },
          ],
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Articles en double/);
    });
  });

  describe('Validation Métier : Offre Inexistante, Prix Absent, Stock Insuffisant', () => {
    it('doit retourner 404 si une offre n’existe pas', async () => {
      (prisma.recolteOffre.findUnique as any).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/buyer/orders')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({
          type: 'commande_ferme',
          items: [{ productId: '999', quantity: 10 }],
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/L'offre 999 n'existe pas/);
    });

    it('doit retourner 400 si un produit ne possède pas de prix serveur valide', async () => {
      (prisma.recolteOffre.findUnique as any).mockResolvedValue({
        id: BigInt(1),
        quantiteDisponible: 100,
        produitAgricole: { nom: 'Maïs', prix: null, unite: 'kg' },
        gic: { id: BigInt(10), nom: 'GIC Test' },
      });

      const res = await request(app)
        .post('/api/buyer/orders')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({
          type: 'commande_ferme',
          items: [{ productId: '1', quantity: 10 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/prix serveur valide/);
    });

    it('doit retourner 409 si le stock disponible est insuffisant', async () => {
      (prisma.recolteOffre.findUnique as any).mockResolvedValue({
        id: BigInt(1),
        quantiteDisponible: 15, // Seulement 15 disponible
        produitAgricole: { nom: 'Cacao', prix: 1500, unite: 'kg' },
        gic: { id: BigInt(10), nom: 'GIC Cacao' },
      });

      const res = await request(app)
        .post('/api/buyer/orders')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({
          type: 'commande_ferme',
          items: [{ productId: '1', quantity: 20 }], // Demande 20
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/Stock insuffisant/);
    });
  });

  describe('Création Atomique, Transaction & Décrément du Stock', () => {
    it('doit créer la commande avec le prix serveur, statut en_attente, date réelle, et décrémenter le stock exactement', async () => {
      const mockOffer = {
        id: BigInt(1),
        quantiteDisponible: 100,
        produitAgricole: { nom: 'Café Robusta', prix: { toString: () => '2500' }, unite: 'kg' },
        gic: { id: BigInt(10), nom: 'Coop Café' },
      };

      (prisma.recolteOffre.findUnique as any).mockResolvedValue(mockOffer);
      (prisma.recolteOffre.updateMany as any).mockResolvedValue({ count: 1 });
      (prisma.transactionAcheteur.create as any).mockResolvedValue({
        id: BigInt(501),
        acheteurId: BigInt(100),
        type: 'commande_ferme',
        quantite: 25,
        prixConvenu: { toString: () => '2500' },
        statut: 'en_attente',
        recolteOffreId: BigInt(1),
        clientRequestId: 'req-abc-123',
        createdAt: new Date('2026-09-07T10:00:00.000Z'),
        recolteOffre: mockOffer,
      });

      const res = await request(app)
        .post('/api/buyer/orders')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({
          type: 'commande_ferme',
          clientRequestId: 'req-abc-123',
          items: [{ productId: '1', quantity: 25 }],
        });

      expect(res.status).toBe(201);
      expect(res.body.orders).toHaveLength(1);

      const order = res.body.orders[0];
      expect(order.id).toBe('501');
      expect(order.buyerId).toBe('100');
      expect(order.type).toBe('commande_ferme');
      expect(order.status).toBe('en_attente');
      // Prix provient impérativement du serveur (2500, pas de 500 arbitraire)
      expect(order.price).toBe('2500');
      expect(order.unit).toBe('kg');
      expect(order.quantity).toBe(25);
      expect(order.createdAt).toBe('2026-09-07T10:00:00.000Z');

      // Vérifier le décrément atomique conditionnel
      expect(prisma.recolteOffre.updateMany).toHaveBeenCalledWith({
        where: {
          id: BigInt(1),
          quantiteDisponible: { gte: 25 },
        },
        data: {
          quantiteDisponible: { decrement: 25 },
          timestampMaj: expect.any(Date),
        },
      });
    });

    it('doit annuler TOUTE la commande (rollback atomique) si un article échoue dans un panier multiarticles (aucun résultat partiel)', async () => {
      const offer1 = {
        id: BigInt(1),
        quantiteDisponible: 50,
        produitAgricole: { nom: 'Banane Plantain', prix: 400, unite: 'régime' },
        gic: { id: BigInt(10), nom: 'GIC 1' },
      };
      const offer2 = {
        id: BigInt(2),
        quantiteDisponible: 10,
        produitAgricole: { nom: 'Manioc', prix: 300, unite: 'sac' },
        gic: { id: BigInt(10), nom: 'GIC 1' },
      };

      (prisma.recolteOffre.findUnique as any).mockImplementation(({ where }: any) => {
        if (where.id === BigInt(1)) return Promise.resolve(offer1);
        if (where.id === BigInt(2)) return Promise.resolve(offer2);
        return Promise.resolve(null);
      });

      // Le premier article réussit le décrément, mais le deuxième échoue par conflit concurrent (count = 0)
      (prisma.recolteOffre.updateMany as any).mockImplementation(({ where }: any) => {
        if (where.id === BigInt(1)) return Promise.resolve({ count: 1 });
        if (where.id === BigInt(2)) return Promise.resolve({ count: 0 }); // Conflit / plus assez
        return Promise.resolve({ count: 0 });
      });

      const res = await request(app)
        .post('/api/buyer/orders')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({
          type: 'achat_direct',
          items: [
            { productId: '1', quantity: 20 },
            { productId: '2', quantity: 10 },
          ],
        });

      // Toute la transaction est rejetée avec 409
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/Stock insuffisant ou conflit/);
    });

    it('doit empêcher le surstockage concurrent si count vaut 0 lors de updateMany', async () => {
      const offer = {
        id: BigInt(1),
        quantiteDisponible: 5,
        produitAgricole: { nom: 'Poivre de Penja', prix: 10000, unite: 'kg' },
        gic: { id: BigInt(20), nom: 'Coop Poivre' },
      };

      (prisma.recolteOffre.findUnique as any).mockResolvedValue(offer);
      // Simule qu'une autre requête a pris le stock juste avant nous
      (prisma.recolteOffre.updateMany as any).mockResolvedValue({ count: 0 });

      const res = await request(app)
        .post('/api/buyer/orders')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({
          type: 'achat_direct',
          items: [{ productId: '1', quantity: 5 }],
        });

      expect(res.status).toBe(409);
      expect(prisma.transactionAcheteur.create).not.toHaveBeenCalled();
    });
  });

  describe('Idempotence Fiable (clientRequestId)', () => {
    it('une répétition avec le même clientRequestId et même payload doit retourner les commandes existantes sans décrémenter à nouveau le stock (200)', async () => {
      const existingTxs = [
        {
          id: BigInt(701),
          acheteurId: BigInt(100),
          type: 'commande_ferme',
          quantite: 50,
          prixConvenu: { toString: () => '1800' },
          statut: 'en_attente',
          recolteOffreId: BigInt(1),
          clientRequestId: 'idempotent-uuid-001',
          createdAt: new Date('2026-09-07T11:00:00.000Z'),
          recolteOffre: {
            id: BigInt(1),
            produitAgricole: { nom: 'Cacao', prix: 1800, unite: 'kg' },
            gic: { id: BigInt(10), nom: 'GIC Cacao' },
          },
        },
      ];

      (prisma.transactionAcheteur.findMany as any).mockResolvedValue(existingTxs);

      const res = await request(app)
        .post('/api/buyer/orders')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({
          type: 'commande_ferme',
          clientRequestId: 'idempotent-uuid-001',
          items: [{ productId: '1', quantity: 50 }],
        });

      expect(res.status).toBe(200);
      expect(res.body.idempotentReplay).toBe(true);
      expect(res.body.orders).toHaveLength(1);
      expect(res.body.orders[0].id).toBe('701');

      // Aucune opération de décrément ni de création transaction ne doit avoir été exécutée !
      expect(prisma.recolteOffre.updateMany).not.toHaveBeenCalled();
      expect(prisma.transactionAcheteur.create).not.toHaveBeenCalled();
    });

    it('doit retourner 409 Conflict si un clientRequestId existant est réutilisé avec un contenu différent', async () => {
      const existingTxs = [
        {
          id: BigInt(701),
          acheteurId: BigInt(100),
          type: 'commande_ferme',
          quantite: 50,
          recolteOffreId: BigInt(1),
          clientRequestId: 'idempotent-uuid-001',
          recolteOffre: { produitAgricole: { nom: 'Cacao' }, gic: { nom: 'GIC' } },
        },
      ];

      (prisma.transactionAcheteur.findMany as any).mockResolvedValue(existingTxs);

      // Envoi avec une quantité différente (75 au lieu de 50)
      const res = await request(app)
        .post('/api/buyer/orders')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({
          type: 'commande_ferme',
          clientRequestId: 'idempotent-uuid-001',
          items: [{ productId: '1', quantity: 75 }],
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/Conflit d'idempotence/);
      expect(prisma.recolteOffre.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('Isolation des Acheteurs & Historique Réel (GET /api/buyer/orders)', () => {
    it('GET /api/buyer/orders ne doit retourner que les commandes de l’acheteur connecté avec leurs vraies dates persistées', async () => {
      const buyer1Orders = [
        {
          id: BigInt(801),
          acheteurId: BigInt(100),
          type: 'commande_ferme',
          quantite: 30,
          prixConvenu: { toString: () => '1500' },
          statut: 'en_attente',
          recolteOffreId: BigInt(1),
          createdAt: new Date('2026-09-06T15:30:00.000Z'),
          recolteOffre: {
            id: BigInt(1),
            produitAgricole: { nom: 'Cacao Extra', unite: 'kg' },
            gic: { id: BigInt(10), nom: 'GIC Ouest' },
          },
        },
      ];

      (prisma.transactionAcheteur.findMany as any).mockResolvedValue(buyer1Orders);
      (prisma.transactionAcheteur.count as any).mockResolvedValue(1);

      const res = await request(app)
        .get('/api/buyer/orders?page=1&limit=10')
        .set('Authorization', `Bearer ${buyer1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.orders).toHaveLength(1);

      const o = res.body.orders[0];
      expect(o.id).toBe('801');
      expect(o.buyerId).toBe('100');
      // Date persistée stable (ne change pas à chaque appel)
      expect(o.createdAt).toBe('2026-09-06T15:30:00.000Z');

      // Vérifier le filtrage strict par acheteurId
      expect(prisma.transactionAcheteur.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { acheteurId: BigInt(100) },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        })
      );
    });

    it('acheteur 2 ne doit pas voir les commandes de l’acheteur 1', async () => {
      (prisma.transactionAcheteur.findMany as any).mockResolvedValue([]);
      (prisma.transactionAcheteur.count as any).mockResolvedValue(0);

      const res = await request(app)
        .get('/api/buyer/orders')
        .set('Authorization', `Bearer ${buyer2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.orders).toHaveLength(0);

      expect(prisma.transactionAcheteur.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { acheteurId: BigInt(200) },
        })
      );
    });

    it('doit propager une erreur HTTP 500 si la base échoue dans GET /api/buyer/orders', async () => {
      (prisma.transactionAcheteur.findMany as any).mockRejectedValue(new Error('DB failure'));

      const res = await request(app)
        .get('/api/buyer/orders')
        .set('Authorization', `Bearer ${buyer1Token}`);

      expect(res.status).toBe(500);
    });
  });
});
