import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AuthRequest } from './auth.controller.js';
import { OrderRecord, OrderStatus, OrderType } from '../domain/types.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';

function mapToOrderRecord(tx: any): OrderRecord {
  let createdAtStr = '';
  if (tx.createdAt) {
    const d = new Date(tx.createdAt);
    if (!isNaN(d.getTime())) {
      createdAtStr = d.toISOString();
    } else {
      createdAtStr = 'date_invalide';
    }
  } else {
    createdAtStr = 'date_inconnue';
  }

  return {
    id: tx.id ? tx.id.toString() : '',
    buyerId: tx.acheteurId ? tx.acheteurId.toString() : '',
    type: tx.type as OrderType,
    status: tx.statut as OrderStatus,
    productId: tx.recolteOffreId ? tx.recolteOffreId.toString() : '',
    productName: tx.recolteOffre?.produitAgricole?.nom ?? 'Produit',
    quantity: Number(tx.quantite ?? 0),
    unit: tx.recolteOffre?.produitAgricole?.unite ?? 'kg',
    price: tx.prixConvenu ? tx.prixConvenu.toString() : '0',
    gicId: tx.recolteOffre?.gic?.id ? tx.recolteOffre.gic.id.toString() : '',
    gicName: tx.recolteOffre?.gic?.nom ?? 'GIC Partenaire',
    createdAt: createdAtStr,
  };
}

