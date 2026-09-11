import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

// 1. Validation stricte de la variable d'environnement TEST_DATABASE_URL
const testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl) {
  throw new Error(
    "TEST_DATABASE_URL obligatoire pour exécuter buyer-orders-concurrent.test.ts. " +
    "Ce test requiert une instance PostgreSQL de test dédiée. Exemple : " +
    "TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5438/sitcha_test?schema=public"
  );
}

// 2. Refuser de démarrer si le nom de la base ne contient pas explicitement 'test'
const parsedDbUrl = new URL(testDbUrl);
const dbName = parsedDbUrl.pathname.replace(/^\//, '').toLowerCase();
if (!dbName.includes('test')) {
  throw new Error(
    `Refus de démarrer : la base cible '${dbName}' ne porte pas un nom manifestement réservé aux tests (doit contenir 'test').`
  );
}

// Forcer DATABASE_URL pour l'app
process.env.DATABASE_URL = testDbUrl;

// Import dynamique après assignation de DATABASE_URL
const { default: app } = await import('../src/app.js');
const { default: prisma } = await import('../src/lib/prisma.js');
const { getJwtSecret } = await import('../src/middlewares/auth.js');

describe('Buyer Orders Real PostgreSQL Concurrency & Idempotency Integration Test', () => {
  const secret = getJwtSecret();

  // Identifiants générés dynamiquement par exécution pour garantir l'isolation complète
  const seed = Math.floor(100000 + Math.random() * 900000);
  const testBuyerId = String(9000000 + seed);
  const testOfferId = String(9100000 + seed);
  const testProductId = String(9200000 + seed);
  const testGicId = String(9300000 + seed);
  const testBassinId = String(9400000 + seed);
  const testPhone = `+23769${seed.toString().padStart(6, '0')}`;

  const testBuyerToken = jwt.sign(
    { id: testBuyerId, role: 'buyer', phone: testPhone, nom: 'Concurrent Buyer Corp' },
    secret,
    { expiresIn: '1h' }
  );

  const cleanupData = async () => {
    try {
      await prisma.transactionAcheteur.deleteMany({
        where: { recolteOffreId: BigInt(testOfferId) },
      });
    } catch {}
    try {
      await prisma.recolteOffre.deleteMany({
        where: { id: BigInt(testOfferId) },
      });
    } catch {}
    try {
      await prisma.gIC.deleteMany({
        where: { id: BigInt(testGicId) },
      });
    } catch {}
    try {
      await prisma.bassinProduction.deleteMany({
        where: { id: BigInt(testBassinId) },
      });
    } catch {}
    try {
      await prisma.produitAgricole.deleteMany({
        where: { id: BigInt(testProductId) },
      });
    } catch {}
    try {
      await prisma.acheteur.deleteMany({
        where: { id: BigInt(testBuyerId) },
      });
    } catch {}
  };

  beforeAll(async () => {
    try {
      await cleanupData();

      // 1. Acheteur
      await prisma.acheteur.create({
        data: {
          id: BigInt(testBuyerId),
          nomEntreprise: 'Concurrent Buyer Corp',
          contact: testPhone,
          phoneVerified: true,
          isVerified: true,
        },
      });

      // 2. BassinProduction
      await prisma.bassinProduction.create({
        data: {
          id: BigInt(testBassinId),
          nom: `Bassin Concurrency ${seed}`,
          region: 'Littoral',
          latitude: 4.05,
          longitude: 9.71,
        },
      });

      // 3. ProduitAgricole avec prix réel
      await prisma.produitAgricole.create({
        data: {
          id: BigInt(testProductId),
          nom: `Café Arabica Concurrent ${seed}`,
          categorie: 'Café',
          prix: 3000,
          unite: 'kg',
        },
      });

      // 4. GIC
      await prisma.gIC.create({
        data: {
          id: BigInt(testGicId),
          nom: `GIC Concurrency ${seed}`,
          logoURL: 'https://example.com/logo.png',
          activitesPrincipales: 'Production Café',
          identifiantREF: `GIC-CONC-${seed}`,
          statutLegalisation: 'LEGALISE',
          timestampMaj: new Date(),
          bassinProductionId: BigInt(testBassinId),
        },
      });

      // 5. RecolteOffre avec stock initial 100
      await prisma.recolteOffre.create({
        data: {
          id: BigInt(testOfferId),
          produitAgricoleId: BigInt(testProductId),
          gicId: BigInt(testGicId),
          quantiteEstimee: 100,
          quantiteDisponible: 100,
          dateDispoEstimee: new Date('2026-09-15'),
          maturite: 'MURE',
          timestampMaj: new Date(),
        },
      });
    } catch (err) {
      await cleanupData();
      throw err;
    }
  });

  afterAll(async () => {
    try {
      await cleanupData();
    } finally {
      await prisma.$disconnect();
    }
  });

  it('deux requêtes hautement concurrentes avec le même clientRequestId aboutissent à une création et un rejeu idempotent, sans faux 409 et stock décrémenté UNE SEULE FOIS', async () => {
    const clientRequestId = randomUUID();
    const orderPayload = {
      type: 'commande_ferme',
      clientRequestId,
      items: [{ productId: testOfferId, quantity: 15 }],
    };

    // Lancer deux requêtes POST en concurrence absolue
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/buyer/orders')
        .set('Authorization', `Bearer ${testBuyerToken}`)
        .send(orderPayload),
      request(app)
        .post('/api/buyer/orders')
        .set('Authorization', `Bearer ${testBuyerToken}`)
        .send(orderPayload),
    ]);

    const statuses = [res1.status, res2.status].sort();
    // Grâce au pg_advisory_xact_lock déterministe, les deux transactions se sérialisent proprement :
    // La 1ère obtient 201 Created. La 2ème attend la fin du commit, trouve la commande existante et renvoie 200 OK avec idempotentReplay = true.
    expect(statuses).toEqual([200, 201]);

    const replayRes = res1.status === 200 ? res1 : res2;
    const createRes = res1.status === 201 ? res1 : res2;

    expect(createRes.body.orders).toHaveLength(1);
    expect(replayRes.body.idempotentReplay).toBe(true);
    expect(replayRes.body.orders).toHaveLength(1);

    // Les IDs de commande doivent être strictement identiques
    expect(replayRes.body.orders[0].id).toBe(createRes.body.orders[0].id);
    expect(createRes.body.orders[0].price).toBe('3000');
    expect(createRes.body.orders[0].quantity).toBe(15);

    // Vérifier la persistance exacte dans PostgreSQL réel :
    const dbOffer = await prisma.recolteOffre.findUnique({
      where: { id: BigInt(testOfferId) },
    });
    // Stock initial était 100, décrémenté de 15 => 85 (NON 70 !)
    expect(Number(dbOffer?.quantiteDisponible)).toBe(85);

    // Vérifier qu'une seule transaction existe dans TransactionAcheteur
    const transactions = await prisma.transactionAcheteur.findMany({
      where: {
        acheteurId: BigInt(testBuyerId),
        clientRequestId,
      },
    });
    expect(transactions).toHaveLength(1);
    expect(Number(transactions[0].quantite)).toBe(15);
  });

  it('même clientRequestId avec un payload différent retourne 409 Conflict et ne décrémente pas le stock', async () => {
    const clientRequestId = randomUUID();

    // 1ère commande réussie
    const firstRes = await request(app)
      .post('/api/buyer/orders')
      .set('Authorization', `Bearer ${testBuyerToken}`)
      .send({
        type: 'commande_ferme',
        clientRequestId,
        items: [{ productId: testOfferId, quantity: 10 }],
      });
    expect(firstRes.status).toBe(201);

    // 2ème commande réutilisant le même clientRequestId avec payload conflictuel
    const conflictingPayload = {
      type: 'commande_ferme',
      clientRequestId,
      items: [{ productId: testOfferId, quantity: 20 }], // Quantité différente
    };

    const res = await request(app)
      .post('/api/buyer/orders')
      .set('Authorization', `Bearer ${testBuyerToken}`)
      .send(conflictingPayload);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/Conflit d'idempotence/);

    // Le stock ne doit avoir été décrémenté que de 10 (85 - 10 = 75)
    const dbOffer = await prisma.recolteOffre.findUnique({
      where: { id: BigInt(testOfferId) },
    });
    expect(Number(dbOffer?.quantiteDisponible)).toBe(75);
  });

  it('concurrence sur stock restant : deux requêtes distinctes concurrentes demandant plus que le stock disponible mènent à 1 succès et 1 échec 409 sans survente', async () => {
    // Actuellement le stock est à 75.
    // Deux requêtes concurrentes avec clientRequestId différents demandent 50 chacune (50 + 50 = 100 > 75).
    const reqIdA = randomUUID();
    const reqIdB = randomUUID();

    const [resA, resB] = await Promise.all([
      request(app)
        .post('/api/buyer/orders')
        .set('Authorization', `Bearer ${testBuyerToken}`)
        .send({
          type: 'achat_direct',
          clientRequestId: reqIdA,
          items: [{ productId: testOfferId, quantity: 50 }],
        }),
      request(app)
        .post('/api/buyer/orders')
        .set('Authorization', `Bearer ${testBuyerToken}`)
        .send({
          type: 'achat_direct',
          clientRequestId: reqIdB,
          items: [{ productId: testOfferId, quantity: 50 }],
        }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    // L'une réussit (201), l'autre échoue avec 409 (stock insuffisant)
    expect(statuses).toEqual([201, 409]);

    const successRes = resA.status === 201 ? resA : resB;
    const failRes = resA.status === 409 ? resA : resB;

    expect(successRes.body.orders).toHaveLength(1);
    expect(failRes.body.message).toMatch(/Stock insuffisant/);

    // Stock final doit être exactement 75 - 50 = 25 (jamais négatif)
    const dbOffer = await prisma.recolteOffre.findUnique({
      where: { id: BigInt(testOfferId) },
    });
    expect(Number(dbOffer?.quantiteDisponible)).toBe(25);
  });
});
