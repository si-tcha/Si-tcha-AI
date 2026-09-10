import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { Alert } from 'react-native';
import { apiClient, isNetworkError } from './api';
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
  getBuyerClientRequestIdKey,
  nowIso,
} from './database.shared';

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

export {
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
  STORAGE_KEYS,
};

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

let syncErrorHandler: ((message?: string) => void) | null = null;
export function setSyncErrorHandler(handler: (message?: string) => void) {
  syncErrorHandler = handler;
}

class DatabaseService {
  private dbInstance: SQLite.SQLiteDatabase | null = null;
  private activeBuyerId: string | null = null;

  setActiveBuyerId(buyerId: string | null): void {
    this.activeBuyerId = buyerId;
  }

  getActiveBuyerId(): string | null {
    return this.activeBuyerId;
  }

  private getBuyerId(): string {
    return this.activeBuyerId || 'anonymous';
  }

  private getClientRequestIdKey(): string {
    return getBuyerClientRequestIdKey(this.activeBuyerId);
  }

  private getDb() {
    if (!this.dbInstance) {
      this.dbInstance = SQLite.openDatabaseSync('sitcha.db');
    }
    return this.dbInstance;
  }

  private ensureKv(key: string, fallback: unknown) {
    const db = this.getDb();
    const row = db.getFirstSync('SELECT value FROM kv_store WHERE key = ?;', [key]) as { value: string } | null;
    if (!row) {
      db.runSync('INSERT INTO kv_store (key, value) VALUES (?, ?);', [key, JSON.stringify(fallback)]);
    }
  }