export async function getBuyerOrders(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'buyer' || !req.user.buyerId) {
    return res.status(403).json({ message: 'Accès acheteur requis.' });
  }

  try {
    const buyerId = BigInt(req.user.buyerId);
    const { page, limit, skip } = getPagination(req);

    const [txs, total] = await Promise.all([
      prisma.transactionAcheteur.findMany({
        where: { acheteurId: buyerId },
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          recolteOffre: {
            include: { produitAgricole: true, gic: true },
          },
        },
      }),
      prisma.transactionAcheteur.count({ where: { acheteurId: buyerId } }),
    ]);

    const orders = txs.map(mapToOrderRecord);

    res.json({
      orders,
      meta: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BIGINT = 9223372036854775807n;

export async function createBuyerOrders(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'buyer' || !req.user.buyerId) {
    return res.status(403).json({ message: 'Accès acheteur requis.' });
  }

  const { type, items, clientRequestId: bodyRequestId } = req.body as {
    type?: OrderType;
    items?: Array<{ productId: string; quantity: number }>;
    clientRequestId?: string;
  };

  const clientRequestId = (bodyRequestId || req.headers['x-client-request-id'] || '').toString().trim();

  // 1. Validation obligatoire de l'identifiant de requête (clientRequestId)
  if (!clientRequestId || clientRequestId.length > 100 || !UUID_REGEX.test(clientRequestId)) {
    return res.status(400).json({
      message: 'Identifiant de requête client (clientRequestId UUID valide, max 100 caractères) obligatoire.',
    });
  }

  // 2. Validation stricte des données de commande
  const validTypes: OrderType[] = ['commande_ferme', 'achat_direct', 'reservation'];
  if (!type || !validTypes.includes(type)) {
    return res.status(400).json({ message: 'Type de commande invalide ou manquant.' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Au moins un article est requis dans le panier.' });
  }

  if (items.length > 50) {
    return res.status(400).json({ message: 'Le nombre d’articles par commande est limité à 50.' });
  }

  // Vérification de chaque article, validité BigInt, bornes de quantité et détection de doublons
  const seenProductIds = new Set<string>();
  const sanitizedItems: Array<{ productId: string; offerId: bigint; quantity: number }> = [];

  for (const item of items) {
    if (!item || typeof item.productId !== 'string') {
      return res.status(400).json({ message: 'Identifiant d’offre invalide.' });
    }
    const cleanId = item.productId.trim();
    if (!/^\d+$/.test(cleanId)) {
      return res.status(400).json({
        message: `Identifiant d’offre invalide (${cleanId}). Seuls les identifiants numériques sont acceptés.`,
      });
    }

    let offerId: bigint;
    try {
      offerId = BigInt(cleanId);
      if (offerId <= 0n || offerId > MAX_BIGINT) {
        return res.status(400).json({ message: `Identifiant d’offre hors plage BigInt (${cleanId}).` });
      }
    } catch {
      return res.status(400).json({ message: `Identifiant d’offre hors plage BigInt (${cleanId}).` });
    }

    if (seenProductIds.has(cleanId)) {
      return res.status(400).json({ message: `Articles en double dans la commande pour l'offre ${cleanId}.` });
    }
    seenProductIds.add(cleanId);

    if (typeof item.quantity !== 'number' || !Number.isFinite(item.quantity) || item.quantity <= 0) {
      return res.status(400).json({ message: 'La quantité demandée doit être un nombre strictement positif.' });
    }

    if (item.quantity > 1000000) {
      return res.status(400).json({
        message: `La quantité demandée (${item.quantity}) dépasse le plafond autorisé de 1 000 000.`,
      });
    }

    sanitizedItems.push({ productId: cleanId, offerId, quantity: item.quantity });
  }

  let buyerId: bigint;
  try {
    buyerId = BigInt(req.user.buyerId);
    if (buyerId <= 0n || buyerId > MAX_BIGINT) {
      return res.status(400).json({ message: 'Identifiant acheteur invalide.' });
    }
  } catch {
    return res.status(400).json({ message: 'Identifiant acheteur invalide.' });
  }

  try {
    // 3. Exécution transactionnelle complète : sérialisation PostgreSQL, vérification d'idempotence,
    // lecture des offres, contrôle des prix et stocks, décrément et insertion.
    const result = await prisma.$transaction(async (tx) => {
      // Verrou transactionnel PostgreSQL déterministe obligatoire pour sérialiser deux requêtes concurrentes
      // du même acheteur avec le même clientRequestId
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`buyer_order:${buyerId.toString()}:${clientRequestId}`}))`;

      // Vérification d'idempotence sous transaction
      const existingTxs = await tx.transactionAcheteur.findMany({
        where: {
          acheteurId: buyerId,
          clientRequestId: clientRequestId,
        },
        include: {
          recolteOffre: {
            include: { produitAgricole: true, gic: true },
          },
        },
        orderBy: { id: 'asc' },
      });

      if (existingTxs.length > 0) {
        const sameType = existingTxs.every((t) => t.type === type);
        const sameCount = existingTxs.length === sanitizedItems.length;

        const sortedExisting = [...existingTxs].sort((a, b) => (a.recolteOffreId < b.recolteOffreId ? -1 : 1));
        const sortedItems = [...sanitizedItems].sort((a, b) => (a.offerId < b.offerId ? -1 : 1));

        let sameItems = sameCount && sameType;
        if (sameItems) {
          for (let i = 0; i < sortedItems.length; i++) {
            const ext = sortedExisting[i];
            const inItem = sortedItems[i];
            if (ext.recolteOffreId !== inItem.offerId || Number(ext.quantite) !== inItem.quantity) {
              sameItems = false;
              break;
            }
          }
        }

        if (sameItems) {
          return {
            statusCode: 200,
            orders: existingTxs.map(mapToOrderRecord),
            idempotentReplay: true,
          };
        } else {
          const conflictErr: any = new Error(
            "Conflit d'idempotence : cet identifiant de requête (clientRequestId) a déjà été utilisé avec un contenu de commande différent."
          );
          conflictErr.statusCode = 409;
          throw conflictErr;
        }
      }

      // Tri déterministe des articles par identifiant d'offre pour éviter tout risque d'interblocage (deadlock)
      const lockOrderedItems = [...sanitizedItems].sort((a, b) => (a.offerId < b.offerId ? -1 : 1));
      const createdRecords = [];

      for (const item of lockOrderedItems) {
        const offer = await tx.recolteOffre.findUnique({
          where: { id: item.offerId },
          include: { produitAgricole: true, gic: true },
        });

        if (!offer) {
          const notFoundErr: any = new Error(`L'offre ${item.productId} n'existe pas ou a été supprimée.`);
          notFoundErr.statusCode = 404;
          throw notFoundErr;
        }

        const serverPrice = offer.produitAgricole?.prix;
        if (serverPrice === null || serverPrice === undefined || Number(serverPrice) <= 0) {
          const priceErr: any = new Error(
            `Le produit ${offer.produitAgricole?.nom ?? item.productId} ne possède pas de prix serveur valide.`
          );
          priceErr.statusCode = 400;
          throw priceErr;
        }

        if (Number(offer.quantiteDisponible) < item.quantity) {
          const stockErr: any = new Error(
            `Stock insuffisant pour ${offer.produitAgricole?.nom ?? item.productId} (disponible: ${offer.quantiteDisponible}, demandé: ${item.quantity}).`
          );
          stockErr.statusCode = 409;
          throw stockErr;
        }

        // Décrément conditionnel atomique pour empêcher le surstockage concurrent
        const updateResult = await tx.recolteOffre.updateMany({
          where: {
            id: item.offerId,
            quantiteDisponible: { gte: item.quantity },
          },
          data: {
            quantiteDisponible: { decrement: item.quantity },
            timestampMaj: new Date(),
          },
        });

        if (updateResult.count === 0) {
          const conflictErr: any = new Error(`Stock insuffisant ou conflit concurrent pour l'offre ${item.productId}`);
          conflictErr.statusCode = 409;
          throw conflictErr;
        }

        const createdTx = await tx.transactionAcheteur.create({
          data: {
            type,
            quantite: item.quantity,
            prixConvenu: serverPrice,
            statut: 'en_attente',
            recolteOffreId: item.offerId,
            acheteurId: buyerId,
            clientRequestId,
            createdAt: new Date(),
          },
          include: {
            recolteOffre: {
              include: { produitAgricole: true, gic: true },
            },
          },
        });

        createdRecords.push(createdTx);
      }

      return {
        statusCode: 201,
        orders: createdRecords.map(mapToOrderRecord),
        idempotentReplay: false,
      };
    });

    if (result.idempotentReplay) {
      return res.status(200).json({
        orders: result.orders,
        idempotentReplay: true,
      });
    }

    return res.status(201).json({
      orders: result.orders,
    });
  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({
        message: "Conflit d'unicité sur la commande (clientRequestId déjà utilisé ou collision concurrente).",
      });
    }
    next(error);
  }
}

