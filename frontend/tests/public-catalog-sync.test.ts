/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { _resetMemorySessionForTesting, apiClient } from '../src/services/api';
import { dbService } from '../src/services/database.web';
import { STORAGE_KEYS } from '../src/services/database.shared';

describe('synchronisation du catalogue public', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    dbService._resetSyncStateForTesting();
    _resetMemorySessionForTesting();
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

  it('fusionne les synchronisations concurrentes et applique un délai anti-rafale', async () => {
    let releaseProducts!: () => void;
    const pendingProducts = new Promise<void>((resolve) => { releaseProducts = resolve; });
    const getProducts = vi.spyOn(apiClient, 'getProducts').mockImplementation(async () => {
      await pendingProducts;
      return { products: [], meta: { page: 1, limit: 50, total: 0, totalPages: 0 } } as any;
    });
    const getGics = vi.spyOn(apiClient, 'getPublicGics').mockResolvedValue({ gics: [] } as any);
    const getTerrain = vi.spyOn(apiClient, 'getTerrain').mockResolvedValue({} as any);

    const first = dbService.syncPublicData();
    const concurrent = dbService.syncPublicData();
    releaseProducts();

    await Promise.all([first, concurrent]);
    await expect(dbService.syncPublicData()).resolves.toBe(false);

    expect(getProducts).toHaveBeenCalledTimes(1);
    expect(getGics).toHaveBeenCalledTimes(1);
    expect(getTerrain).toHaveBeenCalledTimes(1);
  });

  it('ne lance aucune route privée vendeur native pendant une synchronisation acheteur', async () => {
    const { dbService: nativeDbService } = await import('../src/services/database.ts');
    nativeDbService._resetSyncStateForTesting();
    localStorage.setItem('sitcha_session_v1', JSON.stringify({
      version: 1,
      token: 'buyer-token',
      user: { id: '7', phone: '+237690000000', name: 'Acheteur', role: 'buyer', status: 'active', phoneVerified: true },
    }));
    vi.spyOn(apiClient, 'getProducts').mockResolvedValue({ products: [], meta: { page: 1, limit: 50, total: 0, totalPages: 0 } } as any);
    vi.spyOn(apiClient, 'getPublicGics').mockResolvedValue({ gics: [] } as any);
    vi.spyOn(apiClient, 'getTerrain').mockResolvedValue({} as any);
    const privateCalls = [
      vi.spyOn(apiClient, 'getHarvests'),
      vi.spyOn(apiClient, 'getExpenses'),
      vi.spyOn(apiClient, 'getGicProfile'),
      vi.spyOn(apiClient, 'getB2BOffers'),
      vi.spyOn(apiClient, 'getPrefinancingDeals'),
      vi.spyOn(apiClient, 'getTrustRatings'),
    ];

    await nativeDbService.syncPublicData();

    privateCalls.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });
});
