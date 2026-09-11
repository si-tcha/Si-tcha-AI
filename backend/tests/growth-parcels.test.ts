import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { getJwtSecret } from '../src/middlewares/auth.js';
import { calculateYieldDrop, isValidIsoDate } from '../src/utils/growthUtils.js';

vi.mock('../src/lib/prisma', () => {
  return {
    default: {
      agriculteur: {
        findUnique: vi.fn(),
      },
      acheteur: {
        findUnique: vi.fn(),
      },
      parcelEntry: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    },
  };
});

describe('Growth Parcels & Yield Drop Tests (Bloc 4)', () => {
  const secret = getJwtSecret();

  const activeSellerGic1Token = jwt.sign(
    { id: '301', role: 'seller', phone: '+237688000001', gicId: '1' },
    secret,
    { expiresIn: '1h' }
  );

  const activeSellerGic2Token = jwt.sign(
    { id: '302', role: 'seller', phone: '+237688000002', gicId: '2' },
    secret,
    { expiresIn: '1h' }
  );

  const pendingSellerToken = jwt.sign(
    { id: '303', role: 'seller', phone: '+237688000003', gicId: '1' },
    secret,
    { expiresIn: '1h' }
  );

  const buyerToken = jwt.sign(
    { id: '101', role: 'buyer', phone: '+237699000001' },
    secret,
    { expiresIn: '1h' }
  );

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock active seller GIC 1
    vi.mocked(prisma.agriculteur.findUnique).mockImplementation(async ({ where }: any) => {
      if (where.contact === '+237688000001' || where.id === BigInt(301)) {
        return {
          id: BigInt(301),
          nom: 'Vendeur GIC 1',
          contact: '+237688000001',
          gicId: BigInt(1),
          statut: 'APPROUVE',
          phoneVerified: true,
        } as any;
      }
      if (where.contact === '+237688000002' || where.id === BigInt(302)) {
        return {
          id: BigInt(302),
          nom: 'Vendeur GIC 2',
          contact: '+237688000002',
          gicId: BigInt(2),
          statut: 'APPROUVE',
          phoneVerified: true,
        } as any;
      }
      if (where.contact === '+237688000003' || where.id === BigInt(303)) {
        return {
          id: BigInt(303),
          nom: 'Vendeur En Attente',
          contact: '+237688000003',
          gicId: BigInt(1),
          statut: 'EN_ATTENTE',
          phoneVerified: true,
        } as any;
      }
      return null;
    });

    vi.mocked(prisma.acheteur.findUnique).mockImplementation(async ({ where }: any) => {
      if (where.contact === '+237699000001' || where.id === BigInt(101)) {
        return {
          id: BigInt(101),
          nomEntreprise: 'Acheteur SARL',
          contact: '+237699000001',
          phoneVerified: true,
        } as any;
      }
      return null;
    });
  });

  describe('1. Authentification et Autorisation (401 & 403)', () => {
    it('should return 401 on GET /api/gic/parcels without token', async () => {
      const res = await request(app).get('/api/gic/parcels');
      expect(res.status).toBe(401);
    });

    it('should return 401 on POST /api/gic/parcels without token', async () => {
      const res = await request(app).post('/api/gic/parcels').send({});
      expect(res.status).toBe(401);
    });

    it('should return 401 on PUT /api/gic/parcels/p-1 without token', async () => {
      const res = await request(app).put('/api/gic/parcels/p-1').send({});
      expect(res.status).toBe(401);
    });

    it('should return 403 on GET /api/gic/parcels with buyer role', async () => {
      const res = await request(app)
        .get('/api/gic/parcels')
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Accès refusé/i);
    });

    it('should return 403 on POST /api/gic/parcels with buyer role', async () => {
      const res = await request(app)
        .post('/api/gic/parcels')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          parcelName: 'Champ 1',
          crop: 'Maïs',
          sowingDate: '2026-04-01',
          estimatedHarvestDate: '2026-08-01',
          estimatedVolumeKg: 1000,
        });
      expect(res.status).toBe(403);
    });

    it('should return 403 on GET /api/gic/parcels with pending seller', async () => {
      const res = await request(app)
        .get('/api/gic/parcels')
        .set('Authorization', `Bearer ${pendingSellerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/producteurs approuvés|EN_ATTENTE/i);
    });
  });

  describe('2. Isolation stricte entre GIC', () => {
    it('should query parcels strictly for the authenticated seller GIC id', async () => {
      vi.mocked(prisma.parcelEntry.findMany).mockResolvedValue([
        {
          id: 'uuid-gic1',
          parcelName: 'Parcelle Nord',
          crop: 'Tomates',
          sowingDate: '2026-03-01',
          stage: 'Floraison',
          estimatedHarvestDate: '2026-06-15',
          estimatedVolumeKg: 2500,
          actualHarvestVolumeKg: null,
          actualHarvestDate: null,
          updatedAt: new Date('2026-03-01T10:00:00Z'),
          gicId: BigInt(1),
        } as any,
      ]);

      const res = await request(app)
        .get('/api/gic/parcels')
        .set('Authorization', `Bearer ${activeSellerGic1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.parcels).toHaveLength(1);
      expect(res.body.parcels[0].parcelName).toBe('Parcelle Nord');

      // Check that findMany was called with gicId: BigInt(1)
      expect(prisma.parcelEntry.findMany).toHaveBeenCalledWith({
        where: { gicId: BigInt(1) },
        orderBy: { updatedAt: 'desc' },
      });
    });

    it('should never trust client-supplied gicId on parcel creation', async () => {
      vi.mocked(prisma.parcelEntry.create).mockImplementation(async ({ data }: any) => ({
        ...data,
        updatedAt: new Date(),
      }));

      const res = await request(app)
        .post('/api/gic/parcels')
        .set('Authorization', `Bearer ${activeSellerGic1Token}`)
        .send({
          parcelName: 'Champ Sud',
          crop: 'Manioc',
          sowingDate: '2026-02-10',
          stage: 'Semis',
          estimatedHarvestDate: '2026-11-10',
          estimatedVolumeKg: 5000,
          gicId: 9999, // Attempted spoof
        });

      expect(res.status).toBe(201);
      // Prisma create was called with GIC from JWT (1), never client 9999
      expect(prisma.parcelEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          gicId: BigInt(1),
          parcelName: 'Champ Sud',
          crop: 'Manioc',
        }),
      });
    });

    it('should refuse (404) when modifying a parcel belonging to another GIC', async () => {
      vi.mocked(prisma.parcelEntry.findFirst).mockResolvedValue(null);

      // Seller 2 attempts to modify Seller 1's parcel
      const res = await request(app)
        .put('/api/gic/parcels/uuid-foreign')
        .set('Authorization', `Bearer ${activeSellerGic2Token}`)
        .send({
          stage: 'Floraison',
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/Parcelle introuvable/i);
      expect(prisma.parcelEntry.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('3. Création valide et génération UUID', () => {
    it('should successfully create parcel with valid payload and generate UUID', async () => {
      vi.mocked(prisma.parcelEntry.create).mockImplementation(async ({ data }: any) => ({
        ...data,
        updatedAt: new Date('2026-05-01T12:00:00Z'),
      }));

      const res = await request(app)
        .post('/api/gic/parcels')
        .set('Authorization', `Bearer ${activeSellerGic1Token}`)
        .send({
          parcelName: 'Parcelle Ouest Bafoussam',
          crop: 'Tomates',
          sowingDate: '2026-05-01',
          stage: 'Semis',
          estimatedHarvestDate: '2026-08-15',
          estimatedVolumeKg: 3000,
        });

      expect(res.status).toBe(201);
      expect(res.body.parcel).toHaveProperty('id');
      // Must NOT be a simple timestamp like Date.now()
      expect(res.body.parcel.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(res.body.parcel.parcelName).toBe('Parcelle Ouest Bafoussam');
      expect(res.body.parcel.yieldDropAlert).toBe(false);
    });
  });

  describe('4. Validation stricte : nombres négatifs, NaN ou incohérents', () => {
    it('should reject negative estimatedVolumeKg', async () => {
      const res = await request(app)
        .post('/api/gic/parcels')
        .set('Authorization', `Bearer ${activeSellerGic1Token}`)
        .send({
          parcelName: 'Champ Test',
          crop: 'Maïs',
          sowingDate: '2026-05-01',
          estimatedHarvestDate: '2026-09-01',
          estimatedVolumeKg: -500,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/validation/i);
    });

    it('should reject zero estimatedVolumeKg', async () => {
      const res = await request(app)
        .post('/api/gic/parcels')
        .set('Authorization', `Bearer ${activeSellerGic1Token}`)
        .send({
          parcelName: 'Champ Test',
          crop: 'Maïs',
          sowingDate: '2026-05-01',
          estimatedHarvestDate: '2026-09-01',
          estimatedVolumeKg: 0,
        });

      expect(res.status).toBe(400);
    });

    it('should reject negative actualHarvestVolumeKg', async () => {
      const res = await request(app)
        .post('/api/gic/parcels')
        .set('Authorization', `Bearer ${activeSellerGic1Token}`)
        .send({
          parcelName: 'Champ Test',
          crop: 'Maïs',
          sowingDate: '2026-05-01',
          estimatedHarvestDate: '2026-09-01',
          estimatedVolumeKg: 1000,
          actualHarvestVolumeKg: -10,
        });

      expect(res.status).toBe(400);
    });

    it('should reject string or NaN as volume', async () => {
      const res = await request(app)
        .post('/api/gic/parcels')
        .set('Authorization', `Bearer ${activeSellerGic1Token}`)
        .send({
          parcelName: 'Champ Test',
          crop: 'Maïs',
          sowingDate: '2026-05-01',
          estimatedHarvestDate: '2026-09-01',
          estimatedVolumeKg: 'mille kilos' as any,
        });

      expect(res.status).toBe(400);
    });
  });

  describe('5. Validation stricte : dates invalides et incohérences chronologiques', () => {
    it('should reject invalid date strings (not YYYY-MM-DD)', async () => {
      const res = await request(app)
        .post('/api/gic/parcels')
        .set('Authorization', `Bearer ${activeSellerGic1Token}`)
        .send({
          parcelName: 'Champ Dates',
          crop: 'Tomates',
          sowingDate: '01/05/2026', // Format non ISO
          estimatedHarvestDate: '2026-08-15',
          estimatedVolumeKg: 1000,
        });

      expect(res.status).toBe(400);
      expect(res.body.errors[0].message).toMatch(/Date de semis invalide/i);
    });

    it('should reject impossible calendar dates (ex: 2026-02-31)', async () => {
      expect(isValidIsoDate('2026-02-31')).toBe(false);
      expect(isValidIsoDate('2026-04-31')).toBe(false);
      expect(isValidIsoDate('2026-02-28')).toBe(true);

      const res = await request(app)
        .post('/api/gic/parcels')
        .set('Authorization', `Bearer ${activeSellerGic1Token}`)
        .send({
          parcelName: 'Champ Calendrier',
          crop: 'Tomates',
          sowingDate: '2026-02-31',
          estimatedHarvestDate: '2026-08-15',
          estimatedVolumeKg: 1000,
        });

      expect(res.status).toBe(400);
    });

    it('should reject when estimatedHarvestDate is before sowingDate', async () => {
      const res = await request(app)
        .post('/api/gic/parcels')
        .set('Authorization', `Bearer ${activeSellerGic1Token}`)
        .send({
          parcelName: 'Champ Incohérent',
          crop: 'Tomates',
          sowingDate: '2026-08-15',
          estimatedHarvestDate: '2026-05-01', // Before sowing!
          estimatedVolumeKg: 1000,
        });

      expect(res.status).toBe(400);
      expect(res.body.errors[0].message).toMatch(/ne peut pas être antérieure/i);
    });
  });

  describe('6. Mise à jour de parcelle (étape de croissance, récolte réelle)', () => {
    it('should successfully update parcel stage and harvest volume', async () => {
      vi.mocked(prisma.parcelEntry.findFirst).mockResolvedValue({
        id: 'uuid-1',
        parcelName: 'Parcelle 1',
        crop: 'Tomates',
        sowingDate: '2026-04-01',
        stage: 'Maturation',
        estimatedHarvestDate: '2026-07-01',
        estimatedVolumeKg: 2000,
        actualHarvestVolumeKg: null,
        actualHarvestDate: null,
        updatedAt: new Date('2026-04-01'),
        gicId: BigInt(1),
      } as any);

      vi.mocked(prisma.parcelEntry.updateMany).mockResolvedValue({ count: 1 } as any);

      vi.mocked(prisma.parcelEntry.findUnique).mockResolvedValue({
        id: 'uuid-1',
        parcelName: 'Parcelle 1',
        crop: 'Tomates',
        sowingDate: '2026-04-01',
        stage: 'Prêt à récolter',
        estimatedHarvestDate: '2026-07-01',
        estimatedVolumeKg: 2000,
        actualHarvestVolumeKg: 1600, // 20% drop -> alert!
        actualHarvestDate: '2026-07-02',
        updatedAt: new Date('2026-07-02T15:00:00Z'),
        gicId: BigInt(1),
      } as any);

      const res = await request(app)
        .put('/api/gic/parcels/uuid-1')
        .set('Authorization', `Bearer ${activeSellerGic1Token}`)
        .send({
          stage: 'Prêt à récolter',
          actualHarvestVolumeKg: 1600,
          actualHarvestDate: '2026-07-02',
        });

      expect(res.status).toBe(200);
      expect(res.body.parcel.stage).toBe('Prêt à récolter');
      expect(res.body.parcel.actualHarvestVolumeKg).toBe(1600);
      expect(res.body.parcel.yieldDropPercent).toBe(20);
      expect(res.body.parcel.yieldDropAlert).toBe(true);
    });

    it('should reject empty body with 400', async () => {
      const res = await request(app)
        .put('/api/gic/parcels/uuid-1')
        .set('Authorization', `Bearer ${activeSellerGic1Token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should reject when actualHarvestVolumeKg is set without actualHarvestDate', async () => {
      vi.mocked(prisma.parcelEntry.findFirst).mockResolvedValue({
        id: 'uuid-1',
        parcelName: 'Parcelle 1',
        crop: 'Tomates',
        sowingDate: '2026-04-01',
        stage: 'Maturation',
        estimatedHarvestDate: '2026-07-01',
        estimatedVolumeKg: 2000,
        actualHarvestVolumeKg: null,
        actualHarvestDate: null,
        updatedAt: new Date('2026-04-01'),
        gicId: BigInt(1),
      } as any);

      const res = await request(app)
        .put('/api/gic/parcels/uuid-1')
        .set('Authorization', `Bearer ${activeSellerGic1Token}`)
        .send({
          actualHarvestVolumeKg: 500,
          // actualHarvestDate missing!
        });

      expect(res.status).toBe(400);
    });

    it('should reject stage Récolté when actual volume and date are not provided', async () => {
      vi.mocked(prisma.parcelEntry.findFirst).mockResolvedValue({
        id: 'uuid-1',
        parcelName: 'Parcelle 1',
        crop: 'Tomates',
        sowingDate: '2026-04-01',
        stage: 'Maturation',
        estimatedHarvestDate: '2026-07-01',
        estimatedVolumeKg: 2000,
        actualHarvestVolumeKg: null,
        actualHarvestDate: null,
        updatedAt: new Date('2026-04-01'),
        gicId: BigInt(1),
      } as any);

      const res = await request(app)
        .put('/api/gic/parcels/uuid-1')
        .set('Authorization', `Bearer ${activeSellerGic1Token}`)
        .send({
          stage: 'Récolté',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Récolté/i);
    });

    it('should return 404 if updateMany affects 0 rows', async () => {
      vi.mocked(prisma.parcelEntry.findFirst).mockResolvedValue({
        id: 'uuid-1',
        parcelName: 'Parcelle 1',
        crop: 'Tomates',
        sowingDate: '2026-04-01',
        stage: 'Maturation',
        estimatedHarvestDate: '2026-07-01',
        estimatedVolumeKg: 2000,
        actualHarvestVolumeKg: null,
        actualHarvestDate: null,
        updatedAt: new Date('2026-04-01'),
        gicId: BigInt(1),
      } as any);

      vi.mocked(prisma.parcelEntry.updateMany).mockResolvedValue({ count: 0 } as any);

      const res = await request(app)
        .put('/api/gic/parcels/uuid-1')
        .set('Authorization', `Bearer ${activeSellerGic1Token}`)
        .send({
          stage: 'Floraison',
        });

      expect(res.status).toBe(404);
    });

    it('should reject volume exceeding 1 000 000 kg', async () => {
      const res = await request(app)
        .post('/api/gic/parcels')
        .set('Authorization', `Bearer ${activeSellerGic1Token}`)
        .send({
          parcelName: 'Champ Géant',
          crop: 'Maïs',
          sowingDate: '2026-05-01',
          estimatedHarvestDate: '2026-09-01',
          estimatedVolumeKg: 2_000_000,
        });

      expect(res.status).toBe(400);
    });
  });

  describe('7. Calcul exact du seuil de baisse de rendement (> 15 %)', () => {
    it('should NOT trigger alert if harvest is equal or greater than estimate', () => {
      expect(calculateYieldDrop(100, 100)).toEqual({ dropPercent: 0, isDropAlert: false });
      expect(calculateYieldDrop(100, 120)).toEqual({ dropPercent: 0, isDropAlert: false });
    });

    it('should NOT trigger alert if actualHarvestVolume is not set or zero estimate', () => {
      expect(calculateYieldDrop(100, null)).toEqual({ dropPercent: 0, isDropAlert: false });
      expect(calculateYieldDrop(100, undefined)).toEqual({ dropPercent: 0, isDropAlert: false });
      expect(calculateYieldDrop(0, 50)).toEqual({ dropPercent: 0, isDropAlert: false });
    });

    it('should NOT trigger alert for EXACT 15% drop (85 kg harvested for 100 kg estimate)', () => {
      // 100 - 85 = 15 kg -> 15.0%
      const result = calculateYieldDrop(100, 85);
      expect(result.dropPercent).toBe(15);
      expect(result.isDropAlert).toBe(false); // Strictly > 15%, so 15.0% is NOT an alert
    });

    it('should NOT trigger alert if drop is just below 15% (85.01 kg harvested for 100 kg)', () => {
      const result = calculateYieldDrop(100, 85.01);
      expect(result.dropPercent).toBe(14.99);
      expect(result.isDropAlert).toBe(false);
    });

    it('should trigger alert if drop strictly exceeds 15% (84.99 kg harvested for 100 kg)', () => {
      const result = calculateYieldDrop(100, 84.99);
      expect(result.dropPercent).toBe(15.01);
      expect(result.isDropAlert).toBe(true);
    });

    it('should trigger alert for 20% drop (80 kg harvested for 100 kg)', () => {
      const result = calculateYieldDrop(100, 80);
      expect(result.dropPercent).toBe(20);
      expect(result.isDropAlert).toBe(true);
    });

    it('should trigger alert for total loss (0 kg harvested for 100 kg)', () => {
      const result = calculateYieldDrop(100, 0);
      expect(result.dropPercent).toBe(100);
      expect(result.isDropAlert).toBe(true);
    });
  });

  describe('8. Compatibilité de la migration ParcelEntry avec le Bloc 3 & Idempotence', () => {
    it('la migration SQL contient l instruction forward-only ALTER TABLE ADD COLUMN IF NOT EXISTS actualHarvestDate', () => {
      const fs = require('fs');
      const path = require('path');
      const migrationPath = path.resolve(
        __dirname,
        '../prisma/migrations/20260909000001_add_bloc4_tables_parcel_entry/migration.sql'
      );
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sql = fs.readFileSync(migrationPath, 'utf8');

      // Vérifier que la table ParcelEntry est créée avec actualHarvestDate
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "ParcelEntry"/);
      // Vérifier que l instruction indépendante forward-only est présente
      expect(sql).toMatch(/ALTER TABLE "ParcelEntry"\s+ADD COLUMN IF NOT EXISTS "actualHarvestDate"\s+VARCHAR\(50\);/i);
    });

    const postgresIt = process.env.DATABASE_TEST_URL ? it : it.skip;
    postgresIt('simule la transition de schéma sur PostgreSQL réel', async () => {
      const { Client } = require('pg');
      const client = new Client({
        connectionString: process.env.DATABASE_TEST_URL,
      });

      await client.connect();
      try {
          // 1. Créer une table de test simulant l état après migration Bloc 3 (SANS actualHarvestDate)
          await client.query('DROP TABLE IF EXISTS "ParcelEntry_CompatTest";');
          await client.query(`
            CREATE TABLE "ParcelEntry_CompatTest" (
              "id" TEXT NOT NULL PRIMARY KEY,
              "parcelName" VARCHAR(200) NOT NULL,
              "crop" VARCHAR(100) NOT NULL,
              "sowingDate" VARCHAR(50) NOT NULL,
              "stage" VARCHAR(50) NOT NULL,
              "estimatedHarvestDate" VARCHAR(50) NOT NULL,
              "estimatedVolumeKg" DOUBLE PRECISION NOT NULL,
              "actualHarvestVolumeKg" DOUBLE PRECISION,
              "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "gicId" TEXT NOT NULL
            );
          `);

          // 2. Vérifier que la colonne actualHarvestDate n existe pas
          const checkBefore = await client.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'ParcelEntry_CompatTest' AND column_name = 'actualHarvestDate';
          `);
          expect(checkBefore.rows.length).toBe(0);

          // 3. Appliquer l instruction forward-only de la migration Bloc 4
          await client.query(`
            ALTER TABLE "ParcelEntry_CompatTest"
            ADD COLUMN IF NOT EXISTS "actualHarvestDate" VARCHAR(50);
          `);

          // 4. Vérifier que la colonne actualHarvestDate existe désormais
          const checkAfter = await client.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'ParcelEntry_CompatTest' AND column_name = 'actualHarvestDate';
          `);
          expect(checkAfter.rows.length).toBe(1);

          // 5. Réapplication idempotente : doit s exécuter sans erreur
          await expect(
            client.query(`
              ALTER TABLE "ParcelEntry_CompatTest"
              ADD COLUMN IF NOT EXISTS "actualHarvestDate" VARCHAR(50);
            `)
          ).resolves.toBeDefined();

          // Nettoyage
          await client.query('DROP TABLE IF EXISTS "ParcelEntry_CompatTest";');
      } finally {
        await client.end();
      }
    });
  });
});
