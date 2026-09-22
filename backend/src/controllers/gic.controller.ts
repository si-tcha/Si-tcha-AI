import { Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthRequest } from './auth.controller.js';
import { getImageUrlForProduct } from '../utils/productUtils.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';

export async function getGicProfile(req: AuthRequest, res: Response) {
  if (req.user?.role !== 'seller' || !req.user.gicId) {
    return res.status(403).json({ message: 'Accès GIC requis.' });
  }
  try {
    const gicId = BigInt(req.user.gicId);
    const gic = await prisma.gIC.findUnique({
      where: { id: gicId },
      include: {
        bassinProduction: true,
        agriculteurs: true,
        gicNeedEntries: true,
      },
    });

    if (!gic) return res.status(404).json({ message: 'Profil GIC introuvable.' });

    const profile = {
      id: gic.id.toString(),
      name: gic.nom,
      identifiantREF: gic.identifiantREF,
      bassin: gic.bassinProduction?.nom ?? 'Ouest',
      statutLegalisation: gic.statutLegalisation,
      activitesPrincipales: gic.activitesPrincipales,
      leaderName: gic.agriculteurs.find((a) => a.estLeader)?.nom ?? req.user.name,
      reglementInterieur: gic.reglementInterieur ?? '',
      surfaceHa: 10,
      updatedAt: gic.timestampMaj.toISOString(),
      authorRole: req.user.gicRole ?? 'leader',
    };

    const members = gic.agriculteurs.map((a) => ({
      id: a.id.toString(),
      name: a.nom,
      phone: a.contact,
      isLeader: a.estLeader,
      updatedAt: a.timestampMaj.toISOString(),
    }));

    const needsList = gic.gicNeedEntries ?? (gic as any).besoins ?? [];
    const needs = needsList.map((b: any) => ({
      id: b.id.toString(),
      category: b.category ?? b.categorieBesoin ?? '',
      description: b.description,
      updatedAt: (b.updatedAt ?? b.timestampMaj ?? new Date()).toISOString(),
      authorRole: b.authorRole ?? 'member',
    }));

    res.json({ profile, members, needs });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération du profil GIC.' });
  }
}

export async function updateGicProfile(req: AuthRequest, res: Response) {
  if (req.user?.role !== 'seller' || req.user.gicRole !== 'leader' || !req.user.gicId) {
    return res.status(403).json({ message: 'Privilège Leader requis.' });
  }
  const patch = req.body as { surfaceHa?: number; bassin?: string; statutLegalisation?: string; activitesPrincipales?: string; reglementInterieur?: string };
  try {
    const gicId = BigInt(req.user.gicId);
    const updatedGic = await prisma.gIC.update({
      where: { id: gicId },
      data: {
        ...(patch.statutLegalisation ? { statutLegalisation: patch.statutLegalisation } : {}),
        ...(patch.activitesPrincipales ? { activitesPrincipales: patch.activitesPrincipales } : {}),
        ...(patch.reglementInterieur ? { reglementInterieur: patch.reglementInterieur } : {}),
        timestampMaj: new Date(),
      },
      include: { bassinProduction: true, agriculteurs: true },
    });

    const profile = {
      id: updatedGic.id.toString(),
      name: updatedGic.nom,
      identifiantREF: updatedGic.identifiantREF,
      bassin: updatedGic.bassinProduction?.nom ?? 'Ouest',
      statutLegalisation: updatedGic.statutLegalisation,
      activitesPrincipales: updatedGic.activitesPrincipales,
      leaderName: updatedGic.agriculteurs.find((a) => a.estLeader)?.nom ?? req.user.name,
      reglementInterieur: updatedGic.reglementInterieur ?? '',
      surfaceHa: patch.surfaceHa ?? 10,
      updatedAt: updatedGic.timestampMaj.toISOString(),
      authorRole: 'leader' as const,
    };

    res.json({ profile });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du profil GIC.' });
  }
}

export async function getGicHarvests(req: AuthRequest, res: Response) {
  if (req.user?.role !== 'seller' || !req.user.gicId) return res.status(403).json({ message: 'Accès GIC requis.' });
  try {
    const gicId = BigInt(req.user.gicId);
    const { page, limit, skip } = getPagination(req);

    const [offers, total] = await Promise.all([
      prisma.recolteOffre.findMany({
        where: { gicId },
        skip,
        take: limit,
        include: { produitAgricole: true },
      }),
      prisma.recolteOffre.count({ where: { gicId } }),
    ]);

    const harvests = offers.map((o) => ({
      id: o.id.toString(),
      product: o.produitAgricole.nom,
      volume: Number(o.quantiteDisponible),
      date: o.dateDispoEstimee.toISOString().slice(0, 10),
      synced: true,
      updatedAt: o.timestampMaj.toISOString(),
      authorRole: 'leader' as const,
    }));

    res.json({
      harvests,
      meta: buildPaginationMeta(total, page, limit)
    });
  } catch (error) {
    res.json({ harvests: [], meta: buildPaginationMeta(0, 1, 20) });
  }
}

