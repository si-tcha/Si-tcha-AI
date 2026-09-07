import { vi } from 'vitest';

// Polyfill __DEV__ pour les modules Expo dans l'environnement de test Node
if (typeof (globalThis as any).__DEV__ === 'undefined') {
  (globalThis as any).__DEV__ = true;
}

// Setup polyfill pour localStorage dans l'environnement de test Node
if (typeof globalThis.localStorage === 'undefined') {
  let store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  } as Storage;
}

// Mock expo-crypto pour l'environnement de test Node/Vitest
vi.mock('expo-crypto', () => ({
  randomUUID: () => {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },
}));

// Tables SQLite simulées en mémoire pour les tests natifs
const sqliteKv = new Map<string, string>();
const sqliteCart = new Map<string, any>();
const sqliteOrders = new Map<string, any>();

export function resetSqliteMock() {
  sqliteKv.clear();
  sqliteCart.clear();
  sqliteOrders.clear();
}

(globalThis as any).resetSqliteMock = resetSqliteMock;

// Mock expo-sqlite pour l'environnement de test Node/Vitest
vi.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execSync: vi.fn(),
    runSync: (sql: string, params: any[] = []) => {
      if (sql.includes('INSERT') && sql.includes('kv_store')) {
        sqliteKv.set(params[0], String(params[1]));
      } else if (sql.includes('DELETE FROM kv_store')) {
        sqliteKv.delete(params[0]);
      } else if (sql.includes('INSERT INTO cart_items')) {
        sqliteCart.set(String(params[1]), {
          id: params[0],
          productId: String(params[1]),
          name: params[2],
          price: params[3],
          unit: params[4],
          quantity: Number(params[5]),
          synced: Number(params[6]),
        });
      } else if (sql.includes('UPDATE cart_items')) {
        const item = sqliteCart.get(String(params[1]));
        if (item) {
          item.quantity = Number(params[0]);
          item.synced = 0;
        }
      } else if (sql.includes('DELETE FROM cart_items WHERE productId = ?')) {
        sqliteCart.delete(String(params[0]));
      } else if (sql.includes('DELETE FROM cart_items')) {
        sqliteCart.clear();
      } else if (sql.includes('INSERT OR REPLACE INTO orders')) {
        sqliteOrders.set(String(params[0]), {
          id: params[0],
          type: params[1],
          status: params[2],
          productId: params[3],
          productName: params[4],
          quantity: Number(params[5]),
          unit: params[6],
          price: params[7],
          gicName: params[8],
          createdAt: params[9],
          synced: Number(params[10]),
        });
      } else if (sql.includes('DELETE FROM orders')) {
        sqliteOrders.clear();
      }
    },
    getFirstSync: (sql: string, params: any[] = []) => {
      if (sql.includes('FROM kv_store WHERE key = ?')) {
        const val = sqliteKv.get(params[0]);
        return val !== undefined ? { value: val } : null;
      }
      if (sql.includes('FROM cart_items WHERE productId = ?')) {
        return sqliteCart.get(String(params[0])) || null;
      }
      if (sql.includes('SUM(quantity)')) {
        const sum = Array.from(sqliteCart.values()).reduce(
          (acc, curr) => acc + (Number(curr.quantity) || 0),
          0
        );
        return { count: sum };
      }
      return null;
    },
    getAllSync: (sql: string) => {
      if (sql.includes('FROM cart_items')) {
        return Array.from(sqliteCart.values());
      }
      if (sql.includes('FROM orders')) {
        return Array.from(sqliteOrders.values());
      }
      return [];
    },
  }),
}));
