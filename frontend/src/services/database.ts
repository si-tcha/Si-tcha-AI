import { Platform } from 'react-native';

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

export interface UserProfileRecord {
  id: string;
  name: string;
  phone: string;
  role: 'buyer' | 'seller';
  companyOrGic: string;
}

// Données initiales par défaut (mock/fallback)
const DEFAULT_HARVESTS: HarvestRecord[] = [
  { id: '1', product: 'Pommes de terre', volume: 1200, date: '12 Juillet 2026', synced: true },
  { id: '2', product: 'Tomates', volume: 800, date: '18 Juillet 2026', synced: true }
];

const DEFAULT_EXPENSES: ExpenseRecord[] = [
  { id: '1', label: 'Fertilisants NPK', amount: 150000, category: 'Intrants', synced: true },
  { id: '2', label: 'Transport récolte', amount: 45000, category: 'Transport', synced: true },
  { id: '3', label: 'Main d\'œuvre semis', amount: 80000, category: 'Main d\'œuvre', synced: true }
];

const STORAGE_KEYS = {
  HARVESTS: 'sitcha_harvests_db',
  EXPENSES: 'sitcha_expenses_db',
  PROFILE: 'sitcha_profile_db',
};

class DatabaseService {
  private isWeb = Platform.OS === 'web';

  async initDatabase(): Promise<void> {
    if (this.isWeb) {
      if (!localStorage.getItem(STORAGE_KEYS.HARVESTS)) {
        localStorage.setItem(STORAGE_KEYS.HARVESTS, JSON.stringify(DEFAULT_HARVESTS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.EXPENSES)) {
        localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(DEFAULT_EXPENSES));
      }
    } else {
      try {
        const SQLite = require('expo-sqlite');
        const db = SQLite.openDatabaseSync('sitcha.db');
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
        `);
      } catch (err) {
        console.warn('Erreur lors de l’initialisation de SQLite natif:', err);
      }
    }
  }

  // --- RECOLTES ---
  async getHarvests(): Promise<HarvestRecord[]> {
    if (this.isWeb) {
      const data = localStorage.getItem(STORAGE_KEYS.HARVESTS);
      return data ? JSON.parse(data) : DEFAULT_HARVESTS;
    } else {
      try {
        const SQLite = require('expo-sqlite');
        const db = SQLite.openDatabaseSync('sitcha.db');
        const result = db.getAllSync('SELECT * FROM harvests ORDER BY date DESC;');
        return result.map((row: any) => ({
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
  }

  async addHarvest(product: string, volume: number): Promise<HarvestRecord> {
    const newHarvest: HarvestRecord = {
      id: Date.now().toString(),
      product,
      volume,
      date: 'Aujourd\'hui',
      synced: false,
    };

    if (this.isWeb) {
      const harvests = await this.getHarvests();
      const updated = [newHarvest, ...harvests];
      localStorage.setItem(STORAGE_KEYS.HARVESTS, JSON.stringify(updated));
    } else {
      try {
        const SQLite = require('expo-sqlite');
        const db = SQLite.openDatabaseSync('sitcha.db');
        db.runSync(
          'INSERT INTO harvests (id, product, volume, date, synced) VALUES (?, ?, ?, ?, ?);',
          [newHarvest.id, newHarvest.product, newHarvest.volume, newHarvest.date, 0]
        );
      } catch (err) {
        console.warn('Erreur lors de l’ajout SQLite de la récolte:', err);
      }
    }

    return newHarvest;
  }

  // --- DEPENSES ---
  async getExpenses(): Promise<ExpenseRecord[]> {
    if (this.isWeb) {
      const data = localStorage.getItem(STORAGE_KEYS.EXPENSES);
      return data ? JSON.parse(data) : DEFAULT_EXPENSES;
    } else {
      try {
        const SQLite = require('expo-sqlite');
        const db = SQLite.openDatabaseSync('sitcha.db');
        const result = db.getAllSync('SELECT * FROM expenses;');
        return result.map((row: any) => ({
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
  }

  async addExpense(label: string, amount: number, category: string): Promise<ExpenseRecord> {
    const newExpense: ExpenseRecord = {
      id: Date.now().toString(),
      label,
      amount,
      category,
      synced: false,
    };

    if (this.isWeb) {
      const expenses = await this.getExpenses();
      const updated = [newExpense, ...expenses];
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(updated));
    } else {
      try {
        const SQLite = require('expo-sqlite');
        const db = SQLite.openDatabaseSync('sitcha.db');
        db.runSync(
          'INSERT INTO expenses (id, label, amount, category, synced) VALUES (?, ?, ?, ?, ?);',
          [newExpense.id, newExpense.label, newExpense.amount, newExpense.category, 0]
        );
      } catch (err) {
        console.warn('Erreur lors de l’ajout SQLite de la dépense:', err);
      }
    }

    return newExpense;
  }

  // --- CALCULATEUR COUT DE REVIENT REEL ---
  async getFinancialSummary(): Promise<{ totalVolume: number; totalExpenses: number; costPricePerKg: number }> {
    const harvests = await this.getHarvests();
    const expenses = await this.getExpenses();

    const totalVolume = harvests.reduce((acc, curr) => acc + curr.volume, 0);
    const totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);
    const costPricePerKg = totalVolume > 0 ? Math.round(totalExpenses / totalVolume) : 0;

    return {
      totalVolume,
      totalExpenses,
      costPricePerKg,
    };
  }
}

export const dbService = new DatabaseService();
