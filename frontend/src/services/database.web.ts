import * as Crypto from 'expo-crypto';
import { apiClient, isNetworkError } from './api';
import { isValidAgronomistCacheKey, isValidParcelCacheKey } from '../utils/cacheKey';
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
  getBuyerCartKey,
  getBuyerOrdersKey,
  getBuyerClientRequestIdKey,
  getBuyerAlertPrefsKey,
  validateBuyerId,
  isValidBuyerId,
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

function readJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback;
  const data = localStorage.getItem(key);
  return data ? (JSON.parse(data) as T) : fallback;
}

function writeJson(key: string, value: unknown) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

function writePrivateJsonOrThrow(key: string, value: unknown) {
  if (typeof localStorage === 'undefined') {
    throw new Error('Stockage privé local indisponible.');
  }
  localStorage.setItem(key, JSON.stringify(value));
}

function ensure(key: string, fallback: unknown) {
  if (typeof localStorage === 'undefined') return;
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, JSON.stringify(fallback));
  }
}

function generateClientRequestId(): string {
  try {
    if (typeof Crypto?.randomUUID === 'function') {
      return Crypto.randomUUID();
    }
  } catch {}
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let syncErrorHandler: ((message?: string) => void) | null = null;
export function setSyncErrorHandler(handler: (message?: string) => void) {
  syncErrorHandler = handler;
}

class DatabaseService {
  private activeBuyerId: string | null = null;
  private contextGeneration = 0;

  setActiveBuyerId(buyerId: string | null): void {
    if (buyerId === null || buyerId === undefined || buyerId === '') {
      this.activeBuyerId = null;
      this.contextGeneration++;
      return;
    }
    this.activeBuyerId = validateBuyerId(buyerId);
    this.contextGeneration++;
  }

  getActiveBuyerId(): string | null {
    return this.activeBuyerId;
  }

  getContextGeneration(): number {
    return this.contextGeneration;
  }

  requireActiveBuyerId(): string {
    if (!this.activeBuyerId) {
      throw new Error('Opération non autorisée : un acheteur actif connecté est requis.');
    }
    return validateBuyerId(this.activeBuyerId);
  }

  getCartKey(): string {
    return getBuyerCartKey(this.requireActiveBuyerId());
  }

  getOrdersKey(): string {
    return getBuyerOrdersKey(this.requireActiveBuyerId());
  }

  getClientRequestIdKey(): string {
    return getBuyerClientRequestIdKey(this.requireActiveBuyerId());
  }

  getAlertPrefsKey(): string {
    return getBuyerAlertPrefsKey(this.requireActiveBuyerId());
  }

  async getCartForBuyer(buyerId: string): Promise<CartItemRecord[]> {
    const validBuyerId = validateBuyerId(buyerId);
    return readJson<CartItemRecord[]>(getBuyerCartKey(validBuyerId), []);
  }

  private async fetchAllPublicProducts(): Promise<ProductOffer[]> {
    let page = 1;
    const limit = 50;
    const maxPages = 20;
    const allProducts: ProductOffer[] = [];
    const seenIds = new Set<string>();

    while (page <= maxPages) {
      const res = await apiClient.getProducts(page, limit);
      if (!Array.isArray(res?.products) || res.products.length === 0) {
        break;
      }
      for (const p of res.products as ProductOffer[]) {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id);
          allProducts.push(p);
        }
      }
      if (!res.meta || page >= res.meta.totalPages) {
        break;
      }
      page++;
    }
    return allProducts;
  }

  private async fetchAllBuyerOrders(): Promise<OrderRecord[]> {
    this.requireActiveBuyerId();
    let page = 1;
    const limit = 50;
    const maxPages = 20;
    const allOrders: OrderRecord[] = [];
    const seenIds = new Set<string>();

    while (page <= maxPages) {
      const res = await apiClient.getOrders(page, limit);
      if (!Array.isArray(res?.orders) || res.orders.length === 0) {
        break;
      }
      for (const o of res.orders as OrderRecord[]) {
        if (!seenIds.has(o.id)) {
          seenIds.add(o.id);
          allOrders.push(o);
        }
      }
      if (!res.meta || page >= res.meta.totalPages) {
        break;
      }
      page++;
    }
    return allOrders;
  }

  async syncPublicData(): Promise<boolean> {
    try {
      const [products, gicsRes, terrainRes] = await Promise.all([
        this.fetchAllPublicProducts().catch(() => null),
        apiClient.getPublicGics().catch(() => null),
        apiClient.getTerrain().catch(() => null),
      ]);

      let updated = false;
      if (Array.isArray(products) && products.length > 0) {
        writeJson(STORAGE_KEYS.PRODUCTS, products);
        updated = true;
      }
      if (Array.isArray(gicsRes?.gics)) {
        writeJson(STORAGE_KEYS.GICS_PUBLIC, gicsRes.gics);
        updated = true;
      }
      if (terrainRes) {
        if (terrainRes.weather?.length) writeJson(STORAGE_KEYS.WEATHER, terrainRes.weather);
        if (terrainRes.market?.length) writeJson(STORAGE_KEYS.MARKET, terrainRes.market);
        if (terrainRes.phytoAlerts?.length) writeJson(STORAGE_KEYS.PHYTO, terrainRes.phytoAlerts);
        if (terrainRes.programs?.length) writeJson(STORAGE_KEYS.PROGRAMS, terrainRes.programs);
        updated = true;
      }
      return updated;
    } catch {
      return false;
    }
  }

  async syncBuyerData(buyerId?: string): Promise<boolean> {
    const rawId = buyerId || this.activeBuyerId;
    if (!rawId || !isValidBuyerId(rawId)) {
      return false;
    }
    const capturedBuyerId = rawId;
    const capturedGen = this.contextGeneration;

    try {
      const [orders, prefsRes] = await Promise.all([
        this.fetchAllBuyerOrders().catch(() => null),
        apiClient.getAlertPreferences().catch(() => null),
      ]);

      // Si le contexte a changé pendant les requêtes réseau, ignorer la mise à jour
      if (this.contextGeneration !== capturedGen || this.activeBuyerId !== capturedBuyerId) {
        return false;
      }

      let updated = false;
      if (Array.isArray(orders)) {
        writeJson(getBuyerOrdersKey(capturedBuyerId), orders);
        this.lastOrdersSyncSuccessful = true;
        updated = true;
      }
      if (prefsRes?.preferences) {
        writeJson(getBuyerAlertPrefsKey(capturedBuyerId), prefsRes.preferences);
        updated = true;
      }
      return updated;
    } catch {
      return false;
    }
  }

  async syncRemoteData(): Promise<boolean> {
    const publicUpdated = await this.syncPublicData();
    let buyerUpdated = false;
    if (this.activeBuyerId && this.activeBuyerId !== 'anonymous') {
      buyerUpdated = await this.syncBuyerData(this.activeBuyerId);
    }
    return publicUpdated || buyerUpdated;
  }

  async initDatabase(): Promise<void> {
    if (typeof localStorage === 'undefined') return;

    // Purge des anciennes clés globales et anonymes
    const legacyKeys = [
      'sitcha_cart_db',
      'sitcha_cart_db_anonymous',
      'sitcha_orders',
      'sitcha_orders_anonymous',
      'sitcha_alert_prefs',
      'sitcha_alert_prefs_anonymous',
      'sitcha_cart_client_req_id',
      'sitcha_cart_client_req_id_anonymous',
    ];
    for (const k of legacyKeys) {
      localStorage.removeItem(k);
    }

    ensure(STORAGE_KEYS.HARVESTS, DEFAULT_HARVESTS);
    ensure(STORAGE_KEYS.EXPENSES, DEFAULT_EXPENSES);
    ensure(STORAGE_KEYS.GIC_PROFILE, DEFAULT_GIC_PROFILE);
    ensure(STORAGE_KEYS.GIC_MEMBERS, DEFAULT_GIC_MEMBERS);
    ensure(STORAGE_KEYS.GIC_NEEDS, DEFAULT_GIC_NEEDS);
    ensure(STORAGE_KEYS.WEATHER, DEFAULT_WEATHER);
    ensure(STORAGE_KEYS.MARKET, DEFAULT_MARKET);
    ensure(STORAGE_KEYS.PHYTO, DEFAULT_PHYTO);
    ensure(STORAGE_KEYS.PROGRAMS, DEFAULT_PROGRAMS);
    ensure(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
    ensure(STORAGE_KEYS.GICS_PUBLIC, DEFAULT_GICS_PUBLIC);
    ensure(STORAGE_KEYS.SYNC_PEER, DEFAULT_SYNC_PEER);
    ensure(STORAGE_KEYS.LOCAL_ROLE, 'leader');

    // Seules les données publiques sont synchronisées à l'initialisation
    this.syncPublicData().catch(() => {});
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

    // Push to backend PostgreSQL DB so it appears in the Buyer Market
    apiClient.addHarvest(product, volume).then(() => {
      this.syncRemoteData().catch(() => {});
    }).catch(() => {
      if (syncErrorHandler) syncErrorHandler("Mode hors-ligne : récolte sauvegardée localement.");
    });

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

    // Push to backend PostgreSQL DB so it appears in the Buyer Market
    apiClient.addExpense(label, amount, category).then(() => {
      this.syncRemoteData().catch(() => {});
    }).catch(() => {
      if (syncErrorHandler) syncErrorHandler("Mode hors-ligne : dépense sauvegardée localement.");
    });

    return newExpense;
  }

  async getCart(): Promise<CartItemRecord[]> {
    this.requireActiveBuyerId();
    return readJson(this.getCartKey(), DEFAULT_CART);
  }

  async getCartCount(): Promise<number> {
    this.requireActiveBuyerId();
    const cart = await this.getCart();
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }

  async getCartTotal(): Promise<number> {
    this.requireActiveBuyerId();
    const cart = await this.getCart();
    return cart.reduce((sum, item) => sum + (parseFloat(item.price || '0') * item.quantity), 0);
  }

  async getCartClientRequestId(): Promise<string | null> {
    this.requireActiveBuyerId();
    return readJson<string | null>(this.getClientRequestIdKey(), null);
  }

  async getOrCreateCartClientRequestId(): Promise<string> {
    this.requireActiveBuyerId();
    let key = await this.getCartClientRequestId();
    if (!key) {
      key = generateClientRequestId();
      writeJson(this.getClientRequestIdKey(), key);
    }
    return key;
  }

  async invalidateCartClientRequestId(): Promise<void> {
    this.requireActiveBuyerId();
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(this.getClientRequestIdKey());
  }

  async clearCart(): Promise<void> {
    const buyerId = this.requireActiveBuyerId();
    writeJson(getBuyerCartKey(buyerId), []);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(getBuyerClientRequestIdKey(buyerId));
    }
  }

  async addToCart(
    product: {
      productId: string;
      name: string;
      price: string;
      unit: string;
    },
    maxStock?: number
  ): Promise<CartItemRecord> {
    const buyerId = this.requireActiveBuyerId();
    const cartKey = getBuyerCartKey(buyerId);
    const clientReqIdKey = getBuyerClientRequestIdKey(buyerId);
    const targetId = String(product.productId);
    if (maxStock !== undefined && maxStock < 1) {
      throw new Error(`Stock indisponible pour ${product.name}.`);
    }

    const cart = readJson<CartItemRecord[]>(cartKey, []);
    const existing = cart.find((item) => String(item.productId) === targetId);

    if (existing) {
      if (maxStock !== undefined && existing.quantity >= maxStock) {
        throw new Error(`Stock maximum atteint (${maxStock} ${product.unit}).`);
      }
      const updatedItem: CartItemRecord = {
        ...existing,
        quantity: existing.quantity + 1,
        synced: false,
      };
      const updatedCart = cart.map((item) => (String(item.productId) === targetId ? updatedItem : item));
      writeJson(cartKey, updatedCart);
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(clientReqIdKey);
      }
      return updatedItem;
    }

    const newItem: CartItemRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      productId: targetId,
      name: product.name,
      price: product.price,
      unit: product.unit,
      quantity: 1,
      buyerId,
      synced: false,
    };
    writeJson(cartKey, [...cart, newItem]);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(clientReqIdKey);
    }
    return newItem;
  }

  async incrementCartItem(productId: string, maxStock?: number): Promise<CartItemRecord | null> {
    const buyerId = this.requireActiveBuyerId();
    const cartKey = getBuyerCartKey(buyerId);
    const clientReqIdKey = getBuyerClientRequestIdKey(buyerId);
    const targetId = String(productId);
    const cart = readJson<CartItemRecord[]>(cartKey, []);
    const existing = cart.find((item) => String(item.productId) === targetId);
    if (!existing) return null;

    if (maxStock !== undefined && existing.quantity >= maxStock) {
      throw new Error(`Stock maximum atteint (${maxStock} ${existing.unit}).`);
    }

    const updatedItem: CartItemRecord = {
      ...existing,
      quantity: existing.quantity + 1,
      synced: false,
    };
    const updatedCart = cart.map((item) => (String(item.productId) === targetId ? updatedItem : item));
    writeJson(cartKey, updatedCart);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(clientReqIdKey);
    }
    return updatedItem;
  }

  async decrementCartItem(productId: string): Promise<CartItemRecord | null> {
    const buyerId = this.requireActiveBuyerId();
    const cartKey = getBuyerCartKey(buyerId);
    const clientReqIdKey = getBuyerClientRequestIdKey(buyerId);
    const targetId = String(productId);
    const cart = readJson<CartItemRecord[]>(cartKey, []);
    const existing = cart.find((item) => String(item.productId) === targetId);
    if (!existing) return null;

    if (existing.quantity <= 1) {
      await this.removeFromCart(targetId);
      return null;
    }

    const updatedItem: CartItemRecord = {
      ...existing,
      quantity: existing.quantity - 1,
      synced: false,
    };
    const updatedCart = cart.map((item) => (String(item.productId) === targetId ? updatedItem : item));
    writeJson(cartKey, updatedCart);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(clientReqIdKey);
    }
    return updatedItem;
  }

  async removeFromCart(productId: string): Promise<void> {
    const buyerId = this.requireActiveBuyerId();
    const cartKey = getBuyerCartKey(buyerId);
    const clientReqIdKey = getBuyerClientRequestIdKey(buyerId);
    const targetId = String(productId);
    const cart = readJson<CartItemRecord[]>(cartKey, []);
    const updatedCart = cart.filter((item) => String(item.productId) !== targetId);
    writeJson(cartKey, updatedCart);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(clientReqIdKey);
    }
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
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      category,
      description,
      updatedAt: nowIso(),
      authorRole: role,
    };
    const needs = await this.getGicNeeds();
    writeJson(STORAGE_KEYS.GIC_NEEDS, [need, ...needs]);
    return need;
  }

  async updateGicNeed(id: string, category: string, description: string): Promise<GicNeed[]> {
    const needs = await this.getGicNeeds();
    const updated = needs.map((n) => (n.id === id ? { ...n, category, description, updatedAt: nowIso() } : n));
    writeJson(STORAGE_KEYS.GIC_NEEDS, updated);
    return updated;
  }

  async deleteGicNeed(id: string): Promise<GicNeed[]> {
    const needs = await this.getGicNeeds();
    const filtered = needs.filter((n) => n.id !== id);
    writeJson(STORAGE_KEYS.GIC_NEEDS, filtered);
    return filtered;
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

  private lastOrdersSyncSuccessful = true;

  isLastOrdersSyncSuccessful(): boolean {
    return this.lastOrdersSyncSuccessful;
  }

  async getOrders(syncWithServer = true): Promise<OrderRecord[]> {
    const capturedBuyerId = this.requireActiveBuyerId();
    const capturedGen = this.contextGeneration;
    const ordersKey = getBuyerOrdersKey(capturedBuyerId);

    if (syncWithServer) {
      try {
        const orders = await this.fetchAllBuyerOrders();
        if (this.contextGeneration === capturedGen && this.activeBuyerId === capturedBuyerId) {
          writeJson(ordersKey, orders);
          this.lastOrdersSyncSuccessful = true;
        }
      } catch (err) {
        if (this.contextGeneration === capturedGen && this.activeBuyerId === capturedBuyerId) {
          this.lastOrdersSyncSuccessful = false;
        }
        if (!isNetworkError(err)) {
          throw err;
        }
        console.warn('Erreur réseau lors de la synchronisation des commandes, repli sur le cache local:', err);
      }
    }
    return readJson(ordersKey, []);
  }

  async createOrderFromCart(type: OrderType): Promise<OrderRecord[]> {
    const capturedBuyerId = this.requireActiveBuyerId();
    const capturedGen = this.contextGeneration;
    const cartKey = getBuyerCartKey(capturedBuyerId);
    const clientReqIdKey = getBuyerClientRequestIdKey(capturedBuyerId);
    const ordersKey = getBuyerOrdersKey(capturedBuyerId);

    const cart = readJson<CartItemRecord[]>(cartKey, []);
    if (!cart.length) return [];

    let clientRequestId = readJson<string | null>(clientReqIdKey, null);
    if (!clientRequestId) {
      clientRequestId = generateClientRequestId();
      writeJson(clientReqIdKey, clientRequestId);
    }

    const items = cart.map((item) => ({ productId: item.productId, quantity: item.quantity }));

    // Appel direct au backend avec la clé d'idempotence
    // Aucune simulation locale : si échec (stock, réseau, 401, 500),
    // l'erreur est propagée, le panier reste INTACT, et la clé d'idempotence conservée pour le retry.
    const res = await apiClient.createOrder(type, items, clientRequestId);

    // En cas de succès serveur (201 ou 200 rejeu idempotent) :
    // 1. Vider le panier du buyerId capturé (pas du nouvel acheteur si contexte changé)
    writeJson(cartKey, []);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(clientReqIdKey);
    }

    // 2. Extraire les commandes renvoyées directement par la réponse du POST
    const serverOrders = (Array.isArray(res?.orders) ? res.orders : []) as OrderRecord[];

    // 3. Mettre à jour immédiatement le cache local du buyerId capturé
    const currentOrders = readJson<OrderRecord[]>(ordersKey, []);
    const mergedMap = new Map<string, OrderRecord>();
    for (const o of serverOrders) {
      mergedMap.set(String(o.id), { ...o, buyerId: capturedBuyerId });
    }
    for (const o of currentOrders) {
      if (!mergedMap.has(String(o.id))) {
        mergedMap.set(String(o.id), o);
      }
    }
    const updatedOrders = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    writeJson(ordersKey, updatedOrders);

    // 4. Vérifier si le contexte actif a changé pendant le POST
    // Si le contexte a déjà changé, ne pas lancer ce GET et lever l'erreur
    if (this.contextGeneration !== capturedGen || this.activeBuyerId !== capturedBuyerId) {
      throw new Error('Contexte acheteur modifié pendant la création de la commande.');
    }

    // 5. Déclencher en tâche de fond la synchronisation complète du cache capturé UNIQUEMENT si contexte inchangé
    this.fetchAllBuyerOrders()
      .then((allOrders) => {
        // Avant toute écriture du résultat GET, revérifier buyerId + génération
        if (this.contextGeneration !== capturedGen || this.activeBuyerId !== capturedBuyerId) {
          // Si le contexte a changé à n’importe quel moment, ignorer le résultat
          return;
        }
        if (Array.isArray(allOrders)) {
          writeJson(ordersKey, allOrders);
        }
      })
      .catch((bgErr) => {
        console.warn('Synchro en tâche de fond des commandes après POST non bloquante:', bgErr);
      });

    return updatedOrders;
  }

  async getAlertPreferences(): Promise<AlertPreferences> {
    const capturedBuyerId = this.requireActiveBuyerId();
    const capturedGen = this.contextGeneration;
    const prefsKey = getBuyerAlertPrefsKey(capturedBuyerId);

    try {
      const res = await apiClient.getAlertPreferences();
      if (res?.preferences) {
        if (this.contextGeneration === capturedGen && this.activeBuyerId === capturedBuyerId) {
          writeJson(prefsKey, res.preferences);
        }
        return res.preferences;
      }
    } catch (err) {
      if (!isNetworkError(err)) {
        throw err;
      }
      console.warn('Mode hors-ligne : lecture des alertes depuis le cache local.');
    }
    return readJson(prefsKey, DEFAULT_ALERT_PREFS);
  }

  async saveAlertPreferences(prefs: AlertPreferences): Promise<AlertPreferences> {
    const capturedBuyerId = this.requireActiveBuyerId();
    const capturedGen = this.contextGeneration;
    const prefsKey = getBuyerAlertPrefsKey(capturedBuyerId);

    try {
      const res = await apiClient.saveAlertPreferences(prefs);
      const saved = res?.preferences || prefs;
      if (this.contextGeneration === capturedGen && this.activeBuyerId === capturedBuyerId) {
        writeJson(prefsKey, saved);
      }
      return saved;
    } catch (err) {
      if (isNetworkError(err)) {
        if (this.contextGeneration === capturedGen && this.activeBuyerId === capturedBuyerId) {
          writeJson(prefsKey, prefs);
        }
        return prefs;
      }
      throw err;
    }
  }

  async getMatchingAlertCount(): Promise<number> {
    this.requireActiveBuyerId();
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

  // --- Agronome (Lot C) ---
  async getAgronomistQuestions(): Promise<AgronomistQuestion[]> {
    return readJson(STORAGE_KEYS.AGRONOMIST_QUESTIONS, DEFAULT_AGRONOMIST_QUESTIONS);
  }

  async addAgronomistQuestion(crop: string, category: string, question: string, photoUrl?: string): Promise<AgronomistQuestion> {
    const list = await this.getAgronomistQuestions();
    const newQ: AgronomistQuestion = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      crop,
      category,
      question,
      photoUrl,
      status: 'en_attente',
      createdAt: nowIso(),
      synced: false,
    };
    list.unshift(newQ);
    writeJson(STORAGE_KEYS.AGRONOMIST_QUESTIONS, list);

    try {
      const res = await apiClient.askAgronomist(crop, category, question);
      if (res && res.answer) {
        newQ.answer = res.answer;
        newQ.status = 'repondu';
        newQ.synced = true;
        // Mettre à jour dans la liste
        const index = list.findIndex(q => q.id === newQ.id);
        if (index !== -1) {
          list[index] = newQ;
          writeJson(STORAGE_KEYS.AGRONOMIST_QUESTIONS, list);
        }
      }
    } catch (e) {
      console.warn('Erreur appel IA Agronome, restera en attente:', e);
    }

    return newQ;
  }

  // --- B2B Trade & Equipment (Lot C) ---
  async getB2BOffers(): Promise<B2BOffer[]> {
    return readJson(STORAGE_KEYS.B2B_OFFERS, DEFAULT_B2B_OFFERS);
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
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
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
    writeJson(STORAGE_KEYS.B2B_OFFERS, list);
    return newOffer;
  }

  // --- Journal de Croissance & Alertes Rendement (Lot D) ---

  /**
   * Lit les parcelles depuis le localStorage sous une clé isolée par utilisateur.
   * @param cacheKey - Clé obligatoire isolée par (role, userId, gicId) via parcelCacheKey().
   */
  async getParcels(cacheKey: string): Promise<ParcelGrowthRecord[]> {
    if (!isValidParcelCacheKey(cacheKey)) {
      throw new Error('Clé de cache privée obligatoire et valide requise pour accéder aux parcelles.');
    }
    return readJson<ParcelGrowthRecord[]>(cacheKey, []);
  }

  /**
   * Sauvegarde les parcelles confirmées par le serveur dans le localStorage sous une clé isolée.
   * JAMAIS appelé directement par l'UI : passe exclusivement par growthService.
   * @param cacheKey - Clé obligatoire isolée via parcelCacheKey().
   */
  async saveParcels(parcels: ParcelGrowthRecord[], cacheKey: string): Promise<void> {
    if (!isValidParcelCacheKey(cacheKey)) {
      throw new Error('Clé de cache privée obligatoire et valide requise pour sauvegarder les parcelles.');
    }
    writePrivateJsonOrThrow(cacheKey, parcels);
  }

  // addParcel et updateParcelHarvest sont intentionnellement supprimés.
  // Ces méthodes créaient des enregistrements locaux avec id=Date.now() et synced=false,
  // permettant à l'UI de présenter des parcelles non confirmées par le serveur.
  // Toute création/modification passe exclusivement par growthService → apiClient → serveur.

  // --- Historique agronome — Persistance par utilisateur (Lot D) ---

  /** Lit l'historique agronome depuis localStorage (clé isolée par user). */
  async getAgronomistHistory<T>(cacheKey: string): Promise<T[]> {
    if (!isValidAgronomistCacheKey(cacheKey)) {
      throw new Error('Clé de cache agronome privée obligatoire et valide requise.');
    }
    return readJson<T[]>(cacheKey, []);
  }

  /** Persiste l'historique agronome dans localStorage (clé isolée par user). */
  async saveAgronomistHistory<T>(cacheKey: string, entries: T[]): Promise<void> {
    if (!isValidAgronomistCacheKey(cacheKey)) {
      throw new Error('Clé de cache agronome privée obligatoire et valide requise.');
    }
    writePrivateJsonOrThrow(cacheKey, entries);
  }


  // --- Préfinancement & Trust Score (Lot D) ---
  async getPrefinancingDeals(): Promise<PrefinancingDeal[]> {
    return readJson(STORAGE_KEYS.PREFINANCING, DEFAULT_PREFINANCING);
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
    writeJson(STORAGE_KEYS.PREFINANCING, list);
    return newDeal;
  }

  async getTrustRatings(): Promise<TrustRating[]> {
    return readJson(STORAGE_KEYS.TRUST_RATINGS, DEFAULT_TRUST_RATINGS);
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
    writeJson(STORAGE_KEYS.TRUST_RATINGS, list);
    return newRating;
  }
}

export const dbService = new DatabaseService();
export { validateBuyerId, isValidBuyerId };
