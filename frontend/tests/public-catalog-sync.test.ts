/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../src/services/api';
import { dbService } from '../src/services/database.web';
import { STORAGE_KEYS } from '../src/services/database.shared';

describe('synchronisation du catalogue public', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('évince un ancien catalogue en cache lorsque le serveur répond avec une liste vide', async () => {
    localStorage.setItem(
      STORAGE_KEYS.PRODUCTS,
      JSON.stringify([{ id: 'demo-1', name: 'Produit démo obsolète' }])
    );

    vi.spyOn(apiClient, 'getProducts').mockResolvedValue({
      products: [],
      meta: { page: 1, limit: 50, total: 0, totalPages: 0 },
    } as any);
    vi.spyOn(apiClient, 'getPublicGics').mockRejectedValue(new Error('hors périmètre du test'));
    vi.spyOn(apiClient, 'getTerrain').mockRejectedValue(new Error('hors périmètre du test'));

    await expect(dbService.syncPublicData()).resolves.toBe(true);
    await expect(dbService.getProducts()).resolves.toEqual([]);
  });
});
