import * as SQLite from 'expo-sqlite';
import {
  AgriProgramRecord,
  AgronomistQuestion,
  AlertPreferences,
  B2BOffer,
  CartItemRecord,
  ConfidentialGic,
  DEFAULT_AGRONOMIST_QUESTIONS,
  DEFAULT_ALERT_PREFS,
  DEFAULT_B2B_OFFERS,
  DEFAULT_CART,
  DEFAULT_EXPENSES,
  DEFAULT_GICS_PUBLIC,
  DEFAULT_GIC_MEMBERS,
  DEFAULT_GIC_NEEDS,
  DEFAULT_GIC_PROFILE,
  DEFAULT_HARVESTS,
  DEFAULT_MARKET,
  DEFAULT_PARCELS,
  DEFAULT_PHYTO,
  DEFAULT_PREFINANCING,
  DEFAULT_PRODUCTS,
  DEFAULT_PROGRAMS,
  DEFAULT_SYNC_PEER,
  DEFAULT_TRUST_RATINGS,
  DEFAULT_WEATHER,
  ExpenseRecord,
  GicMember,
  GicNeed,
  GicProfile,
  HarvestRecord,
  MarketPriceRecord,
  OrderRecord,
  OrderType,
  ParcelGrowthRecord,
  PhytoAlertRecord,
  PrefinancingDeal,
  ProductOffer,
  STORAGE_KEYS,
  SyncResult,
  TrustRating,
  WeatherRecord,
  nowIso,
} from './database.shared';

export type {
  AgriProgramRecord,
  AgronomistQuestion,
  AlertPreferences,
  B2BOffer,
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
  ParcelGrowthRecord,
  PhytoAlertRecord,
  PrefinancingDeal,
  ProductOffer,
  SyncResult,
  TrustRating,
  WeatherRecord,
} from './database.shared';

/**
 * Implémentation native (iOS/Android) — stockage via expo-sqlite.
 * Table kv_store = miroir des clés JSON (même API que database.web.ts).
 */
class DatabaseService {
  private getDb() {
    return SQLite.openDatabaseSync('sitcha.db');
  }

  private ensureKv(key: string, fallback: unknown) {
    const db = this.getDb();
    const row = db.getFirstSync('SELECT value FROM kv_store WHERE key = ?;', [key]) as
      | { value: string }
      | null;
    if (!row) {
      db.runSync('INSERT INTO kv_store (key, value) VALUES (?, ?);', [
        key,
        JSON.stringify(fallback),
      ]);
    }
  }