  private readKv<T>(key: string, fallback: T): T {
    try {
      const db = this.getDb();
      db.execSync(`CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
      const row = db.getFirstSync('SELECT value FROM kv_store WHERE key = ?;', [key]) as { value: string } | null;
      return row ? (JSON.parse(row.value) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  private writeKv(key: string, value: unknown) {
    try {
      const db = this.getDb();
      db.execSync(`CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
      db.runSync('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?);', [key, JSON.stringify(value)]);
    } catch (err) {
      console.warn('Erreur writeKv:', err);
    }
  }

  async syncRemoteData(): Promise<boolean> {
    try {
      const [productsRes, gicsRes, terrainRes, harvestsRes, expensesRes, profileRes, ordersRes, b2bRes, parcelsRes, prefinRes, trustRes] = await Promise.all([
        apiClient.getProducts().catch(() => null),
        apiClient.getPublicGics().catch(() => null),
        apiClient.getTerrain().catch(() => null),
        apiClient.getHarvests().catch(() => null),
        apiClient.getExpenses().catch(() => null),
        apiClient.getGicProfile().catch(() => null),
        apiClient.getOrders().catch(() => null),
        apiClient.getB2BOffers().catch(() => null),
        apiClient.getParcels().catch(() => null),
        apiClient.getPrefinancingDeals().catch(() => null),
        apiClient.getTrustRatings().catch(() => null),
      ]);

      let updated = false;
      const db = this.getDb();

      if (Array.isArray(productsRes?.products)) {
        this.writeKv(STORAGE_KEYS.PRODUCTS, productsRes.products);
        updated = true;
      }
      if (Array.isArray(gicsRes?.gics)) {
        this.writeKv(STORAGE_KEYS.GICS_PUBLIC, gicsRes.gics);
        updated = true;
      }
      if (terrainRes) {
        if (Array.isArray(terrainRes.weather)) this.writeKv(STORAGE_KEYS.WEATHER, terrainRes.weather);
        if (Array.isArray(terrainRes.market)) this.writeKv(STORAGE_KEYS.MARKET, terrainRes.market);
        if (Array.isArray(terrainRes.phytoAlerts)) this.writeKv(STORAGE_KEYS.PHYTO, terrainRes.phytoAlerts);
        if (Array.isArray(terrainRes.programs)) this.writeKv(STORAGE_KEYS.PROGRAMS, terrainRes.programs);
        updated = true;
      }
      if (Array.isArray(harvestsRes?.harvests)) {
        db.runSync('DELETE FROM harvests');
        for (const h of (harvestsRes.harvests as any[])) {
          db.runSync(
            'INSERT INTO harvests (id, product, volume, date, synced, updatedAt, authorRole) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [h.id, h.product, h.volume, h.date, 1, h.updatedAt || nowIso(), h.authorRole || 'member']
          );
        }
        updated = true;
      }
      if (expensesRes?.expenses) {
        db.runSync('DELETE FROM expenses');
        for (const e of (expensesRes.expenses as any[])) {
          db.runSync(
            'INSERT INTO expenses (id, label, amount, category, synced, updatedAt, authorRole) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [e.id, e.label, e.amount, e.category, 1, e.updatedAt || nowIso(), e.authorRole || 'member']
          );
        }
        updated = true;
      }
      if (profileRes?.profile) {
        this.writeKv(STORAGE_KEYS.GIC_PROFILE, profileRes.profile);
        if (profileRes.members) this.writeKv(STORAGE_KEYS.GIC_MEMBERS, profileRes.members);
        if (profileRes.needs) {
          db.runSync('DELETE FROM gic_needs');
          for (const n of (profileRes.needs as any[])) {
            db.runSync(
              'INSERT INTO gic_needs (id, category, description, updatedAt, authorRole) VALUES (?, ?, ?, ?, ?)',
              [n.id, n.category, n.description, n.updatedAt || nowIso(), n.authorRole || 'member']
            );
          }
        }
        updated = true;
      }
      if (ordersRes?.orders) {
        const buyerId = this.getBuyerId();
        db.runSync('DELETE FROM orders WHERE buyerId = ? AND (synced = 1 OR synced IS NULL)', [buyerId]);
        for (const o of (ordersRes.orders as any[])) {
          db.runSync(
            'INSERT OR REPLACE INTO orders (buyerId, id, type, status, productId, productName, quantity, unit, price, gicName, createdAt, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [buyerId, o.id, o.type, o.status, o.productId, o.productName, o.quantity, o.unit, o.price, o.gicName, o.createdAt, 1]
          );
        }
        updated = true;
      }
      if (Array.isArray(b2bRes?.offers)) {
        db.runSync('DELETE FROM b2b_offers WHERE synced = 1 OR synced IS NULL');
        for (const o of (b2bRes.offers as any[])) {
          db.runSync(
            'INSERT OR REPLACE INTO b2b_offers (id, title, type, category, priceOrExchange, gicName, location, contact, createdAt, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [o.id, o.title, o.type, o.category, o.priceOrExchange, o.gicName, o.location, o.contact, o.createdAt, 1]
          );
        }
        updated = true;
      }
      if (Array.isArray(parcelsRes?.parcels)) {
        db.runSync('DELETE FROM parcels WHERE synced = 1 OR synced IS NULL');
        for (const p of (parcelsRes.parcels as any[])) {
          db.runSync(
            'INSERT OR REPLACE INTO parcels (id, parcelName, crop, sowingDate, stage, estimatedHarvestDate, estimatedVolumeKg, actualHarvestVolumeKg, updatedAt, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [p.id, p.parcelName, p.crop, p.sowingDate, p.stage, p.estimatedHarvestDate, p.estimatedVolumeKg, p.actualHarvestVolumeKg || null, p.updatedAt, 1]
          );
        }
        updated = true;
      }
      if (Array.isArray(prefinRes?.deals)) {
        db.runSync('DELETE FROM prefinancing WHERE synced = 1 OR synced IS NULL');
        for (const d of (prefinRes.deals as any[])) {
          db.runSync(
            'INSERT OR REPLACE INTO prefinancing (id, gicName, buyerName, amountFcfa, inputDescription, reservedProduct, reservedVolumeKg, status, createdAt, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [d.id, d.gicName, d.buyerName, d.amountFcfa, d.inputDescription, d.reservedProduct, d.reservedVolumeKg, d.status, d.createdAt, 1]
          );
        }
        updated = true;
      }
      if (Array.isArray(trustRes?.ratings)) {
        db.runSync('DELETE FROM trust_ratings WHERE synced = 1 OR synced IS NULL');
        for (const r of (trustRes.ratings as any[])) {
          db.runSync(
            'INSERT OR REPLACE INTO trust_ratings (id, targetId, targetType, rating, comment, authorName, createdAt, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [r.id, r.targetId, r.targetType, r.rating, r.comment, r.authorName, r.createdAt, 1]
          );
        }
        updated = true;
      }

      return updated;
    } catch {
      return false;
    }
  }

  async initDatabase(): Promise<void> {
    try {
      const db = this.getDb();
      db.execSync(`
        CREATE TABLE IF NOT EXISTS kv_store (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS harvests (
          id TEXT PRIMARY KEY, product TEXT, volume REAL, date TEXT, synced INTEGER, updatedAt TEXT, authorRole TEXT
        );
        CREATE TABLE IF NOT EXISTS expenses (
          id TEXT PRIMARY KEY, label TEXT, amount REAL, category TEXT, synced INTEGER, updatedAt TEXT, authorRole TEXT
        );
        CREATE TABLE IF NOT EXISTS cart_items (
          buyerId TEXT NOT NULL DEFAULT 'anonymous',
          productId TEXT NOT NULL,
          id TEXT,
          name TEXT,
          price TEXT,
          unit TEXT,
          quantity INTEGER,
          synced INTEGER,
          PRIMARY KEY (buyerId, productId)
        );
        CREATE TABLE IF NOT EXISTS orders (
          buyerId TEXT NOT NULL DEFAULT 'anonymous',
          id TEXT NOT NULL,
          type TEXT,
          status TEXT,
          productId TEXT,
          productName TEXT,
          quantity REAL,
          unit TEXT,
          price TEXT,
          gicName TEXT,
          createdAt TEXT,
          synced INTEGER,
          PRIMARY KEY (buyerId, id)
        );
        CREATE TABLE IF NOT EXISTS gic_needs (
          id TEXT PRIMARY KEY, category TEXT, description TEXT, updatedAt TEXT, authorRole TEXT
        );
        CREATE TABLE IF NOT EXISTS agronomist_questions (
          id TEXT PRIMARY KEY, crop TEXT, category TEXT, question TEXT, photoUrl TEXT, status TEXT, answer TEXT, createdAt TEXT, synced INTEGER
        );
        CREATE TABLE IF NOT EXISTS b2b_offers (
          id TEXT PRIMARY KEY, title TEXT, type TEXT, category TEXT, priceOrExchange TEXT, gicName TEXT, location TEXT, contact TEXT, createdAt TEXT, synced INTEGER
        );
        CREATE TABLE IF NOT EXISTS parcels (
          id TEXT PRIMARY KEY, parcelName TEXT, crop TEXT, sowingDate TEXT, stage TEXT, estimatedHarvestDate TEXT, estimatedVolumeKg REAL, actualHarvestVolumeKg REAL, updatedAt TEXT, synced INTEGER
        );
        CREATE TABLE IF NOT EXISTS prefinancing (
          id TEXT PRIMARY KEY, gicName TEXT, buyerName TEXT, amountFcfa REAL, inputDescription TEXT, reservedProduct TEXT, reservedVolumeKg REAL, status TEXT, createdAt TEXT, synced INTEGER
        );
        CREATE TABLE IF NOT EXISTS trust_ratings (
          id TEXT PRIMARY KEY, targetId TEXT, targetType TEXT, rating INTEGER, comment TEXT, authorName TEXT, createdAt TEXT, synced INTEGER
        );
      `);

      this.ensureKv(STORAGE_KEYS.GIC_PROFILE, DEFAULT_GIC_PROFILE);
      this.ensureKv(STORAGE_KEYS.GIC_MEMBERS, DEFAULT_GIC_MEMBERS);
      this.ensureKv(STORAGE_KEYS.WEATHER, DEFAULT_WEATHER);
      this.ensureKv(STORAGE_KEYS.MARKET, DEFAULT_MARKET);
      this.ensureKv(STORAGE_KEYS.PHYTO, DEFAULT_PHYTO);
      this.ensureKv(STORAGE_KEYS.PROGRAMS, DEFAULT_PROGRAMS);
      this.ensureKv(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
      this.ensureKv(STORAGE_KEYS.GICS_PUBLIC, DEFAULT_GICS_PUBLIC);
      this.ensureKv(STORAGE_KEYS.ALERT_PREFS, DEFAULT_ALERT_PREFS);
      this.ensureKv(STORAGE_KEYS.SYNC_PEER, DEFAULT_SYNC_PEER);
      this.ensureKv(STORAGE_KEYS.LOCAL_ROLE, 'leader');

      // Migration sécurisée pour cart_items (clé composite buyerId + productId)
      try {
        const cartInfo = db.getAllSync('PRAGMA table_info(cart_items);') as any[];
        if (cartInfo.length > 0 && !cartInfo.some((col: any) => col.name === 'buyerId')) {
          db.execSync(`
            CREATE TABLE cart_items_v2 (
              buyerId TEXT NOT NULL DEFAULT 'anonymous',
              productId TEXT NOT NULL,
              id TEXT,
              name TEXT,
              price TEXT,
              unit TEXT,
              quantity INTEGER,
              synced INTEGER,
              PRIMARY KEY (buyerId, productId)
            );
            INSERT OR IGNORE INTO cart_items_v2 (buyerId, productId, id, name, price, unit, quantity, synced)
            SELECT 'anonymous', productId, id, name, price, unit, quantity, synced FROM cart_items;
            DROP TABLE cart_items;
            ALTER TABLE cart_items_v2 RENAME TO cart_items;
          `);
        }
      } catch (e) {
        console.warn('Erreur migration cart_items SQLite:', e);
      }

      // Migration sécurisée pour orders (clé composite buyerId + id)
      try {
        const ordersInfo = db.getAllSync('PRAGMA table_info(orders);') as any[];
        if (ordersInfo.length > 0 && !ordersInfo.some((col: any) => col.name === 'buyerId')) {
          db.execSync(`
            CREATE TABLE orders_v2 (
              buyerId TEXT NOT NULL DEFAULT 'anonymous',
              id TEXT NOT NULL,
              type TEXT,
              status TEXT,
              productId TEXT,
              productName TEXT,
              quantity REAL,
              unit TEXT,
              price TEXT,
              gicName TEXT,
              createdAt TEXT,
              synced INTEGER,
              PRIMARY KEY (buyerId, id)
            );
            INSERT OR IGNORE INTO orders_v2 (buyerId, id, type, status, productId, productName, quantity, unit, price, gicName, createdAt, synced)
            SELECT 'anonymous', id, type, status, productId, productName, quantity, unit, price, gicName, createdAt, synced FROM orders;
            DROP TABLE orders;
            ALTER TABLE orders_v2 RENAME TO orders;
          `);
        }
      } catch (e) {
        console.warn('Erreur migration orders SQLite:', e);
      }

      // Migrations pour s'assurer que les colonnes 'synced' existent dans les tables préexistantes
      try {
        db.runSync("ALTER TABLE prefinancing ADD COLUMN synced INTEGER;");
      } catch (e) { /* ignore if already exists */ }
      try {
        db.runSync("ALTER TABLE trust_ratings ADD COLUMN synced INTEGER;");
      } catch (e) { /* ignore if already exists */ }
      try {
        db.runSync("ALTER TABLE orders ADD COLUMN synced INTEGER;");
      } catch (e) { /* ignore if already exists */ }

      // Async sync from remote backend if network is online
      this.syncRemoteData().catch(() => {});
    } catch (err) {
      console.warn('Erreur initDatabase:', err);
    }
  }

  async getLocalRole(): Promise<'leader' | 'member'> {
    return this.readKv<'leader' | 'member'>(STORAGE_KEYS.LOCAL_ROLE, 'leader');
  }

  async setLocalRole(role: 'leader' | 'member'): Promise<void> {
    this.writeKv(STORAGE_KEYS.LOCAL_ROLE, role);
  }

  async getHarvests(): Promise<HarvestRecord[]> {
    const rows = this.getDb().getAllSync('SELECT * FROM harvests ORDER BY updatedAt DESC') as any[];
    return rows.map(r => ({ ...r, synced: !!r.synced }));
  }

  async addHarvest(product: string, volume: number): Promise<HarvestRecord> {
    const role = await this.getLocalRole();
    const id = Date.now().toString();
    const date = 'Aujourd\'hui';
    const updatedAt = nowIso();
    const db = this.getDb();

    db.runSync(
      'INSERT INTO harvests (id, product, volume, date, synced, updatedAt, authorRole) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, product, volume, date, 0, updatedAt, role]
    );

    apiClient.addHarvest(product, volume).then(() => {
      db.runSync('UPDATE harvests SET synced = 1 WHERE id = ?', [id]);
      this.syncRemoteData().catch(() => {});
    }).catch(() => {
      if (syncErrorHandler) syncErrorHandler("Mode hors-ligne : récolte sauvegardée localement.");
    });

    return { id, product, volume, date, synced: false, updatedAt, authorRole: role };
  }

  async getExpenses(): Promise<ExpenseRecord[]> {
    const rows = this.getDb().getAllSync('SELECT * FROM expenses ORDER BY updatedAt DESC') as any[];
    return rows.map(r => ({ ...r, synced: !!r.synced }));
  }

  async addExpense(label: string, amount: number, category: string): Promise<ExpenseRecord> {
    const role = await this.getLocalRole();
    const id = Date.now().toString();
    const updatedAt = nowIso();
    const db = this.getDb();

    db.runSync(
      'INSERT INTO expenses (id, label, amount, category, synced, updatedAt, authorRole) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, label, amount, category, 0, updatedAt, role]
    );

    apiClient.addExpense(label, amount, category).then(() => {
      db.runSync('UPDATE expenses SET synced = 1 WHERE id = ?', [id]);
      this.syncRemoteData().catch(() => {});
    }).catch(() => {
      if (syncErrorHandler) syncErrorHandler("Mode hors-ligne : dépense sauvegardée localement.");
    });

    return { id, label, amount, category, synced: false, updatedAt, authorRole: role };
  }

  async getCart(): Promise<CartItemRecord[]> {
    const buyerId = this.getBuyerId();
    const rows = this.getDb().getAllSync('SELECT * FROM cart_items WHERE buyerId = ? ORDER BY rowid ASC', [buyerId]) as any[];
    return rows.map(r => ({ ...r, quantity: Number(r.quantity), synced: !!r.synced }));
  }

  async getCartCount(): Promise<number> {
    const buyerId = this.getBuyerId();
    const row = this.getDb().getFirstSync('SELECT SUM(quantity) as count FROM cart_items WHERE buyerId = ?', [buyerId]) as { count: number | null };
    return Number(row?.count) || 0;
  }

  async getCartTotal(): Promise<number> {
    const items = await this.getCart();
    return items.reduce((sum, item) => sum + (parseFloat(item.price || '0') * item.quantity), 0);
  }

  async getCartClientRequestId(): Promise<string | null> {
    return this.readKv<string | null>(this.getClientRequestIdKey(), null);
  }

  async getOrCreateCartClientRequestId(): Promise<string> {
    let key = await this.getCartClientRequestId();
    if (!key) {
      key = generateClientRequestId();
      this.writeKv(this.getClientRequestIdKey(), key);
    }
    return key;
  }

  async invalidateCartClientRequestId(): Promise<void> {
    try {
      const db = this.getDb();
      db.runSync('DELETE FROM kv_store WHERE key = ?;', [this.getClientRequestIdKey()]);
    } catch {}
  }

  async clearCart(): Promise<void> {
    const buyerId = this.getBuyerId();
    this.getDb().runSync('DELETE FROM cart_items WHERE buyerId = ?', [buyerId]);
    await this.invalidateCartClientRequestId();
  }

  async addToCart(
    product: { productId: string; name: string; price: string; unit: string },
    maxStock?: number
  ): Promise<CartItemRecord> {
    const buyerId = this.getBuyerId();
    const targetId = String(product.productId);
    const db = this.getDb();

    if (maxStock !== undefined && maxStock < 1) {
      throw new Error(`Stock indisponible pour ${product.name}.`);
    }

    const existing = db.getFirstSync('SELECT * FROM cart_items WHERE buyerId = ? AND productId = ?', [buyerId, targetId]) as any;

    if (existing) {
      const currentQty = Number(existing.quantity);
      if (maxStock !== undefined && currentQty >= maxStock) {
        throw new Error(`Stock maximum atteint (${maxStock} ${product.unit}).`);
      }
      const newQuantity = currentQty + 1;
      db.runSync('UPDATE cart_items SET quantity = ?, synced = 0 WHERE buyerId = ? AND productId = ?', [newQuantity, buyerId, targetId]);
      await this.invalidateCartClientRequestId();
      return { ...existing, quantity: newQuantity, synced: false };
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    db.runSync(
      'INSERT INTO cart_items (buyerId, productId, id, name, price, unit, quantity, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [buyerId, targetId, id, product.name, product.price, product.unit, 1, 0]
    );
    await this.invalidateCartClientRequestId();
    return { id, productId: targetId, name: product.name, price: product.price, unit: product.unit, quantity: 1, buyerId, synced: false };
  }

  async incrementCartItem(productId: string, maxStock?: number): Promise<CartItemRecord | null> {
    const buyerId = this.getBuyerId();
    const targetId = String(productId);
    const db = this.getDb();
    const existing = db.getFirstSync('SELECT * FROM cart_items WHERE buyerId = ? AND productId = ?', [buyerId, targetId]) as any;
    if (!existing) return null;

    const currentQty = Number(existing.quantity);
    if (maxStock !== undefined && currentQty >= maxStock) {
      throw new Error(`Stock maximum atteint (${maxStock} ${existing.unit}).`);
    }

    const newQuantity = currentQty + 1;
    db.runSync('UPDATE cart_items SET quantity = ?, synced = 0 WHERE buyerId = ? AND productId = ?', [newQuantity, buyerId, targetId]);
    await this.invalidateCartClientRequestId();
    return { ...existing, quantity: newQuantity, synced: false };
  }

  async decrementCartItem(productId: string): Promise<CartItemRecord | null> {
    const buyerId = this.getBuyerId();
    const targetId = String(productId);
    const db = this.getDb();
    const existing = db.getFirstSync('SELECT * FROM cart_items WHERE buyerId = ? AND productId = ?', [buyerId, targetId]) as any;
    if (!existing) return null;

    const currentQty = Number(existing.quantity);
    if (currentQty <= 1) {
      await this.removeFromCart(targetId);
      return null;
    }

    const newQuantity = currentQty - 1;
    db.runSync('UPDATE cart_items SET quantity = ?, synced = 0 WHERE buyerId = ? AND productId = ?', [newQuantity, buyerId, targetId]);
    await this.invalidateCartClientRequestId();
    return { ...existing, quantity: newQuantity, synced: false };
  }

  async removeFromCart(productId: string): Promise<void> {
    const buyerId = this.getBuyerId();
    const targetId = String(productId);
    this.getDb().runSync('DELETE FROM cart_items WHERE buyerId = ? AND productId = ?', [buyerId, targetId]);
    await this.invalidateCartClientRequestId();
  }

  async getGicProfile(): Promise<GicProfile> {
    return this.readKv(STORAGE_KEYS.GIC_PROFILE, DEFAULT_GIC_PROFILE);
  }

  async updateGicProfile(patch: Partial<GicProfile>): Promise<GicProfile> {
    const role = await this.getLocalRole();
    const current = await this.getGicProfile();
    const updated: GicProfile = { ...current, ...patch, updatedAt: nowIso(), authorRole: role };
    this.writeKv(STORAGE_KEYS.GIC_PROFILE, updated);
    return updated;
  }

  async getGicMembers(): Promise<GicMember[]> {
    return this.readKv(STORAGE_KEYS.GIC_MEMBERS, DEFAULT_GIC_MEMBERS);
  }

  async getGicNeeds(): Promise<GicNeed[]> {
    const rows = this.getDb().getAllSync('SELECT * FROM gic_needs ORDER BY updatedAt DESC') as any[];
    return rows;
  }

  async addGicNeed(category: string, description: string): Promise<GicNeed> {
    const role = await this.getLocalRole();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const updatedAt = nowIso();
    this.getDb().runSync(
      'INSERT INTO gic_needs (id, category, description, updatedAt, authorRole) VALUES (?, ?, ?, ?, ?)',
      [id, category, description, updatedAt, role]
    );

    // Tentative de push direct au backend
    const needPayload = { id, category, description, updatedAt, authorRole: role };
    apiClient.addGicNeed(needPayload).catch(() => console.log('Offline: besoin sauvegardé localement.'));

    return needPayload;
  }

  async updateGicNeed(id: string, category: string, description: string): Promise<GicNeed[]> {
    this.getDb().runSync('UPDATE gic_needs SET category = ?, description = ?, updatedAt = ? WHERE id = ?', [category, description, nowIso(), id]);
    return this.getGicNeeds();
  }

  async deleteGicNeed(id: string): Promise<GicNeed[]> {
    this.getDb().runSync('DELETE FROM gic_needs WHERE id = ?', [id]);
    return this.getGicNeeds();
  }

  async getWeather(): Promise<WeatherRecord[]> { return this.readKv(STORAGE_KEYS.WEATHER, DEFAULT_WEATHER); }
  async getMarketPrices(): Promise<MarketPriceRecord[]> { return this.readKv(STORAGE_KEYS.MARKET, DEFAULT_MARKET); }
  async getPhytoAlerts(): Promise<PhytoAlertRecord[]> { return this.readKv(STORAGE_KEYS.PHYTO, DEFAULT_PHYTO); }
  async getAgriPrograms(): Promise<AgriProgramRecord[]> { return this.readKv(STORAGE_KEYS.PROGRAMS, DEFAULT_PROGRAMS); }
  async getProducts(): Promise<ProductOffer[]> { return this.readKv(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS); }
  async getConfidentialGics(): Promise<ConfidentialGic[]> { return this.readKv(STORAGE_KEYS.GICS_PUBLIC, DEFAULT_GICS_PUBLIC); }

  private lastOrdersSyncSuccessful = true;

  isLastOrdersSyncSuccessful(): boolean {
    return this.lastOrdersSyncSuccessful;
  }

  async getOrders(syncWithServer = true): Promise<OrderRecord[]> {
    const buyerId = this.getBuyerId();
    const db = this.getDb();

    if (syncWithServer) {
      try {
        const res = await apiClient.getOrders();
        if (Array.isArray(res?.orders)) {
          db.runSync('DELETE FROM orders WHERE buyerId = ?', [buyerId]);
          for (const o of (res.orders as any[])) {
            db.runSync(
              'INSERT OR REPLACE INTO orders (buyerId, id, type, status, productId, productName, quantity, unit, price, gicName, createdAt, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [buyerId, o.id, o.type, o.status, o.productId, o.productName, o.quantity, o.unit, o.price, o.gicName, o.createdAt, 1]
            );
          }
          this.lastOrdersSyncSuccessful = true;
        }
      } catch (err) {
        this.lastOrdersSyncSuccessful = false;
        if (!isNetworkError(err)) {
          throw err;
        }
        console.warn('Erreur réseau lors de la synchronisation des commandes avec le serveur:', err);
      }
    }

    const rows = db.getAllSync('SELECT * FROM orders WHERE buyerId = ? ORDER BY createdAt DESC, id DESC', [buyerId]) as any[];
    return rows.map(r => ({ ...r, quantity: Number(r.quantity), synced: !!r.synced }));
  }

  async updateOrderStatus(id: string, status: string): Promise<void> {
    const db = this.getDb();
    db.runSync('UPDATE orders SET status = ?, synced = 0 WHERE id = ?', [status, id]);
    this.syncRemoteData().catch(() => {});
  }

  async createOrderFromCart(type: OrderType): Promise<OrderRecord[]> {
    const cart = await this.getCart();
    if (!cart.length) return [];

    const clientRequestId = await this.getOrCreateCartClientRequestId();
    const items = cart.map(item => ({ productId: item.productId, quantity: item.quantity }));

    // Appel direct au backend avec la clé d'idempotence
    // Aucune simulation locale : si échec (stock, réseau, 401, 500),
    // l'erreur est propagée, le panier reste INTACT, et la clé d'idempotence conservée pour le retry.
    await apiClient.createOrder(type, items, clientRequestId);

    // En cas de succès serveur avéré :
    // 1. Vider le panier local et nettoyer la clé d'idempotence
    await this.clearCart();

    // 2. Récupérer les commandes synchronisées depuis le serveur
    return await this.getOrders(true);
  }

  async getAlertPreferences(): Promise<AlertPreferences> { return this.readKv(STORAGE_KEYS.ALERT_PREFS, DEFAULT_ALERT_PREFS); }
  async saveAlertPreferences(prefs: AlertPreferences): Promise<AlertPreferences> { this.writeKv(STORAGE_KEYS.ALERT_PREFS, prefs); return prefs; }

  async getMatchingAlertCount(): Promise<number> {
    const prefs = await this.getAlertPreferences();
    if (!prefs.productNames.length && !prefs.bassins.length) return 0;
    const products = await this.getProducts();
    return products.filter((p) => {
      const matchProduct = !prefs.productNames.length || prefs.productNames.includes(p.name) || prefs.productNames.includes(p.category);
      const matchBassin = !prefs.bassins.length || prefs.bassins.includes(p.bassin);
      return matchProduct && matchBassin;
    }).length;
  }

  async getFinancialSummary(): Promise<{ totalVolume: number; totalExpenses: number; costPricePerKg: number; costPricePerHa: number; surfaceHa: number; }> {
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

  async getLastSyncAt(): Promise<string | null> { return this.readKv<string | null>(STORAGE_KEYS.LAST_SYNC, null); }

  async runMockSync(): Promise<SyncResult> {
    const lastSyncAt = nowIso();
    try {
      const synced = await this.syncRemoteData();
      this.writeKv(STORAGE_KEYS.LAST_SYNC, lastSyncAt);
      if (synced) {
        return { mergedCount: 1, conflictsResolvedByLeader: 0, lastSyncAt, summary: 'Données synchronisées avec le serveur.' };
      }
      return { mergedCount: 0, conflictsResolvedByLeader: 0, lastSyncAt, summary: 'Données déjà à jour.' };
    } catch {
      this.writeKv(STORAGE_KEYS.LAST_SYNC, lastSyncAt);
      return { mergedCount: 0, conflictsResolvedByLeader: 0, lastSyncAt, summary: 'Synchronisation hors-ligne. Données locales conservées.' };
    }
  }

  // --- Agronome (Lot C) ---
  async getAgronomistQuestions(): Promise<AgronomistQuestion[]> {
    const rows = this.getDb().getAllSync('SELECT * FROM agronomist_questions ORDER BY createdAt DESC') as any[];
    return rows.map(r => ({ ...r, synced: !!r.synced }));
  }

  async addAgronomistQuestion(crop: string, category: string, question: string, photoUrl?: string): Promise<AgronomistQuestion> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const createdAt = nowIso();

    // 1. Sauvegarde locale "en attente"
    this.getDb().runSync(
      'INSERT INTO agronomist_questions (id, crop, category, question, photoUrl, status, createdAt, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, crop, category, question, photoUrl || null, 'en_attente', createdAt, 0]
    );

    let finalStatus = 'en_attente';
    let answer = undefined;

    // 2. Appel au backend pour l'IA Gemini
    try {
      const res = await apiClient.askAgronomist(crop, category, question);
      if (res && res.answer) {
        answer = res.answer;
        finalStatus = 'repondu';

        // Mise à jour de la question locale
        this.getDb().runSync(
          'UPDATE agronomist_questions SET status = ?, answer = ?, synced = ? WHERE id = ?',
          [finalStatus, answer, 1, id]
        );
      }
    } catch (e) {
      console.warn('Erreur appel IA Agronome, restera en attente:', e);
    }

    return { id, crop, category, question, photoUrl, status: finalStatus as any, answer, createdAt, synced: finalStatus === 'repondu' };
  }

  // --- B2B Trade & Equipment (Lot C) ---
  async getB2BOffers(): Promise<B2BOffer[]> {
    return this.getDb().getAllSync('SELECT * FROM b2b_offers ORDER BY createdAt DESC') as any[];
  }

  async addB2BOffer(title: string, type: 'rent' | 'barter', category: string, priceOrExchange: string, gicName: string, location: string, contact: string): Promise<B2BOffer> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const createdAt = nowIso();
    const db = this.getDb();
    db.runSync(
      'INSERT INTO b2b_offers (id, title, type, category, priceOrExchange, gicName, location, contact, createdAt, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, title, type, category, priceOrExchange, gicName, location, contact, createdAt, 0]
    );

    // Background sync to backend
    apiClient.createB2BOffer({ title, type, category, priceOrExchange, gicName, location, contact }).then(() => {
      db.runSync('UPDATE b2b_offers SET synced = 1 WHERE id = ?', [id]);
      this.syncRemoteData().catch(() => {});
    }).catch((e) => {
      if (syncErrorHandler) syncErrorHandler("Mode hors-ligne : offre B2B sauvegardée localement.");
    });

    return { id, title, type, category, priceOrExchange, gicName, location, contact, createdAt };
  }

  // --- Journal de Croissance & Alertes Rendement (Lot D) ---
  async getParcels(): Promise<ParcelGrowthRecord[]> {
    return this.getDb().getAllSync('SELECT * FROM parcels ORDER BY updatedAt DESC') as any[];
  }

  async addParcel(parcelName: string, crop: string, sowingDate: string, stage: 'Semis' | 'Levée' | 'Floraison' | 'Maturation' | 'Prêt à récolter', estimatedHarvestDate: string, estimatedVolumeKg: number, actualHarvestVolumeKg?: number): Promise<ParcelGrowthRecord> {
    const id = Date.now().toString();
    const updatedAt = nowIso();
    const db = this.getDb();
    db.runSync(
      'INSERT INTO parcels (id, parcelName, crop, sowingDate, stage, estimatedHarvestDate, estimatedVolumeKg, actualHarvestVolumeKg, updatedAt, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, parcelName, crop, sowingDate, stage, estimatedHarvestDate, estimatedVolumeKg, actualHarvestVolumeKg || null, updatedAt, 0]
    );

    // Background sync to backend
    apiClient.createParcel({ parcelName, crop, sowingDate, stage, estimatedHarvestDate, estimatedVolumeKg, actualHarvestVolumeKg }).then(() => {
      db.runSync('UPDATE parcels SET synced = 1 WHERE id = ?', [id]);
      this.syncRemoteData().catch(() => {});
    }).catch((e) => {
      if (syncErrorHandler) syncErrorHandler("Mode hors-ligne : parcelle sauvegardée localement.");
    });

    return { id, parcelName, crop, sowingDate, stage, estimatedHarvestDate, estimatedVolumeKg, actualHarvestVolumeKg, updatedAt };
  }

  async updateParcelHarvest(id: string, actualHarvestVolumeKg: number): Promise<void> {
    const db = this.getDb();
    const updatedAt = nowIso();
    db.runSync(
      'UPDATE parcels SET actualHarvestVolumeKg = ?, updatedAt = ?, synced = 0 WHERE id = ?',
      [actualHarvestVolumeKg, updatedAt, id]
    );
    this.syncRemoteData().catch(() => {});
  }

  // --- Préfinancement & Trust Score (Lot D) ---
  async getPrefinancingDeals(): Promise<PrefinancingDeal[]> {
    return this.getDb().getAllSync('SELECT * FROM prefinancing ORDER BY createdAt DESC') as any[];
  }

  async addPrefinancingDeal(gicName: string, buyerName: string, amountFcfa: number, inputDescription: string, reservedProduct: string, reservedVolumeKg: number): Promise<PrefinancingDeal> {
    const id = Date.now().toString();
    const createdAt = nowIso();
    const db = this.getDb();
    try {
      db.runSync(
        'CREATE TABLE IF NOT EXISTS prefinancing (id TEXT PRIMARY KEY, gicName TEXT, buyerName TEXT, amountFcfa REAL, inputDescription TEXT, reservedProduct TEXT, reservedVolumeKg REAL, status TEXT, createdAt TEXT, synced INTEGER)'
      );
      try {
        db.runSync('ALTER TABLE prefinancing ADD COLUMN synced INTEGER');
      } catch (e) {
        // Ignore if column already exists
      }
      db.runSync(
        'INSERT INTO prefinancing (id, gicName, buyerName, amountFcfa, inputDescription, reservedProduct, reservedVolumeKg, status, createdAt, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, gicName, buyerName, amountFcfa, inputDescription, reservedProduct, reservedVolumeKg, 'propose', createdAt, 0]
      );
    } catch (err) {
      console.error("Erreur SQL locale lors de l'insertion prefinancing:", err);
      throw err;
    }

    // Background sync to backend
    apiClient.createPrefinancingDeal({ gicName, buyerName, amountFcfa, inputDescription, reservedProduct, reservedVolumeKg }).then(() => {
      db.runSync('UPDATE prefinancing SET synced = 1 WHERE id = ?', [id]);
      this.syncRemoteData().catch(() => {});
    }).catch((e) => {
      if (syncErrorHandler) syncErrorHandler("Mode hors-ligne : préfinancement sauvegardé localement.");
    });

    return { id, gicName, buyerName, amountFcfa, inputDescription, reservedProduct, reservedVolumeKg, status: 'propose', createdAt };
  }

  async updatePrefinancingDealStatus(id: string, status: string): Promise<void> {
    const db = this.getDb();
    db.runSync('UPDATE prefinancing SET status = ?, synced = 0 WHERE id = ?', [status, id]);

    // Auto-generate order if accepted
    if (status === 'accepte') {
      try {
        const deals = this.getDb().getAllSync('SELECT * FROM prefinancing WHERE id = ?', [id]) as PrefinancingDeal[];
        if (deals && deals.length > 0) {
          const deal = deals[0];
          const orderId = `pref-${deal.id}`;
          const createdAt = nowIso();

          // Check if order already exists
          const existing = db.getAllSync('SELECT id FROM orders WHERE id = ?', [orderId]);
          if (existing.length === 0) {
            const unitPrice = deal.reservedVolumeKg > 0 ? Math.round(deal.amountFcfa / deal.reservedVolumeKg) : deal.amountFcfa;
            db.runSync(
              'INSERT INTO orders (id, type, status, productId, productName, quantity, unit, price, gicName, createdAt, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [orderId, 'reservation', 'confirmee', `prod-${deal.id}`, deal.reservedProduct, deal.reservedVolumeKg, 'kg', unitPrice.toString(), deal.gicName, createdAt, 0]
            );
          }
        }
      } catch (err: any) {
        console.warn('Erreur creation order automatique:', err);
        Alert.alert('Erreur', 'Impossible de créer la commande: ' + (err.message || ''));
      }
    }

    this.syncRemoteData().catch(() => {});
  }

  async getTrustRatings(): Promise<TrustRating[]> {
    return this.getDb().getAllSync('SELECT * FROM trust_ratings ORDER BY createdAt DESC') as any[];
  }

  async addTrustRating(targetId: string, targetType: 'gic' | 'buyer', rating: number, comment: string, authorName: string): Promise<TrustRating> {
    const id = Date.now().toString();
    const createdAt = nowIso();
    const db = this.getDb();

    try {
      db.runSync('ALTER TABLE trust_ratings ADD COLUMN synced INTEGER');
    } catch (e) {
      // Ignore if column exists
    }

    db.runSync(
      'INSERT INTO trust_ratings (id, targetId, targetType, rating, comment, authorName, createdAt, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, targetId, targetType, rating, comment, authorName, createdAt, 0]
    );

    // Background sync to backend
    apiClient.createTrustRating({ targetId, targetType, rating, comment, authorName }).then(() => {
      db.runSync('UPDATE trust_ratings SET synced = 1 WHERE id = ?', [id]);
      this.syncRemoteData().catch(() => {});
    }).catch((e) => {
      if (syncErrorHandler) syncErrorHandler("Mode hors-ligne : évaluation sauvegardée localement.");
    });

    return { id, targetId, targetType, rating, comment, authorName, createdAt };
  }
}

export const dbService = new DatabaseService();
