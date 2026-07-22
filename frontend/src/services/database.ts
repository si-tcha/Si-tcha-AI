import * as SQLite from 'expo-sqlite';

export interface HarvestRecord {
  id: string;
  product: string;
  volume: number; // en kg
  date: string;
  synced?: boolean;
}

export interface ExpenseRecord {
  id: string;
  label: string;
  amount: number; // en FCFA
  category: string;
  synced?: boolean;
}

export interface CartItemRecord {
  id: string;
  productId: string;
  name: string;
  price: string;
  unit: string;
  quantity: number;
  synced?: boolean;
}

export interface UserProfileRecord {
  id: string;
  name: string;
  phone: string;
  role: 'buyer' | 'seller';
  companyOrGic: string;
}

const DEFAULT_HARVESTS: HarvestRecord[] = [
  { id: '1', product: 'Pommes de terre', volume: 1200, date: '12 Juillet 2026', synced: true },
  { id: '2', product: 'Tomates', volume: 800, date: '18 Juillet 2026', synced: true }
];

const DEFAULT_EXPENSES: ExpenseRecord[] = [
  { id: '1', label: 'Fertilisants NPK', amount: 150000, category: 'Intrants', synced: true },
  { id: '2', label: 'Transport récolte', amount: 45000, category: 'Transport', synced: true },
  { id: '3', label: 'Main d\'œuvre semis', amount: 80000, category: 'Main d\'œuvre', synced: true }
];

const DEFAULT_CART: CartItemRecord[] = [];

/**
 * Implémentation native (iOS/Android) — SQLite via expo-sqlite.
 * Sur le web, Metro résout database.web.ts à la place de ce fichier.
 */
class DatabaseService {
  private getDb() {
    return SQLite.openDatabaseSync('sitcha.db');
  }

  async initDatabase(): Promise<void> {
    try {
      const db = this.getDb();
      db.execSync(`
        CREATE TABLE IF NOT EXISTS harvests (
          id TEXT PRIMARY KEY NOT NULL,
          product TEXT NOT NULL,
          volume REAL NOT NULL,
          date TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS expenses (
          id TEXT PRIMARY KEY NOT NULL,
          label TEXT NOT NULL,
          amount REAL NOT NULL,
          category TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS cart_items (
          id TEXT PRIMARY KEY NOT NULL,
          productId TEXT NOT NULL,
          name TEXT NOT NULL,
          price TEXT NOT NULL,
          unit TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          synced INTEGER DEFAULT 0
        );
      `);
    } catch (err) {
      console.warn('Erreur lors de l’initialisation de SQLite natif:', err);
    }
  }

  async getHarvests(): Promise<HarvestRecord[]> {
    try {
      const db = this.getDb();
      const result = db.getAllSync('SELECT * FROM harvests ORDER BY date DESC;') as any[];
      if (!result.length) return DEFAULT_HARVESTS;
      return result.map((row) => ({
        id: row.id,
        product: row.product,
        volume: row.volume,
        date: row.date,
        synced: Boolean(row.synced),
      }));
    } catch (err) {
      return DEFAULT_HARVESTS;
    }
  }

  async addHarvest(product: string, volume: number): Promise<HarvestRecord> {
    const newHarvest: HarvestRecord = {
      id: Date.now().toString(),
      product,
      volume,
      date: 'Aujourd\'hui',
      synced: false,
    };

    try {
      const db = this.getDb();
      db.runSync(
        'INSERT INTO harvests (id, product, volume, date, synced) VALUES (?, ?, ?, ?, ?);',
        [newHarvest.id, newHarvest.product, newHarvest.volume, newHarvest.date, 0]
      );
    } catch (err) {
      console.warn('Erreur lors de l’ajout SQLite de la récolte:', err);
    }

    return newHarvest;
  }

  async getExpenses(): Promise<ExpenseRecord[]> {
    try {
      const db = this.getDb();
      const result = db.getAllSync('SELECT * FROM expenses;') as any[];
      if (!result.length) return DEFAULT_EXPENSES;
      return result.map((row) => ({
        id: row.id,
        label: row.label,
        amount: row.amount,
        category: row.category,
        synced: Boolean(row.synced),
      }));
    } catch (err) {
      return DEFAULT_EXPENSES;
    }
  }

  async addExpense(label: string, amount: number, category: string): Promise<ExpenseRecord> {
    const newExpense: ExpenseRecord = {
      id: Date.now().toString(),
      label,
      amount,
      category,
      synced: false,
    };

    try {
      const db = this.getDb();
      db.runSync(
        'INSERT INTO expenses (id, label, amount, category, synced) VALUES (?, ?, ?, ?, ?);',
        [newExpense.id, newExpense.label, newExpense.amount, newExpense.category, 0]
      );
    } catch (err) {
      console.warn('Erreur lors de l’ajout SQLite de la dépense:', err);
    }

    return newExpense;
  }

  async getCart(): Promise<CartItemRecord[]> {
    try {
      const db = this.getDb();
      const result = db.getAllSync('SELECT * FROM cart_items;') as any[];
      return result.map((row) => ({
        id: row.id,
        productId: row.productId,
        name: row.name,
        price: row.price,
        unit: row.unit,
        quantity: row.quantity,
        synced: Boolean(row.synced),
      }));
    } catch (err) {
      return DEFAULT_CART;
    }
  }

  async getCartCount(): Promise<number> {
    const cart = await this.getCart();
    return cart.reduce((acc, item) => acc + item.quantity, 0);
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
      try {
        const db = this.getDb();
        db.runSync(
          'UPDATE cart_items SET quantity = ?, synced = 0 WHERE productId = ?;',
          [updatedItem.quantity, product.productId]
        );
      } catch (err) {
        console.warn('Erreur lors de la mise à jour SQLite du panier:', err);
      }
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

    try {
      const db = this.getDb();
      db.runSync(
        'INSERT INTO cart_items (id, productId, name, price, unit, quantity, synced) VALUES (?, ?, ?, ?, ?, ?, ?);',
        [newItem.id, newItem.productId, newItem.name, newItem.price, newItem.unit, newItem.quantity, 0]
      );
    } catch (err) {
      console.warn('Erreur lors de l’ajout SQLite au panier:', err);
    }

    return newItem;
  }

  async getFinancialSummary(): Promise<{ totalVolume: number; totalExpenses: number; costPricePerKg: number }> {
    const harvests = await this.getHarvests();
    const expenses = await this.getExpenses();
    const totalVolume = harvests.reduce((acc, curr) => acc + curr.volume, 0);
    const totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);
    const costPricePerKg = totalVolume > 0 ? Math.round(totalExpenses / totalVolume) : 0;
    return { totalVolume, totalExpenses, costPricePerKg };
  }
}

export const dbService = new DatabaseService();