  private readKv<T>(key: string, fallback: T): T {
    try {
      const db = this.getDb();
      const row = db.getFirstSync('SELECT value FROM kv_store WHERE key = ?;', [key]) as
        | { value: string }
        | null;
      return row ? (JSON.parse(row.value) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  private writeKv(key: string, value: unknown) {
    const db = this.getDb();
    db.runSync(
      'INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?);',
      [key, JSON.stringify(value)]
    );
  }

  async initDatabase(): Promise<void> {
    try {
      const db = this.getDb();
      db.execSync(`
        CREATE TABLE IF NOT EXISTS kv_store (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
      `);
      this.ensureKv(STORAGE_KEYS.HARVESTS, DEFAULT_HARVESTS);
      this.ensureKv(STORAGE_KEYS.EXPENSES, DEFAULT_EXPENSES);
      this.ensureKv(STORAGE_KEYS.CART, DEFAULT_CART);
      this.ensureKv(STORAGE_KEYS.GIC_PROFILE, DEFAULT_GIC_PROFILE);
      this.ensureKv(STORAGE_KEYS.GIC_MEMBERS, DEFAULT_GIC_MEMBERS);
      this.ensureKv(STORAGE_KEYS.GIC_NEEDS, DEFAULT_GIC_NEEDS);
      this.ensureKv(STORAGE_KEYS.WEATHER, DEFAULT_WEATHER);
      this.ensureKv(STORAGE_KEYS.MARKET, DEFAULT_MARKET);
      this.ensureKv(STORAGE_KEYS.PHYTO, DEFAULT_PHYTO);
      this.ensureKv(STORAGE_KEYS.PROGRAMS, DEFAULT_PROGRAMS);
      this.ensureKv(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
      this.ensureKv(STORAGE_KEYS.GICS_PUBLIC, DEFAULT_GICS_PUBLIC);
      this.ensureKv(STORAGE_KEYS.ORDERS, []);
      this.ensureKv(STORAGE_KEYS.ALERT_PREFS, DEFAULT_ALERT_PREFS);
      this.ensureKv(STORAGE_KEYS.SYNC_PEER, DEFAULT_SYNC_PEER);
      this.ensureKv(STORAGE_KEYS.LOCAL_ROLE, 'leader');
    } catch (err) {
      console.warn('Erreur init expo-sqlite:', err);
    }
  }

  async getLocalRole(): Promise<'leader' | 'member'> {
    return this.readKv<'leader' | 'member'>(STORAGE_KEYS.LOCAL_ROLE, 'leader');
  }

  async setLocalRole(role: 'leader' | 'member'): Promise<void> {
    this.writeKv(STORAGE_KEYS.LOCAL_ROLE, role);
  }

  async getHarvests(): Promise<HarvestRecord[]> {
    return this.readKv(STORAGE_KEYS.HARVESTS, DEFAULT_HARVESTS);
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
    this.writeKv(STORAGE_KEYS.HARVESTS, [newHarvest, ...harvests]);
    return newHarvest;
  }

  async getExpenses(): Promise<ExpenseRecord[]> {
    return this.readKv(STORAGE_KEYS.EXPENSES, DEFAULT_EXPENSES);
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
    this.writeKv(STORAGE_KEYS.EXPENSES, [newExpense, ...expenses]);
    return newExpense;
  }

  async getCart(): Promise<CartItemRecord[]> {
    return this.readKv(STORAGE_KEYS.CART, DEFAULT_CART);
  }

  async getCartCount(): Promise<number> {
    const cart = await this.getCart();
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }

  async clearCart(): Promise<void> {
    this.writeKv(STORAGE_KEYS.CART, []);
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
      this.writeKv(
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
    this.writeKv(STORAGE_KEYS.CART, [newItem, ...cart]);
    return newItem;
  }

  async getGicProfile(): Promise<GicProfile> {
    return this.readKv(STORAGE_KEYS.GIC_PROFILE, DEFAULT_GIC_PROFILE);
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
    this.writeKv(STORAGE_KEYS.GIC_PROFILE, updated);
    return updated;
  }

  async getGicMembers(): Promise<GicMember[]> {
    return this.readKv(STORAGE_KEYS.GIC_MEMBERS, DEFAULT_GIC_MEMBERS);
  }

  async getGicNeeds(): Promise<GicNeed[]> {
    return this.readKv(STORAGE_KEYS.GIC_NEEDS, DEFAULT_GIC_NEEDS);
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
    this.writeKv(STORAGE_KEYS.GIC_NEEDS, [need, ...needs]);
    return need;
  }

  async getWeather(): Promise<WeatherRecord[]> {
    return this.readKv(STORAGE_KEYS.WEATHER, DEFAULT_WEATHER);
  }

  async getMarketPrices(): Promise<MarketPriceRecord[]> {
    return this.readKv(STORAGE_KEYS.MARKET, DEFAULT_MARKET);
  }

  async getPhytoAlerts(): Promise<PhytoAlertRecord[]> {
    return this.readKv(STORAGE_KEYS.PHYTO, DEFAULT_PHYTO);
  }

  async getAgriPrograms(): Promise<AgriProgramRecord[]> {
    return this.readKv(STORAGE_KEYS.PROGRAMS, DEFAULT_PROGRAMS);
  }

  async getProducts(): Promise<ProductOffer[]> {
    return this.readKv(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
  }

  async getConfidentialGics(): Promise<ConfidentialGic[]> {
    return this.readKv(STORAGE_KEYS.GICS_PUBLIC, DEFAULT_GICS_PUBLIC);
  }

  async getOrders(): Promise<OrderRecord[]> {
    return this.readKv(STORAGE_KEYS.ORDERS, []);
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
    this.writeKv(STORAGE_KEYS.ORDERS, [...created, ...existing]);
    await this.clearCart();
    return created;
  }

  async getAlertPreferences(): Promise<AlertPreferences> {
    return this.readKv(STORAGE_KEYS.ALERT_PREFS, DEFAULT_ALERT_PREFS);
  }

  async saveAlertPreferences(prefs: AlertPreferences): Promise<AlertPreferences> {
    this.writeKv(STORAGE_KEYS.ALERT_PREFS, prefs);
    return prefs;
  }

  async getMatchingAlertCount(): Promise<number> {
    const prefs = await this.getAlertPreferences();
    if (!prefs.productNames.length && !prefs.bassins.length) return 0;
    const products = await this.getProducts();
    return products.filter((p) => {
      const matchProduct =
        !prefs.productNames.length ||
        prefs.productNames.includes(p.name) ||
        prefs.productNames.includes(p.category);
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
    return this.readKv<string | null>(STORAGE_KEYS.LAST_SYNC, null);
  }

  async runMockSync(): Promise<SyncResult> {
    const peer = this.readKv(STORAGE_KEYS.SYNC_PEER, DEFAULT_SYNC_PEER);
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
        } else if (
          remoteTs === localTs &&
          remoteItem.authorRole === 'leader' &&
          existing.authorRole !== 'leader'
        ) {
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

    this.writeKv(STORAGE_KEYS.HARVESTS, harvests);
    this.writeKv(STORAGE_KEYS.EXPENSES, expenses);
    this.writeKv(STORAGE_KEYS.GIC_NEEDS, needs);

    const lastSyncAt = nowIso();
    this.writeKv(STORAGE_KEYS.LAST_SYNC, lastSyncAt);

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

  // --- Agronome (Lot C) ---
  async getAgronomistQuestions(): Promise<AgronomistQuestion[]> {
    return this.readKv(STORAGE_KEYS.AGRONOMIST_QUESTIONS, DEFAULT_AGRONOMIST_QUESTIONS);
  }

  async addAgronomistQuestion(crop: string, category: string, question: string, photoUrl?: string): Promise<AgronomistQuestion> {
    const list = await this.getAgronomistQuestions();
    const newQ: AgronomistQuestion = {
      id: Date.now().toString(),
      crop,
      category,
      question,
      photoUrl,
      status: 'en_attente',
      createdAt: nowIso(),
      synced: false,
    };
    list.unshift(newQ);
    this.writeKv(STORAGE_KEYS.AGRONOMIST_QUESTIONS, list);
    return newQ;
  }

  // --- B2B Trade & Equipment (Lot C) ---
  async getB2BOffers(): Promise<B2BOffer[]> {
    return this.readKv(STORAGE_KEYS.B2B_OFFERS, DEFAULT_B2B_OFFERS);
  }

  async addB2BOffer(
    title: string,
    type: 'rent' | 'barter',
    category: string,
    priceOrExchange: string,
    gicName: string,
    location: string,
    contact: string
  ): Promise<B2BOffer> {
    const list = await this.getB2BOffers();
    const newOffer: B2BOffer = {
      id: Date.now().toString(),
      title,
      type,
      category,
      priceOrExchange,
      gicName,
      location,
      contact,
      createdAt: nowIso(),
    };
    list.unshift(newOffer);
    this.writeKv(STORAGE_KEYS.B2B_OFFERS, list);
    return newOffer;
  }

  // --- Journal de Croissance & Alertes Rendement (Lot D) ---
  async getParcels(): Promise<ParcelGrowthRecord[]> {
    return this.readKv(STORAGE_KEYS.PARCELS, DEFAULT_PARCELS);
  }

  async addParcel(
    parcelName: string,
    crop: string,
    sowingDate: string,
    stage: 'Semis' | 'Levée' | 'Floraison' | 'Maturation' | 'Prêt à récolter',
    estimatedHarvestDate: string,
    estimatedVolumeKg: number,
    actualHarvestVolumeKg?: number
  ): Promise<ParcelGrowthRecord> {
    const list = await this.getParcels();
    const newParcel: ParcelGrowthRecord = {
      id: Date.now().toString(),
      parcelName,
      crop,
      sowingDate,
      stage,
      estimatedHarvestDate,
      estimatedVolumeKg,
      actualHarvestVolumeKg,
      updatedAt: nowIso(),
    };
    list.unshift(newParcel);
    this.writeKv(STORAGE_KEYS.PARCELS, list);
    return newParcel;
  }

  // --- Préfinancement & Trust Score (Lot D) ---
  async getPrefinancingDeals(): Promise<PrefinancingDeal[]> {
    return this.readKv(STORAGE_KEYS.PREFINANCING, DEFAULT_PREFINANCING);
  }

  async addPrefinancingDeal(
    gicName: string,
    buyerName: string,
    amountFcfa: number,
    inputDescription: string,
    reservedProduct: string,
    reservedVolumeKg: number
  ): Promise<PrefinancingDeal> {
    const list = await this.getPrefinancingDeals();
    const newDeal: PrefinancingDeal = {
      id: Date.now().toString(),
      gicName,
      buyerName,
      amountFcfa,
      inputDescription,
      reservedProduct,
      reservedVolumeKg,
      status: 'propose',
      createdAt: nowIso(),
    };
    list.unshift(newDeal);
    this.writeKv(STORAGE_KEYS.PREFINANCING, list);
    return newDeal;
  }

  async getTrustRatings(): Promise<TrustRating[]> {
    return this.readKv(STORAGE_KEYS.TRUST_RATINGS, DEFAULT_TRUST_RATINGS);
  }

  async addTrustRating(
    targetId: string,
    targetType: 'gic' | 'buyer',
    rating: number,
    comment: string,
    authorName: string
  ): Promise<TrustRating> {
    const list = await this.getTrustRatings();
    const newRating: TrustRating = {
      id: Date.now().toString(),
      targetId,
      targetType,
      rating,
      comment,
      authorName,
      createdAt: nowIso(),
    };
    list.unshift(newRating);
    this.writeKv(STORAGE_KEYS.TRUST_RATINGS, list);
    return newRating;
  }
}

export const dbService = new DatabaseService();
