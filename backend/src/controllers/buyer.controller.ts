import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AuthRequest } from './auth.controller.js';
import { OrderRecord, OrderStatus, OrderType } from '../domain/types.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';

function mapToOrderRecord(tx: any): OrderRecord {
  return {
    id: tx.id.toString(),
    buyerId: tx.acheteurId.toString(),
    type: tx.type as OrderType,
    status: tx.statut as OrderStatus,
    productId: tx.recolteOffreId.toString(),
    productName: tx.recolteOffre?.produitAgricole?.nom ?? 'Produit',
    quantity: Number(tx.quantite),
    unit: tx.recolteOffre?.produitAgricole?.unite ?? 'kg',
    price: tx.prixConvenu ? tx.prixConvenu.toString() : '0',
    gicId: tx.recolteOffre?.gic?.id?.toString() ?? '',
    gicName: tx.recolteOffre?.gic?.nom ?? 'GIC Partenaire',
    createdAt: tx.createdAt ? new Date(tx.createdAt).toISOString() : new Date().toISOString(),
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

export async function createBuyerOrders(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'buyer' || !req.user.buyerId) {
    return res.status(403).json({ message: 'Accès acheteur requis.' });
  }

  const { type, items, clientRequestId: bodyRequestId } = req.body as {
    type?: OrderType;
    items?: Array<{ productId: string; quantity: number }>;
    clientRequestId?: string;
  };

  const clientRequestId = (bodyRequestId || req.headers['x-client-request-id'] || '').toString().trim() || null;

  // 1. Validation stricte des données de commande
  const validTypes: OrderType[] = ['commande_ferme', 'achat_direct', 'reservation'];
  if (!type || !validTypes.includes(type)) {
    return res.status(400).json({ message: 'Type de commande invalide ou manquant.' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Au moins un article est requis dans le panier.' });
  }

  // Vérification de chaque article et détection de doublons
  const seenProductIds = new Set<string>();
  for (const item of items) {
    if (!item.productId || typeof item.productId !== 'string' || !/^\d+$/.test(item.productId.trim())) {
      return res.status(400).json({ message: 'Identifiant d’offre invalide.' });
    }
    const cleanId = item.productId.trim();
    if (seenProductIds.has(cleanId)) {
      return res.status(400).json({ message: `Articles en double dans la commande pour l'offre ${cleanId}.` });
    }
    seenProductIds.add(cleanId);

    if (typeof item.quantity !== 'number' || !Number.isFinite(item.quantity) || item.quantity <= 0) {
      return res.status(400).json({ message: 'La quantité demandée doit être un nombre strictement positif.' });
    }
  }

  const buyerId = BigInt(req.user.buyerId);

  try {
    // 2. Gestion de l'idempotence : si un clientRequestId est fourni, vérifier si la commande a déjà été traitée
    if (clientRequestId) {
      const existingTxs = await prisma.transactionAcheteur.findMany({
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
        // Comparer le contenu pour vérifier s'il s'agit d'un rejeu exact ou d'un conflit
        const sameType = existingTxs.every((tx) => tx.type === type);
        const sameCount = existingTxs.length === items.length;

        // Trie les deux listes par offerId pour une comparaison fiable
        const sortedExisting = [...existingTxs].sort((a, b) => (a.recolteOffreId < b.recolteOffreId ? -1 : 1));
        const sortedItems = [...items].sort((a, b) => (BigInt(a.productId) < BigInt(b.productId) ? -1 : 1));

        let sameItems = sameCount && sameType;
        if (sameItems) {
          for (let i = 0; i < sortedItems.length; i++) {
            const ext = sortedExisting[i];
            const inItem = sortedItems[i];
            if (ext.recolteOffreId.toString() !== inItem.productId || Number(ext.quantite) !== inItem.quantity) {
              sameItems = false;
              break;
            }
          }
        }

        if (sameItems) {
          // Rejeu idempotent exact : renvoyer les commandes existantes sans décrémenter le stock une seconde fois
          return res.status(200).json({
            orders: existingTxs.map(mapToOrderRecord),
            idempotentReplay: true,
          });
        } else {
          // Même clientRequestId utilisé avec un payload différent -> Conflit 409
          return res.status(409).json({
            message: "Conflit d'idempotence : cet identifiant de requête (clientRequestId) a déjà été utilisé avec un contenu de commande différent.",
          });
        }
      }
    }

    // 3. Vérification préalable de l'existence de toutes les offres, des prix et des stocks
    for (const item of items) {
      const offerId = BigInt(item.productId);
      const offer = await prisma.recolteOffre.findUnique({
        where: { id: offerId },
        include: { produitAgricole: true, gic: true },
      });

      if (!offer) {
        return res.status(404).json({ message: `L'offre ${item.productId} n'existe pas.` });
      }

      if (offer.produitAgricole.prix === null || Number(offer.produitAgricole.prix) <= 0) {
        return res.status(400).json({
          message: `Le produit ${offer.produitAgricole.nom} ne possède pas de prix serveur valide.`,
        });
      }

      if (Number(offer.quantiteDisponible) < item.quantity) {
        return res.status(409).json({
          message: `Stock insuffisant pour ${offer.produitAgricole.nom} (disponible: ${offer.quantiteDisponible}, demandé: ${item.quantity}).`,
        });
      }
    }

    // 4. Exécution atomique : décrément conditionnel du stock et création des transactions
    const createdTxs = await prisma.$transaction(async (tx) => {
      const records = [];

      for (const item of items) {
        const offerId = BigInt(item.productId);

        // Décrément conditionnel atomique pour empêcher le surstockage concurrent
        const updateResult = await tx.recolteOffre.updateMany({
          where: {
            id: offerId,
            quantiteDisponible: { gte: item.quantity },
          },
          data: {
            quantiteDisponible: { decrement: item.quantity },
            timestampMaj: new Date(),
          },
        });

        if (updateResult.count === 0) {
          throw Object.assign(
            new Error(`Stock insuffisant ou conflit concurrent pour l'offre ${item.productId}`),
            { statusCode: 409 }
          );
        }

        const freshOffer = await tx.recolteOffre.findUnique({
          where: { id: offerId },
          include: { produitAgricole: true, gic: true },
        });

        const createdTx = await tx.transactionAcheteur.create({
          data: {
            type,
            quantite: item.quantity,
            prixConvenu: freshOffer!.produitAgricole.prix!,
            statut: 'en_attente',
            recolteOffreId: offerId,
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

        records.push(createdTx);
      }

      return records;
    });

    return res.status(201).json({
      orders: createdTxs.map(mapToOrderRecord),
    });
  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
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
