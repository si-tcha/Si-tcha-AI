import {
  AgriProgramRecord,
  AlertPreferences,
  CartItemRecord,
  ConfidentialGic,
  DEFAULT_ALERT_PREFS,
  DEFAULT_CART,
  DEFAULT_EXPENSES,
  DEFAULT_GICS_PUBLIC,
  DEFAULT_GIC_MEMBERS,
  DEFAULT_GIC_NEEDS,
  DEFAULT_GIC_PROFILE,
  DEFAULT_HARVESTS,
  DEFAULT_MARKET,
  DEFAULT_PHYTO,
  DEFAULT_PRODUCTS,
  DEFAULT_PROGRAMS,
  DEFAULT_SYNC_PEER,
  DEFAULT_WEATHER,
  ExpenseRecord,
  GicMember,
  GicNeed,
  GicProfile,
  HarvestRecord,
  MarketPriceRecord,
  OrderRecord,
  OrderType,
  PhytoAlertRecord,
  ProductOffer,
  STORAGE_KEYS,
  SyncResult,
  WeatherRecord,
  nowIso,
} from './database.shared';

export type {
  AgriProgramRecord,
  AlertPreferences,
  CartItemRecord,
  ConfidentialGic,
  ExpenseRecord,
  GicMember,
  GicNeed,
  GicProfile,
  HarvestRecord,
  MarketPriceRecord,
  OrderRecord,
  OrderType,
  OrderStatus,
  PhytoAlertRecord,
  ProductOffer,
  SyncResult,
  WeatherRecord,
} from './database.shared';

function readJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback;
  const data = localStorage.getItem(key);
  return data ? (JSON.parse(data) as T) : fallback;
}

function writeJson(key: string, value: unknown) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

function ensure(key: string, fallback: unknown) {
  if (typeof localStorage === 'undefined') return;
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, JSON.stringify(fallback));
  }
}

class DatabaseService {
  async initDatabase(): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    ensure(STORAGE_KEYS.HARVESTS, DEFAULT_HARVESTS);
    ensure(STORAGE_KEYS.EXPENSES, DEFAULT_EXPENSES);
    ensure(STORAGE_KEYS.CART, DEFAULT_CART);
    ensure(STORAGE_KEYS.GIC_PROFILE, DEFAULT_GIC_PROFILE);
    ensure(STORAGE_KEYS.GIC_MEMBERS, DEFAULT_GIC_MEMBERS);
    ensure(STORAGE_KEYS.GIC_NEEDS, DEFAULT_GIC_NEEDS);
    ensure(STORAGE_KEYS.WEATHER, DEFAULT_WEATHER);
    ensure(STORAGE_KEYS.MARKET, DEFAULT_MARKET);
    ensure(STORAGE_KEYS.PHYTO, DEFAULT_PHYTO);
    ensure(STORAGE_KEYS.PROGRAMS, DEFAULT_PROGRAMS);
    ensure(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
    ensure(STORAGE_KEYS.GICS_PUBLIC, DEFAULT_GICS_PUBLIC);
    ensure(STORAGE_KEYS.ORDERS, []);
    ensure(STORAGE_KEYS.ALERT_PREFS, DEFAULT_ALERT_PREFS);
    ensure(STORAGE_KEYS.SYNC_PEER, DEFAULT_SYNC_PEER);
    ensure(STORAGE_KEYS.LOCAL_ROLE, 'leader');
  }

  async getLocalRole(): Promise<'leader' | 'member'> {
    return readJson<'leader' | 'member'>(STORAGE_KEYS.LOCAL_ROLE, 'leader');
  }

  async setLocalRole(role: 'leader' | 'member'): Promise<void> {
    writeJson(STORAGE_KEYS.LOCAL_ROLE, role);
  }

  async getHarvests(): Promise<HarvestRecord[]> {
    return readJson(STORAGE_KEYS.HARVESTS, DEFAULT_HARVESTS);
  }

  async addHarvest(product: string, volume: number): Promise<HarvestRecord> {
    const role = await this.getLocalRole();
    const newHarvest: HarvestRecord = {
      id: Date.now().toString(),
      product,
      volume,
      date: 'Aujourd\'hui',
      synced: false,
      updatedAt: nowIso(),
      authorRole: role,
    };
    const harvests = await this.getHarvests();
    writeJson(STORAGE_KEYS.HARVESTS, [newHarvest, ...harvests]);
    return newHarvest;
  }

  async getExpenses(): Promise<ExpenseRecord[]> {
    return readJson(STORAGE_KEYS.EXPENSES, DEFAULT_EXPENSES);
  }

