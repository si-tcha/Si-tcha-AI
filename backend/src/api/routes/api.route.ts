/* import { Router } from 'express';
import { login, me, registerBuyer, registerSeller, requireAuth, AuthRequest } from '../auth.js';
import { createId, readStore, updateStore } from '../../lib/store.js';
import { OrderRecord, OrderStatus, OrderType } from '../../domain/types.js';
import prisma from '../../lib/prisma.js';

const router = Router();

function getEmojiForCategory(category: string, name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('tomate')) return '🍅';
  if (lower.includes('maïs') || lower.includes('mais')) return '🌽';
  if (lower.includes('manioc')) return '🥔';
  if (lower.includes('plantain') || lower.includes('banane')) return '🍌';
  if (lower.includes('poivron')) return '🫑';
  if (lower.includes('arachide')) return '🥜';
  if (lower.includes('ananas')) return '🍍';
  if (category === 'Légumes') return '🥗';
  if (category === 'Céréales') return '🌾';
  if (category === 'Tubercules') return '🥔';
  if (category === 'Fruits') return '🍍';
  return '🌱';
}

function getImageUrlForProduct(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('tomate')) {
    return 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop';
  }
  if (lower.includes('maïs') || lower.includes('mais')) {
    return 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=600&auto=format&fit=crop';
  }
  if (lower.includes('manioc')) {
    return 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&auto=format&fit=crop';
  }
  if (lower.includes('plantain') || lower.includes('banane')) {
    return 'https://images.unsplash.com/photo-1528825871115-3581a5387919?w=600&auto=format&fit=crop';
  }
  if (lower.includes('poivron')) {
    return 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600&auto=format&fit=crop';
  }
  if (lower.includes('arachide')) {
    return 'https://images.unsplash.com/photo-1567892906800-47120cb95dfd?w=600&auto=format&fit=crop';
  }
  if (lower.includes('ananas')) {
    return 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=600&auto=format&fit=crop';
  }
  return 'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?w=600&auto=format&fit=crop';
}

router.post('/auth/register/buyer', registerBuyer);
router.post('/auth/register/seller', registerSeller);
router.post('/auth/login', login);
router.get('/auth/me', requireAuth, me);

router.get('/catalog/products', async (_req, res) => {
  try {
    const offers = await prisma.recolteOffre.findMany({
      include: {
        produitAgricole: true,
        gic: {
          include: {
            bassinProduction: true,
          },
        },
      },
    });

    const products = offers.map((offer) => ({
      id: offer.id.toString(),
      name: offer.produitAgricole.nom,
      category: offer.produitAgricole.categorie,
      gicId: offer.gicId.toString(),
      gicName: offer.gic.nom,
      gicRef: offer.gic.identifiantREF,
      price: '500',
      unit: offer.produitAgricole.categorie === 'Fruits' ? 'régime' : 'kg',
      emoji: getEmojiForCategory(offer.produitAgricole.categorie, offer.produitAgricole.nom),
      imageUrl: offer.imageUrl ?? offer.produitAgricole.imageUrl ?? getImageUrlForProduct(offer.produitAgricole.nom),
      bassin: offer.gic?.bassinProduction?.nom ?? 'Ouest',
      maturite: offer.maturite,
      volumeDisponible: Number(offer.quantiteDisponible),
      dateDispo: offer.dateDispoEstimee.toISOString().slice(0, 10),
    }));

    res.json({ products });
  } catch (error) {
    const data = await readStore();
    res.json({ products: data.products });
  }
});

router.get('/gics/public', async (_req, res) => {
  try {
    const gicsDb = await prisma.gIC.findMany({
      include: {
        bassinProduction: true,
      },
    });

    const gics = gicsDb.map((gic) => ({
      id: gic.id.toString(),
      name: gic.nom,
      identifiantREF: gic.identifiantREF,
      emoji: '🌿',
      bassin: gic.bassinProduction?.nom ?? 'Ouest',
      logoUrl: gic.logoURL,
    }));

    res.json({ gics });
  } catch (error) {
    const data = await readStore();
    const gics = data.gics.map((gic) => ({
      id: gic.id,
      name: gic.name,
      identifiantREF: gic.identifiantREF,
      bassin: gic.bassin,
      logoUrl: gic.logoUrl,
    }));
    res.json({ gics });
  }
});

router.get('/terrain', async (_req, res) => {
  try {
    const [meteoDb, marcheDb, phytoDb, progDb] = await Promise.all([
      prisma.donneesMeteo.findMany({ include: { bassinProduction: true } }),
      prisma.donneeMarche.findMany({ include: { bassinProduction: true, produitAgricole: true } }),
      prisma.alertePhyto.findMany({ include: { bassinProduction: true } }),
      prisma.programmeAgricole.findMany(),
    ]);

    const weather = meteoDb.map((m) => ({
      id: m.id.toString(),
      bassin: m.bassinProduction.nom,
      temperature: Number(m.temperature),
      pluviometrie: Number(m.pluviometrie),
      date: m.timestampMesure.toISOString().slice(0, 10),
    }));

    const market = marcheDb.map((mk) => ({
      id: mk.id.toString(),
      product: mk.produitAgricole.nom,
      bassin: mk.bassinProduction.nom,
      prixMoyen: Number(mk.prixMoyen),
      rentabilite: Number(mk.rentabilite),
      date: mk.dateReleve.toISOString().slice(0, 10),
    }));

    const phytoAlerts = phytoDb.map((p) => ({
      id: p.id.toString(),
      bassin: p.bassinProduction.nom,
      ravageurMaladie: p.ravageurMaladie,
      protocoleUrgence: p.protocoleUrgence,
      dateEmission: p.dateEmission.toISOString().slice(0, 10),
    }));

    const programs = progDb.map((pr) => ({
      id: pr.id.toString(),
      nom: pr.nom,
      description: pr.description,
      criteresEligibilite: pr.criteresEligibilite,
      dateLimite: pr.dateLimite.toISOString().slice(0, 10),
    }));

    res.json({ weather, market, phytoAlerts, programs });
  } catch (error) {
    const data = await readStore();
    res.json({
      weather: data.weather,
      market: data.market,
      phytoAlerts: data.phytoAlerts,
      programs: data.programs,
    });
  }
});

router.get('/gic/profile', requireAuth, async (req: AuthRequest, res) => {
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
        besoins: true,
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

    const needs = gic.besoins.map((b) => ({
      id: b.id.toString(),
      category: b.categorieBesoin,
      description: b.description,
      updatedAt: b.timestampMaj.toISOString(),
      authorRole: 'leader' as const,
    }));

    res.json({ profile, members, needs });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération du profil GIC.' });
  }
});

router.put('/gic/profile', requireAuth, async (req: AuthRequest, res) => {
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
});

router.get('/gic/harvests', requireAuth, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'seller' || !req.user.gicId) return res.status(403).json({ message: 'Accès GIC requis.' });
  try {
    const gicId = BigInt(req.user.gicId);
    const offers = await prisma.recolteOffre.findMany({
      where: { gicId },
      include: { produitAgricole: true },
    });

    const harvests = offers.map((o) => ({
      id: o.id.toString(),
      product: o.produitAgricole.nom,
      volume: Number(o.quantiteDisponible),
      date: o.dateDispoEstimee.toISOString().slice(0, 10),
      synced: true,
      updatedAt: o.timestampMaj.toISOString(),
      authorRole: 'leader' as const,
    }));

    res.json({ harvests });
  } catch (error) {
    res.json({ harvests: [] });
  }
});

router.post('/gic/harvests', requireAuth, async (req: AuthRequest, res) => {
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
});

router.get('/gic/expenses', requireAuth, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'seller' || !req.user.gicId) return res.status(403).json({ message: 'Accès GIC requis.' });
  try {
    const gicId = BigInt(req.user.gicId);
    const expensesDb = await prisma.chargeFinanciere.findMany({
      where: { gicId },
    });

    const expenses = expensesDb.map((e) => ({
      id: e.id.toString(),
      label: e.typeCharge,
      amount: Number(e.montant),
      category: e.typeCharge,
      synced: true,
      updatedAt: e.timestampMaj.toISOString(),
      authorRole: 'leader' as const,
    }));

    res.json({ expenses });
  } catch (error) {
    res.json({ expenses: [] });
  }
});

router.post('/gic/expenses', requireAuth, async (req: AuthRequest, res) => {
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
});

router.get('/buyer/orders', requireAuth, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'buyer' || !req.user.buyerId) return res.status(403).json({ message: 'Accès acheteur requis.' });
  try {
    const buyerId = BigInt(req.user.buyerId);
    const txs = await prisma.transactionAcheteur.findMany({
      where: { acheteurId: buyerId },
      include: {
        recolteOffre: {
          include: { produitAgricole: true, gic: true },
        },
      },
    });

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

    res.json({ orders });
  } catch (error) {
    res.json({ orders: [] });
  }
});

router.post('/buyer/orders', requireAuth, async (req: AuthRequest, res) => {
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
});

router.get('/buyer/alert-preferences', requireAuth, async (req: AuthRequest, res) => {
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
});

router.put('/buyer/alert-preferences', requireAuth, async (req: AuthRequest, res) => {
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
      savedPrefs = JSON.parse(updated.preferencesAlertes);
    } catch {}

    res.json({ preferences: savedPrefs });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour des préférences.' });
  }
});

export default router;
 */