export async function createGicHarvest(req: AuthRequest, res: Response) {
  if (req.user?.role !== 'seller' || !req.user.gicId) return res.status(403).json({ message: 'Accès GIC requis.' });
  const { product, volume } = req.body as { product?: string; volume?: number };
  if (!product?.trim() || !Number.isFinite(Number(volume))) return res.status(400).json({ message: 'product et volume sont requis.' });

  try {
    const gicId = BigInt(req.user.gicId);
    let produit = await prisma.produitAgricole.findFirst({
      where: { nom: { equals: product.trim(), mode: 'insensitive' } },
    });

    if (!produit) {
      const pName = product.trim();
      const pCat = pName.toLowerCase().includes('ananas') || pName.toLowerCase().includes('plantain') || pName.toLowerCase().includes('banane') ? 'Fruits' : 'Maraîchage';
      produit = await prisma.produitAgricole.create({
        data: {
          nom: pName,
          categorie: pCat,
          imageURL: getImageUrlForProduct(pName),
        },
      });
    }

    const offer = await prisma.recolteOffre.create({
      data: {
        quantiteEstimee: Number(volume),
        quantiteDisponible: Number(volume),
        dateDispoEstimee: new Date(),
        maturite: 'Mature',
        timestampMaj: new Date(),
        produitAgricoleId: produit.id,
        gicId,
      },
      include: { produitAgricole: true },
    });

    const harvest = {
      id: offer.id.toString(),
      product: offer.produitAgricole.nom,
      volume: Number(offer.quantiteDisponible),
      date: offer.dateDispoEstimee.toISOString().slice(0, 10),
      synced: true,
      updatedAt: offer.timestampMaj.toISOString(),
      authorRole: req.user.gicRole ?? 'member',
    };

    res.status(201).json({ harvest });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l\'enregistrement de la récolte.' });
  }
}

export async function getGicExpenses(req: AuthRequest, res: Response) {
  if (req.user?.role !== 'seller' || !req.user.gicId) return res.status(403).json({ message: 'Accès GIC requis.' });
  try {
    const gicId = BigInt(req.user.gicId);
    const { page, limit, skip } = getPagination(req);

    const [expensesDb, total] = await Promise.all([
      prisma.chargeFinanciere.findMany({
        where: { gicId },
        skip,
        take: limit,
      }),
      prisma.chargeFinanciere.count({ where: { gicId } }),
    ]);

    const expenses = expensesDb.map((e) => ({
      id: e.id.toString(),
      label: e.typeCharge,
      amount: Number(e.montant),
      category: e.typeCharge,
      synced: true,
      updatedAt: e.timestampMaj.toISOString(),
      authorRole: 'leader' as const,
    }));

    res.json({
      expenses,
      meta: buildPaginationMeta(total, page, limit)
    });
  } catch (error) {
    res.json({ expenses: [], meta: buildPaginationMeta(0, 1, 20) });
  }
}

export async function createGicExpense(req: AuthRequest, res: Response) {
  if (req.user?.role !== 'seller' || !req.user.gicId) return res.status(403).json({ message: 'Accès GIC requis.' });
  const { label, amount, category } = req.body as { label?: string; amount?: number; category?: string };
  if (!label?.trim() || !category?.trim() || !Number.isFinite(Number(amount))) return res.status(400).json({ message: 'label, category et amount sont requis.' });

  try {
    const gicId = BigInt(req.user.gicId);
    const charge = await prisma.chargeFinanciere.create({
      data: {
        typeCharge: label.trim(),
        montant: Number(amount),
        surfaceHaConcernee: 1.0,
        timestampMaj: new Date(),
        gicId,
      },
    });

    const expense = {
      id: charge.id.toString(),
      label: charge.typeCharge,
      amount: Number(charge.montant),
      category: category.trim(),
      synced: true,
      updatedAt: charge.timestampMaj.toISOString(),
      authorRole: req.user.gicRole ?? 'member',
    };

    res.status(201).json({ expense });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création de la charge.' });
  }
}

export async function getGicOrders(req: AuthRequest, res: Response) {
  if (req.user?.role !== 'seller' || !req.user.gicId) return res.status(403).json({ message: 'Accès GIC requis.' });
  try {
    const gicId = BigInt(req.user.gicId);
    const { page, limit, skip } = getPagination(req);

    const [txs, total] = await Promise.all([
      prisma.transactionAcheteur.findMany({
        where: {
          recolteOffre: {
            gicId,
          }
        },
        skip,
        take: limit,
        include: {
          recolteOffre: {
            include: { produitAgricole: true, gic: true },
          },
          acheteur: true,
        },
        orderBy: { id: 'desc' }
      }),
      prisma.transactionAcheteur.count({
        where: {
          recolteOffre: {
            gicId,
          }
        }
      }),
    ]);

    const orders = txs.map((tx) => ({
      id: tx.id.toString(),
      buyerId: tx.acheteurId.toString(),
      buyerName: tx.acheteur?.nomEntreprise ?? 'Acheteur inconnu',
      type: tx.type,
      status: tx.statut,
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
    console.error('Erreur getGicOrders:', error);
    res.json({ orders: [], meta: buildPaginationMeta(0, 1, 20) });
  }
}

export async function createGicNeed(req: AuthRequest, res: Response) {
  if (req.user?.role !== 'seller' || !req.user.gicId) return res.status(403).json({ message: 'Accès GIC requis.' });
  const { id, category, description, updatedAt, authorRole } = req.body as { id: string; category: string; description: string; updatedAt?: string; authorRole?: string };
  if (!id || !category || !description) return res.status(400).json({ message: 'id, category et description sont requis.' });

  try {
    const gicId = BigInt(req.user.gicId);
    const need = await prisma.gicNeedEntry.upsert({
      where: { id },
      create: {
        id,
        category,
        description,
        updatedAt: updatedAt ? new Date(updatedAt) : new Date(),
        authorRole: authorRole ?? 'member',
        gicId,
      },
      update: {
        category,
        description,
        updatedAt: updatedAt ? new Date(updatedAt) : new Date(),
        authorRole: authorRole ?? 'member',
      },
    });

    res.json({ need: { ...need, id: need.id, gicId: need.gicId.toString() } });
  } catch (error) {
    res.status(500).json({ message: 'Erreur création du besoin.' });
  }
}
