import { Router } from 'express';
import { login, me, registerBuyer, registerSeller, requireAuth, AuthRequest } from '../auth';
import { createId, readStore, updateStore } from '../../lib/store';
import { OrderRecord, OrderStatus, OrderType } from '../../domain/types';

const router = Router();

router.post('/auth/register/buyer', registerBuyer);
router.post('/auth/register/seller', registerSeller);
router.post('/auth/login', login);
router.get('/auth/me', requireAuth, me);

router.get('/catalog/products', async (_req, res) => {
  const data = await readStore();
  res.json({ products: data.products });
});

router.get('/gics/public', async (_req, res) => {
  const data = await readStore();
  const gics = data.gics.map((gic) => ({
    id: gic.id,
    name: gic.name,
    identifiantREF: gic.identifiantREF,
    bassin: gic.bassin,
    logoUrl: gic.logoUrl,
  }));
  res.json({ gics });
});

router.get('/terrain', async (_req, res) => {
  const data = await readStore();
  res.json({
    weather: data.weather,
    market: data.market,
    phytoAlerts: data.phytoAlerts,
    programs: data.programs,
  });
});

router.get('/gic/profile', requireAuth, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'seller' || !req.user.gicId) {
    return res.status(403).json({ message: 'Accès GIC requis.' });
  }
  const data = await readStore();
  const profile = data.gics.find((gic) => gic.id === req.user?.gicId);
  const members = data.members.filter((member) => member.gicId === req.user?.gicId);
  const needs = data.needs.filter((need) => need.gicId === req.user?.gicId);
  res.json({ profile, members, needs });
});

router.put('/gic/profile', requireAuth, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'seller' || req.user.gicRole !== 'leader' || !req.user.gicId) {
    return res.status(403).json({ message: 'Privilège Leader requis.' });
  }
  const patch = req.body as { surfaceHa?: number; bassin?: string; statutLegalisation?: string; activitesPrincipales?: string; reglementInterieur?: string };
  const data = await updateStore((draft) => {
    const profile = draft.gics.find((gic) => gic.id === req.user?.gicId);
    if (profile) {
      Object.assign(profile, patch, { updatedAt: new Date().toISOString() });
    }
  });
  res.json({ profile: data.gics.find((gic) => gic.id === req.user?.gicId) });
});

router.get('/gic/harvests', requireAuth, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'seller' || !req.user.gicId) return res.status(403).json({ message: 'Accès GIC requis.' });
  const data = await readStore();
  res.json({ harvests: data.harvests.filter((item) => item.gicId === req.user?.gicId) });
});

router.post('/gic/harvests', requireAuth, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'seller' || !req.user.gicId) return res.status(403).json({ message: 'Accès GIC requis.' });
  const { product, volume } = req.body as { product?: string; volume?: number };
  if (!product?.trim() || !Number.isFinite(Number(volume))) return res.status(400).json({ message: 'product et volume sont requis.' });

  const harvest = {
    id: createId('harvest'),
    gicId: req.user.gicId,
    product: product.trim(),
    volume: Number(volume),
    date: new Date().toISOString().slice(0, 10),
    synced: true,
    updatedAt: new Date().toISOString(),
    authorRole: req.user.gicRole ?? 'member',
  };
  await updateStore((draft) => {
    draft.harvests.unshift(harvest);
  });
  res.status(201).json({ harvest });
});

router.get('/gic/expenses', requireAuth, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'seller' || !req.user.gicId) return res.status(403).json({ message: 'Accès GIC requis.' });
  const data = await readStore();
  res.json({ expenses: data.expenses.filter((item) => item.gicId === req.user?.gicId) });
});

router.post('/gic/expenses', requireAuth, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'seller' || !req.user.gicId) return res.status(403).json({ message: 'Accès GIC requis.' });
  const { label, amount, category } = req.body as { label?: string; amount?: number; category?: string };
  if (!label?.trim() || !category?.trim() || !Number.isFinite(Number(amount))) return res.status(400).json({ message: 'label, category et amount sont requis.' });

  const expense = {
    id: createId('expense'),
    gicId: req.user.gicId,
    label: label.trim(),
    amount: Number(amount),
    category: category.trim(),
    synced: true,
    updatedAt: new Date().toISOString(),
    authorRole: req.user.gicRole ?? 'member',
  };
  await updateStore((draft) => {
    draft.expenses.unshift(expense);
  });
  res.status(201).json({ expense });
});

router.get('/buyer/orders', requireAuth, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'buyer' || !req.user.buyerId) return res.status(403).json({ message: 'Accès acheteur requis.' });
  const data = await readStore();
  res.json({ orders: data.orders.filter((order) => order.buyerId === req.user?.buyerId) });
});

router.post('/buyer/orders', requireAuth, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'buyer' || !req.user.buyerId) return res.status(403).json({ message: 'Accès acheteur requis.' });
  const { type, items } = req.body as {
    type?: OrderType;
    items?: Array<{ productId: string; quantity: number }>;
  };
  if (!type || !items?.length) return res.status(400).json({ message: 'type et items sont requis.' });

  const created: OrderRecord[] = [];
  await updateStore((draft) => {
    for (const item of items) {
      const product = draft.products.find((candidate) => candidate.id === item.productId);
      if (!product) continue;
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) continue;
      product.volumeDisponible = Math.max(0, product.volumeDisponible - quantity);
      const status: OrderStatus = type === 'reservation' ? 'en_attente' : 'confirmee';
      const order: OrderRecord = {
        id: createId('order'),
        buyerId: req.user!.buyerId!,
        type,
        status,
        productId: product.id,
        productName: product.name,
        quantity,
        unit: product.unit,
        price: product.price,
        gicId: product.gicId,
        gicName: product.gicName,
        createdAt: new Date().toISOString(),
      };
      draft.orders.unshift(order);
      created.push(order);
    }
  });

  res.status(201).json({ orders: created });
});

router.get('/buyer/alert-preferences', requireAuth, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'buyer' || !req.user.buyerId) return res.status(403).json({ message: 'Accès acheteur requis.' });
  const data = await readStore();
  const buyer = data.buyers.find((item) => item.id === req.user?.buyerId);
  res.json({ preferences: buyer?.alertPreferences ?? { productNames: [], bassins: [] } });
});

router.put('/buyer/alert-preferences', requireAuth, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'buyer' || !req.user.buyerId) return res.status(403).json({ message: 'Accès acheteur requis.' });
  const preferences = req.body as { productNames?: string[]; bassins?: string[] };
  const data = await updateStore((draft) => {
    const buyer = draft.buyers.find((item) => item.id === req.user?.buyerId);
    if (buyer) {
      buyer.alertPreferences = {
        productNames: Array.isArray(preferences.productNames) ? preferences.productNames : [],
        bassins: Array.isArray(preferences.bassins) ? preferences.bassins : [],
      };
    }
  });
  const buyer = data.buyers.find((item) => item.id === req.user?.buyerId);
  res.json({ preferences: buyer?.alertPreferences ?? { productNames: [], bassins: [] } });
});

export default router;
