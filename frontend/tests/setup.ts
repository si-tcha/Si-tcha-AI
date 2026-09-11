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
  openDatabaseSync: vi.fn(() => ({
    execSync: vi.fn(),
    runSync: (sql: string, params: any[] = []) => {
      if (sql.includes('INSERT') && sql.includes('kv_store')) {
        sqliteKv.set(params[0], String(params[1]));
      } else if (sql.includes('DELETE FROM kv_store')) {
        sqliteKv.delete(params[0]);
      } else if (sql.includes('INSERT INTO cart_items')) {
        // [buyerId, productId, id, name, price, unit, quantity, synced]
        const buyerId = String(params[0]);
        const productId = String(params[1]);
        sqliteCart.set(`${buyerId}:${productId}`, {
          buyerId,
          productId,
          id: params[2],
          name: params[3],
          price: params[4],
          unit: params[5],
          quantity: Number(params[6]),
          synced: Number(params[7]),
        });
      } else if (sql.includes('UPDATE cart_items')) {
        // UPDATE cart_items SET quantity = ?, synced = 0 WHERE buyerId = ? AND productId = ?
        const buyerId = String(params[1]);
        const productId = String(params[2]);
        const item = sqliteCart.get(`${buyerId}:${productId}`);
        if (item) {
          item.quantity = Number(params[0]);
          item.synced = 0;
        }
      } else if (sql.includes('DELETE FROM cart_items WHERE buyerId = ? AND productId = ?')) {
        sqliteCart.delete(`${params[0]}:${params[1]}`);
      } else if (sql.includes('DELETE FROM cart_items WHERE buyerId = ?')) {
        for (const [k, v] of sqliteCart.entries()) {
          if (v.buyerId === String(params[0])) {
            sqliteCart.delete(k);
          }
        }
      } else if (sql.includes('DELETE FROM cart_items')) {
        sqliteCart.clear();
      } else if (sql.includes('INSERT OR REPLACE INTO orders')) {
        // [buyerId, id, type, status, productId, productName, quantity, unit, price, gicName, createdAt, synced]
        const buyerId = String(params[0]);
        const id = String(params[1]);
        sqliteOrders.set(`${buyerId}:${id}`, {
          buyerId,
          id,
          type: params[2],
          status: params[3],
          productId: params[4],
          productName: params[5],
          quantity: Number(params[6]),
          unit: params[7],
          price: params[8],
          gicName: params[9],
          createdAt: params[10],
          synced: Number(params[11]),
        });
      } else if (sql.includes('DELETE FROM orders WHERE buyerId = ?')) {
        for (const [k, v] of sqliteOrders.entries()) {
          if (v.buyerId === String(params[0])) {
            sqliteOrders.delete(k);
          }
        }
      } else if (sql.includes('UPDATE orders SET status =')) {
        for (const v of sqliteOrders.values()) {
          if (v.id === String(params[1])) {
            v.status = params[0];
            v.synced = 0;
          }
        }
      } else if (sql.includes('DELETE FROM orders')) {
        sqliteOrders.clear();
      }
    },
    getFirstSync: (sql: string, params: any[] = []) => {
      if (sql.includes('FROM kv_store WHERE key = ?')) {
        const val = sqliteKv.get(params[0]);
        return val !== undefined ? { value: val } : null;
      }
      if (sql.includes('FROM cart_items WHERE buyerId = ? AND productId = ?')) {
        return sqliteCart.get(`${params[0]}:${params[1]}`) || null;
      }
      if (sql.includes('SUM(quantity)')) {
        let items = Array.from(sqliteCart.values());
        if (sql.includes('WHERE buyerId = ?') && params[0] !== undefined) {
          items = items.filter(i => i.buyerId === String(params[0]));
        }
        const sum = items.reduce(
          (acc, curr) => acc + (Number(curr.quantity) || 0),
          0
        );
        return { count: sum };
      }
      return null;
    },
    getAllSync: (sql: string, params: any[] = []) => {
      if (sql.includes('FROM cart_items')) {
        let items = Array.from(sqliteCart.values());
        if (sql.includes('WHERE buyerId = ?') && params[0] !== undefined) {
          items = items.filter(i => i.buyerId === String(params[0]));
        }
        return items;
      }
      if (sql.includes('FROM orders')) {
        let orders = Array.from(sqliteOrders.values());
        if (sql.includes('WHERE buyerId = ?') && params[0] !== undefined) {
          orders = orders.filter(o => o.buyerId === String(params[0]));
        }
        return orders;
      }
      return [];
    },
  })),
}));
