import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from './auth.controller';

// GET /prefinancing/deals — Auth (buyer voit ses deals, seller voit ceux de son GIC)
export async function getPrefinancingDeals(req: AuthRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentification requise.' });
  }

  try {
    let where: any = {};
    if (req.user.role === 'buyer' && req.user.buyerId) {
      where = { acheteurId: BigInt(req.user.buyerId) };
    } else if (req.user.role === 'seller' && req.user.gicId) {
      where = { gicId: BigInt(req.user.gicId) };
    }

    const deals = await prisma.prefinancingEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      deals: deals.map((d) => ({
        id: d.id,
        gicName: d.gicName,
        buyerName: d.buyerName,
        amountFcfa: d.amountFcfa,
        inputDescription: d.inputDescription,
        reservedProduct: d.reservedProduct,
        reservedVolumeKg: d.reservedVolumeKg,
        status: d.status,
        createdAt: d.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('Erreur getPrefinancingDeals:', err);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
}

// POST /prefinancing/deals — Auth
export async function createPrefinancingDeal(req: AuthRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentification requise.' });
  }

  const { gicName, buyerName, amountFcfa, inputDescription, reservedProduct, reservedVolumeKg } = req.body as {
    gicName?: string;
    buyerName?: string;
    amountFcfa?: number;
    inputDescription?: string;
    reservedProduct?: string;
    reservedVolumeKg?: number;
  };

  if (!amountFcfa || !inputDescription?.trim()) {
    return res.status(400).json({ message: 'Montant et description des intrants sont requis.' });
  }

  try {
    const id = Date.now().toString();
    const deal = await prisma.prefinancingEntry.create({
      data: {
        id,
        gicName: gicName?.trim() ?? '',
        buyerName: buyerName?.trim() ?? '',
        amountFcfa: amountFcfa,
        inputDescription: inputDescription.trim(),
        reservedProduct: reservedProduct?.trim() ?? '',
        reservedVolumeKg: reservedVolumeKg ?? 0,
        status: 'propose',
        acheteurId: req.user.role === 'buyer' && req.user.buyerId ? BigInt(req.user.buyerId) : null,
        gicId: req.user.role === 'seller' && req.user.gicId ? BigInt(req.user.gicId) : null,
      },
    });

    return res.status(201).json({
      deal: {
        id: deal.id,
        gicName: deal.gicName,
        buyerName: deal.buyerName,
        amountFcfa: deal.amountFcfa,
        inputDescription: deal.inputDescription,
        reservedProduct: deal.reservedProduct,
        reservedVolumeKg: deal.reservedVolumeKg,
        status: deal.status,
        createdAt: deal.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('Erreur createPrefinancingDeal:', err);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
}
