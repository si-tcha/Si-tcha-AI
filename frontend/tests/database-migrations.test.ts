import { describe, expect, it, vi } from 'vitest';
import { migrateLegacyBuyerTables } from '../src/services/database.ts';

function migrationDb(schemas: Record<string, string[]>) {
  return {
    getAllSync: vi.fn((sql: string) => {
      const tableName = sql.match(/table_info\(([^)]+)\)/)?.[1] ?? '';
      return (schemas[tableName] ?? []).map((name) => ({ name }));
    }),
    execSync: vi.fn(),
  };
}

describe('migration SQLite des données acheteur historiques', () => {
  it('purge les anciennes tables sans buyerId avant leur recréation sécurisée', () => {
    const db = migrationDb({
      cart_items: ['id', 'productId', 'name', 'quantity'],
      orders: ['id', 'type', 'status', 'productId'],
    });

    expect(migrateLegacyBuyerTables(db as any)).toBe(true);
    expect(db.execSync).toHaveBeenCalledOnce();
    expect(db.execSync).toHaveBeenCalledWith(
      'DROP TABLE IF EXISTS cart_items;\nDROP TABLE IF EXISTS orders;'
    );
  });

  it('ne détruit aucune table déjà isolée par acheteur', () => {
    const db = migrationDb({
      cart_items: ['buyerId', 'productId', 'quantity'],
      orders: ['buyerId', 'id', 'status'],
    });

    expect(migrateLegacyBuyerTables(db as any)).toBe(false);
    expect(db.execSync).not.toHaveBeenCalled();
  });

  it('ne traite pas une table absente comme une ancienne table', () => {
    const db = migrationDb({});

    expect(migrateLegacyBuyerTables(db as any)).toBe(false);
    expect(db.execSync).not.toHaveBeenCalled();
  });

  it('propage une erreur SQLite au lieu de prétendre que la migration a réussi', () => {
    const db = migrationDb({ cart_items: ['id', 'productId'] });
    db.execSync.mockImplementation(() => {
      throw new Error('SQLiteDiskIOWriteError');
    });

    expect(() => migrateLegacyBuyerTables(db as any)).toThrow('SQLiteDiskIOWriteError');
  });
});