export async function getBuyerAlertPreferences(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'buyer' || !req.user.buyerId) {
    return res.status(403).json({ message: 'Accès acheteur requis.' });
  }
  try {
    const buyerId = BigInt(req.user.buyerId);
    const acheteur = await prisma.acheteur.findUnique({ where: { id: buyerId } });
    let preferences = { productNames: [], bassins: [] };
    if (acheteur?.preferencesAlertes) {
      try {
        preferences = JSON.parse(acheteur.preferencesAlertes);
      } catch {}
    }
    res.json({ preferences });
  } catch (error) {
    next(error);
  }
}

export async function updateBuyerAlertPreferences(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'buyer' || !req.user.buyerId) {
    return res.status(403).json({ message: 'Accès acheteur requis.' });
  }
  const preferences = req.body as { productNames?: string[]; bassins?: string[] };
  try {
    const buyerId = BigInt(req.user.buyerId);
    const updated = await prisma.acheteur.update({
      where: { id: buyerId },
      data: {
        preferencesAlertes: JSON.stringify(preferences),
      },
    });

    let savedPrefs = { productNames: [], bassins: [] };
    try {
      savedPrefs = JSON.parse(updated.preferencesAlertes || '{}');
    } catch {}

    res.json({ preferences: savedPrefs });
  } catch (error) {
    next(error);
  }
}
