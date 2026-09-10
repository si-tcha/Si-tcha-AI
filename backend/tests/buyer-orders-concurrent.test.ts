import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { getJwtSecret } from '../src/middlewares/auth.js';

describe('Buyer Orders Real PostgreSQL Concurrency & Idempotency Integration Test', () => {
  const secret = getJwtSecret();
  const testBuyerId = '9801';
  const testBuyerToken = jwt.sign(
    { id: testBuyerId, role: 'buyer', phone: '+237699980101', nom: 'Concurrent Buyer Corp' },
    secret,
    { expiresIn: '1h' }
  );

  const testOfferId = '9801';
  const testProductId = '9801';
  const testGicId = '9801';
  const testBassinId = '9801';

  beforeAll(async () => {
    // Nettoyer d'abord les enregistrements enfants puis parents
    await prisma.transactionAcheteur.deleteMany({
      where: { recolteOffreId: BigInt(testOfferId) },
    });
    await prisma.recolteOffre.deleteMany({
      where: { id: BigInt(testOfferId) },
    });
    await prisma.gIC.deleteMany({
      where: { id: BigInt(testGicId) },
    });
    await prisma.bassinProduction.deleteMany({
      where: { id: BigInt(testBassinId) },
    });
    await prisma.produitAgricole.deleteMany({
      where: { id: BigInt(testProductId) },
    });
    await prisma.acheteur.deleteMany({
      where: { id: BigInt(testBuyerId) },
    });

    // 1. Acheteur
    await prisma.acheteur.create({
      data: {
        id: BigInt(testBuyerId),
        nomEntreprise: 'Concurrent Buyer Corp',
        contact: '+237699980101',
        phoneVerified: true,
        isVerified: true,
      },
    });

    // 2. BassinProduction
    await prisma.bassinProduction.create({
      data: {
        id: BigInt(testBassinId),
        nom: 'Bassin Test Concurrency',
        region: 'Littoral',
        latitude: 4.05,
        longitude: 9.71,
      },
    });

    // 3. ProduitAgricole avec prix réel
    await prisma.produitAgricole.create({
      data: {
        id: BigInt(testProductId),
        nom: 'Café Arabica Concurrent',
        categorie: 'Café',
        prix: 3000,
        unite: 'kg',
      },
    });

    // 4. GIC
    await prisma.gIC.create({
      data: {
        id: BigInt(testGicId),
        nom: 'GIC Concurrency Test',
        logoURL: 'https://example.com/logo.png',
        activitesPrincipales: 'Production Café',
        identifiantREF: 'GIC-CONC-001',
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
  });

  afterAll(async () => {
    // Nettoyage final ordonné
    await prisma.transactionAcheteur.deleteMany({
      where: { recolteOffreId: BigInt(testOfferId) },
    });
    await prisma.recolteOffre.deleteMany({
      where: { id: BigInt(testOfferId) },
    });
    await prisma.gIC.deleteMany({
      where: { id: BigInt(testGicId) },
    });
    await prisma.bassinProduction.deleteMany({
      where: { id: BigInt(testBassinId) },
    });
    await prisma.produitAgricole.deleteMany({
      where: { id: BigInt(testProductId) },
    });
    await prisma.acheteur.deleteMany({
      where: { id: BigInt(testBuyerId) },
    });
    await prisma.$disconnect();
  });

  it('deux requêtes hautement concurrentes avec le même clientRequestId aboutissent à une création et un rejeu idempotent, sans faux 409 et stock décrémenté UNE SEULE FOIS', async () => {
    const clientRequestId = '99999999-9999-4999-8999-999999999901';
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
    const clientRequestId = '99999999-9999-4999-8999-999999999901'; // Déjà utilisé au test précédent
    const conflictingPayload = {
      type: 'commande_ferme',
      clientRequestId,
      items: [{ productId: testOfferId, quantity: 25 }], // Quantité modifiée (25 au lieu de 15)
    };

    const res = await request(app)
      .post('/api/buyer/orders')
      .set('Authorization', `Bearer ${testBuyerToken}`)
      .send(conflictingPayload);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/Conflit d'idempotence/);

    // Le stock ne doit pas avoir bougé (toujours 85)
    const dbOffer = await prisma.recolteOffre.findUnique({
      where: { id: BigInt(testOfferId) },
    });
    expect(Number(dbOffer?.quantiteDisponible)).toBe(85);
  });

  it('concurrence sur stock restant : deux requêtes distinctes concurrentes demandant plus que le stock disponible mènent à 1 succès et 1 échec 409 sans survente', async () => {
    // Actuellement le stock est à 85.
    // Deux requêtes concurrentes avec clientRequestId différents demandent 50 chacune (50 + 50 = 100 > 85).
    const reqIdA = '99999999-9999-4999-8999-999999999902';
    const reqIdB = '99999999-9999-4999-8999-999999999903';

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

    // Stock final doit être exactement 85 - 50 = 35 (jamais négatif)
    const dbOffer = await prisma.recolteOffre.findUnique({
      where: { id: BigInt(testOfferId) },
    });
    expect(Number(dbOffer?.quantiteDisponible)).toBe(35);
  });
});