  async addExpense(label: string, amount: number, category: string): Promise<ExpenseRecord> {
    const role = await this.getLocalRole();
    const newExpense: ExpenseRecord = {
      id: Date.now().toString(),
      label,
      amount,
      category,
      synced: false,
      updatedAt: nowIso(),
      authorRole: role,
    };
    const expenses = await this.getExpenses();
    writeJson(STORAGE_KEYS.EXPENSES, [newExpense, ...expenses]);
    return newExpense;
  }

  async getCart(): Promise<CartItemRecord[]> {
    return readJson(STORAGE_KEYS.CART, DEFAULT_CART);
  }

  async getCartCount(): Promise<number> {
    const cart = await this.getCart();
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }

  async clearCart(): Promise<void> {
    writeJson(STORAGE_KEYS.CART, []);
  }

  async addToCart(product: {
    productId: string;
    name: string;
    price: string;
    unit: string;
  }): Promise<CartItemRecord> {
    const cart = await this.getCart();
    const existing = cart.find((item) => item.productId === product.productId);

    if (existing) {
      const updatedItem: CartItemRecord = {
        ...existing,
        quantity: existing.quantity + 1,
        synced: false,
      };
      writeJson(
        STORAGE_KEYS.CART,
        cart.map((item) => (item.productId === product.productId ? updatedItem : item))
      );
      return updatedItem;
    }

    const newItem: CartItemRecord = {
      id: Date.now().toString(),
      productId: product.productId,
      name: product.name,
      price: product.price,
      unit: product.unit,
      quantity: 1,
      synced: false,
    };
    writeJson(STORAGE_KEYS.CART, [newItem, ...cart]);
    return newItem;
  }

  async getGicProfile(): Promise<GicProfile> {
    return readJson(STORAGE_KEYS.GIC_PROFILE, DEFAULT_GIC_PROFILE);
  }

  async updateGicProfile(patch: Partial<GicProfile>): Promise<GicProfile> {
    const role = await this.getLocalRole();
    const current = await this.getGicProfile();
    const updated: GicProfile = {
      ...current,
      ...patch,
      updatedAt: nowIso(),
      authorRole: role,
    };
    writeJson(STORAGE_KEYS.GIC_PROFILE, updated);
    return updated;
  }

  async getGicMembers(): Promise<GicMember[]> {
    return readJson(STORAGE_KEYS.GIC_MEMBERS, DEFAULT_GIC_MEMBERS);
  }

  async getGicNeeds(): Promise<GicNeed[]> {
    return readJson(STORAGE_KEYS.GIC_NEEDS, DEFAULT_GIC_NEEDS);
  }

  async addGicNeed(category: string, description: string): Promise<GicNeed> {
    const role = await this.getLocalRole();
    const need: GicNeed = {
      id: Date.now().toString(),
      category,
      description,
      updatedAt: nowIso(),
      authorRole: role,
    };
    const needs = await this.getGicNeeds();
    writeJson(STORAGE_KEYS.GIC_NEEDS, [need, ...needs]);
    return need;
  }

  async getWeather(): Promise<WeatherRecord[]> {
    return readJson(STORAGE_KEYS.WEATHER, DEFAULT_WEATHER);
  }

  async getMarketPrices(): Promise<MarketPriceRecord[]> {
    return readJson(STORAGE_KEYS.MARKET, DEFAULT_MARKET);
  }

  async getPhytoAlerts(): Promise<PhytoAlertRecord[]> {
    return readJson(STORAGE_KEYS.PHYTO, DEFAULT_PHYTO);
  }

  async getAgriPrograms(): Promise<AgriProgramRecord[]> {
    return readJson(STORAGE_KEYS.PROGRAMS, DEFAULT_PROGRAMS);
  }

