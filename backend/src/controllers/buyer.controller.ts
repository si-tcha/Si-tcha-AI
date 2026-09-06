import { Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthRequest } from './auth.controller.js';
import { OrderRecord, OrderStatus, OrderType } from '../domain/types.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';

export async function getBuyerOrders(req: AuthRequest, res: Response) {
  if (req.user?.role !== 'buyer' || !req.user.buyerId) return res.status(403).json({ message: 'Accès acheteur requis.' });
  try {
    const buyerId = BigInt(req.user.buyerId);
    const { page, limit, skip } = getPagination(req);

    const [txs, total] = await Promise.all([
      prisma.transactionAcheteur.findMany({
        where: { acheteurId: buyerId },
        skip,
        take: limit,
        include: {
          recolteOffre: {
            include: { produitAgricole: true, gic: true },
          },
        },
      }),
      prisma.transactionAcheteur.count({ where: { acheteurId: buyerId } }),
    ]);

    const orders = txs.map((tx) => ({
      id: tx.id.toString(),
      buyerId: tx.acheteurId.toString(),
      type: tx.type as OrderType,
      status: tx.statut as OrderStatus,
      productId: tx.recolteOffreId.toString(),
      productName: tx.recolteOffre.produitAgricole.nom,
      quantity: Number(tx.quantite),
      unit: 'kg',
      price: tx.prixConvenu.toString(),
      gicId: tx.recolteOffre.gicId.toString(),
      gicName: tx.recolteOffre.gic.nom,
      createdAt: new Date().toISOString(),
    }));

    res.json({
      orders,
      meta: buildPaginationMeta(total, page, limit)
    });
  } catch (error) {
    res.json({ orders: [], meta: buildPaginationMeta(0, 1, 20) });
  }
}

export async function createBuyerOrders(req: AuthRequest, res: Response) {
  if (req.user?.role !== 'buyer' || !req.user.buyerId) return res.status(403).json({ message: 'Accès acheteur requis.' });
  const { type, items } = req.body as {
    type?: OrderType;
    items?: Array<{ productId: string; quantity: number }>;
  };
  if (!type || !items?.length) return res.status(400).json({ message: 'type et items sont requis.' });

  try {
    const buyerId = BigInt(req.user.buyerId);
    const created: OrderRecord[] = [];

    for (const item of items) {
      const offerId = BigInt(item.productId);
      const offer = await prisma.recolteOffre.findUnique({
        where: { id: offerId },
        include: { produitAgricole: true, gic: true },
      });
      if (!offer) continue;

      const tx = await prisma.transactionAcheteur.create({
        data: {
          type: type ?? 'commande_ferme',
          quantite: Number(item.quantity),
          prixConvenu: 500,
          statut: type === 'reservation' ? 'en_attente' : 'confirmee',
          recolteOffreId: offer.id,
          acheteurId: buyerId,
        },
      });

      created.push({
        id: tx.id.toString(),
        buyerId: buyerId.toString(),
        type,
        status: tx.statut as OrderStatus,
        productId: offer.id.toString(),
        productName: offer.produitAgricole.nom,
        quantity: Number(tx.quantite),
        unit: 'kg',
        price: '500',
        gicId: offer.gic.id.toString(),
        gicName: offer.gic.nom,
        createdAt: new Date().toISOString(),
      });
    }

    res.status(201).json({ orders: created });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création de la commande.' });
  }
}

export async function getBuyerAlertPreferences(req: AuthRequest, res: Response) {
  if (req.user?.role !== 'buyer' || !req.user.buyerId) return res.status(403).json({ message: 'Accès acheteur requis.' });
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
    res.json({ preferences: { productNames: [], bassins: [] } });
  }
}

export async function updateBuyerAlertPreferences(req: AuthRequest, res: Response) {
  if (req.user?.role !== 'buyer' || !req.user.buyerId) return res.status(403).json({ message: 'Accès acheteur requis.' });
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
    res.status(500).json({ message: 'Erreur lors de la mise à jour des préférences.' });
  }
}