  async getProducts(): Promise<ProductOffer[]> {
    return readJson(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
  }

  async getConfidentialGics(): Promise<ConfidentialGic[]> {
    return readJson(STORAGE_KEYS.GICS_PUBLIC, DEFAULT_GICS_PUBLIC);
  }

  async getOrders(): Promise<OrderRecord[]> {
    return readJson(STORAGE_KEYS.ORDERS, []);
  }

  async createOrderFromCart(type: OrderType): Promise<OrderRecord[]> {
    const cart = await this.getCart();
    if (!cart.length) return [];
    const products = await this.getProducts();
    const created: OrderRecord[] = cart.map((item, index) => {
      const offer = products.find((p) => p.id === item.productId);
      return {
        id: `${Date.now()}-${index}`,
        type,
        status: type === 'reservation' ? 'en_attente' : 'confirmee',
        productId: item.productId,
        productName: item.name,
        quantity: item.quantity,
        unit: item.unit,
        price: item.price,
        gicName: offer?.gicName ?? 'GIC partenaire',
        createdAt: nowIso(),
      };
    });
    const existing = await this.getOrders();
    writeJson(STORAGE_KEYS.ORDERS, [...created, ...existing]);
    await this.clearCart();
    return created;
  }

  async getAlertPreferences(): Promise<AlertPreferences> {
    return readJson(STORAGE_KEYS.ALERT_PREFS, DEFAULT_ALERT_PREFS);
  }

  async saveAlertPreferences(prefs: AlertPreferences): Promise<AlertPreferences> {
    writeJson(STORAGE_KEYS.ALERT_PREFS, prefs);
    return prefs;
  }

  async getMatchingAlertCount(): Promise<number> {
    const prefs = await this.getAlertPreferences();
    if (!prefs.productNames.length && !prefs.bassins.length) return 0;
    const products = await this.getProducts();
    return products.filter((p) => {
      const matchProduct =
        !prefs.productNames.length || prefs.productNames.includes(p.name) || prefs.productNames.includes(p.category);
      const matchBassin = !prefs.bassins.length || prefs.bassins.includes(p.bassin);
      return matchProduct && matchBassin;
    }).length;
  }

  async getFinancialSummary(): Promise<{
    totalVolume: number;
    totalExpenses: number;
    costPricePerKg: number;
    costPricePerHa: number;
    surfaceHa: number;
  }> {
    const harvests = await this.getHarvests();
    const expenses = await this.getExpenses();
    const profile = await this.getGicProfile();
    const totalVolume = harvests.reduce((acc, curr) => acc + curr.volume, 0);
    const totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);
    const costPricePerKg = totalVolume > 0 ? Math.round(totalExpenses / totalVolume) : 0;
    const surfaceHa = profile.surfaceHa || 0;
    const costPricePerHa = surfaceHa > 0 ? Math.round(totalExpenses / surfaceHa) : 0;
    return { totalVolume, totalExpenses, costPricePerKg, costPricePerHa, surfaceHa };
  }

  async getLastSyncAt(): Promise<string | null> {
    return readJson<string | null>(STORAGE_KEYS.LAST_SYNC, null);
  }

  /**
   * Sync mock type Xender : merge peer device data.
   * En conflit sur même id, la saisie Leader prévaut.
   */
  async runMockSync(): Promise<SyncResult> {
    const peer = readJson(STORAGE_KEYS.SYNC_PEER, DEFAULT_SYNC_PEER);
    let conflictsResolvedByLeader = 0;
    let mergedCount = 0;

    const mergeById = <T extends { id: string; updatedAt?: string; authorRole?: 'leader' | 'member' }>(
      local: T[],
      remote: T[]
    ): T[] => {
      const map = new Map<string, T>();
      local.forEach((item) => map.set(item.id, item));
      remote.forEach((remoteItem) => {
        const existing = map.get(remoteItem.id);
        if (!existing) {
          map.set(remoteItem.id, remoteItem);
          mergedCount += 1;
          return;
        }
        const localTs = existing.updatedAt ? Date.parse(existing.updatedAt) : 0;
        const remoteTs = remoteItem.updatedAt ? Date.parse(remoteItem.updatedAt) : 0;
        if (remoteTs > localTs) {
          if (existing.authorRole === 'leader' && remoteItem.authorRole === 'member') {
            conflictsResolvedByLeader += 1;
            return;
          }
          if (remoteItem.authorRole === 'leader' && existing.authorRole === 'member') {
            map.set(remoteItem.id, remoteItem);
            conflictsResolvedByLeader += 1;
            mergedCount += 1;
            return;
          }
          map.set(remoteItem.id, remoteItem);
          mergedCount += 1;
        } else if (remoteTs === localTs && remoteItem.authorRole === 'leader' && existing.authorRole !== 'leader') {
          map.set(remoteItem.id, remoteItem);
          conflictsResolvedByLeader += 1;
          mergedCount += 1;
        }
      });
      return Array.from(map.values());
    };

    const harvests = mergeById(await this.getHarvests(), peer.harvests ?? []);
    const expenses = mergeById(await this.getExpenses(), peer.expenses ?? []);
    const needs = mergeById(await this.getGicNeeds(), peer.needs ?? []);

    writeJson(STORAGE_KEYS.HARVESTS, harvests);
    writeJson(STORAGE_KEYS.EXPENSES, expenses);
    writeJson(STORAGE_KEYS.GIC_NEEDS, needs);

    const lastSyncAt = nowIso();
    writeJson(STORAGE_KEYS.LAST_SYNC, lastSyncAt);

    return {
      mergedCount,
      conflictsResolvedByLeader,
      lastSyncAt,
      summary:
        mergedCount === 0 && conflictsResolvedByLeader === 0
          ? 'Aucune nouveauté à fusionner. Données déjà à jour.'
          : `Fusion terminée : ${mergedCount} élément(s) intégré(s), ${conflictsResolvedByLeader} conflit(s) tranché(s) en faveur du Leader GIC.`,
    };
  }
}

export const dbService = new DatabaseService();
