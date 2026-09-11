import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  agronomistCacheKey,
  assertValidSellerContext,
  isValidAgronomistCacheKey,
  isValidParcelCacheKey,
  parcelCacheKey,
} from '../src/utils/cacheKey';
import { persistOrKeepAgronomistAnswer } from '../src/services/agronomistPersistence';

describe('clés privées Bloc 4', () => {
  const invalidIds = [
    '0', '-1', '1.5', 'abc', 'abc-def', '1_2', '1/2', 'anonymous',
    'undefined', 'null', ' 1', '1 ', '1 2', '',
  ];

  it.each(invalidIds)('rejette userId forgé %j', (userId) => {
    expect(() => assertValidSellerContext({ role: 'seller', userId, gicId: '1' })).toThrow();
  });

  it.each(invalidIds)('rejette gicId forgé %j', (gicId) => {
    expect(() => assertValidSellerContext({ role: 'seller', userId: '1', gicId })).toThrow();
  });

  it('n’accepte que les formes complètes exactes des deux familles de clés', () => {
    expect(isValidParcelCacheKey(parcelCacheKey('seller', '301', '1'))).toBe(true);
    expect(isValidAgronomistCacheKey(agronomistCacheKey('seller', '301', '1'))).toBe(true);

    const forged = [
      'sitcha_parcels_',
      'sitcha_parcels_seller_1',
      'sitcha_parcels_evil',
      'sitcha_parcels_seller_a_b',
      'sitcha_parcels_seller_0_1',
      'sitcha_parcels_seller_1_1_extra',
    ];
    forged.forEach((key) => expect(isValidParcelCacheKey(key)).toBe(false));
  });
});

describe('propagation réelle des écritures privées', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.doUnmock('expo-sqlite');
    vi.doUnmock('react-native');
  });

  it.each<[string, string, unknown[]]>([
    ['saveParcels', 'sitcha_parcels_seller_301_1', []],
    ['saveAgronomistHistory', 'sitcha_agro_history_seller_301_1', []],
  ])('propage SQLiteDiskIOWriteError depuis runSync via %s', async (method, key, value) => {
    const diskError = new Error('SQLiteDiskIOWriteError: disk I/O error');
    const runSync = vi.fn(() => { throw diskError; });
    vi.doMock('expo-sqlite', () => ({
      openDatabaseSync: vi.fn(() => ({
        execSync: vi.fn(),
        runSync,
      })),
    }));
    vi.doMock('react-native', () => ({ Platform: { OS: 'android' }, Alert: { alert: vi.fn() } }));
    const { dbService } = await import('../src/services/database');

    if (method === 'saveParcels') {
      await expect(dbService.saveParcels(value as never[], key)).rejects.toBe(diskError);
    } else {
      await expect(dbService.saveAgronomistHistory(key, value)).rejects.toBe(diskError);
    }
    expect(runSync).toHaveBeenCalledWith(
      'INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?);',
      [key, JSON.stringify(value)],
    );
  });

  it('fait remonter SQLiteDiskIOWriteError jusqu’à persistAgronomistConsultation', async () => {
    const diskError = new Error('SQLiteDiskIOWriteError: disk I/O error');
    vi.doMock('expo-sqlite', () => ({
      openDatabaseSync: vi.fn(() => ({
        execSync: vi.fn(),
        getFirstSync: vi.fn(() => null),
        runSync: vi.fn(() => { throw diskError; }),
      })),
    }));
    vi.doMock('react-native', () => ({ Platform: { OS: 'android' }, Alert: { alert: vi.fn() } }));
    const { growthService } = await import('../src/services/growthService');

    await expect(growthService.persistAgronomistConsultation(
      { role: 'seller', userId: '301', gicId: '1' },
      {
        crop: 'Maïs',
        category: 'Maladie',
        question: 'Feuilles jaunes',
        answer: 'Inspecter la parcelle.',
        disclaimer: 'Conseil indicatif.',
        askedAt: '2026-09-11T00:00:00.000Z',
      },
    )).rejects.toBe(diskError);
  });

  it.each<[string, string, unknown[]]>([
    ['saveParcels', 'sitcha_parcels_seller_301_1', []],
    ['saveAgronomistHistory', 'sitcha_agro_history_seller_301_1', []],
  ])('propage l’échec localStorage.setItem via %s', async (method, key, value) => {
    const quotaError = new Error('QuotaExceededError');
    vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => { throw quotaError; });
    const { dbService } = await import('../src/services/database.web');

    if (method === 'saveParcels') {
      await expect(dbService.saveParcels(value as never[], key)).rejects.toBe(quotaError);
    } else {
      await expect(dbService.saveAgronomistHistory(key, value)).rejects.toBe(quotaError);
    }
  });

  it('rejette les clés forgées dans les deux adaptateurs', async () => {
    vi.doMock('expo-sqlite', () => ({
      openDatabaseSync: vi.fn(() => ({ execSync: vi.fn(), runSync: vi.fn() })),
    }));
    vi.doMock('react-native', () => ({ Platform: { OS: 'android' }, Alert: { alert: vi.fn() } }));
    const [{ dbService: nativeDb }, { dbService: webDb }] = await Promise.all([
      import('../src/services/database'),
      import('../src/services/database.web'),
    ]);
    const forged = [
      'sitcha_parcels_', 'sitcha_parcels_seller_1', 'sitcha_parcels_evil',
      'sitcha_parcels_seller_a_b',
    ];

    for (const key of forged) {
      await expect(nativeDb.getParcels(key)).rejects.toThrow(/Clé de cache privée/);
      await expect(webDb.saveParcels([], key)).rejects.toThrow(/Clé de cache privée/);
    }

    const forgedAgronomistKeys = [
      'sitcha_agro_history_',
      'sitcha_agro_history_seller_1',
      'sitcha_agro_history_evil',
      'sitcha_agro_history_seller_a_b',
    ];
    for (const key of forgedAgronomistKeys) {
      await expect(nativeDb.getAgronomistHistory(key)).rejects.toThrow(/Clé de cache agronome/);
      await expect(webDb.saveAgronomistHistory(key, [])).rejects.toThrow(/Clé de cache agronome/);
    }
  });
});

describe('avertissement Agronome après panne de stockage', () => {
  it('classe la réponse reçue comme volatile et jamais comme enregistrée', async () => {
    const outcome = await persistOrKeepAgronomistAnswer({
      crop: 'Maïs',
      category: 'Maladie',
      question: 'Pourquoi les feuilles jaunissent-elles ?',
      answer: 'Inspectez le drainage et la disponibilité en azote.',
      disclaimer: 'Conseil indicatif.',
      askedAt: '2026-09-11T00:00:00.000Z',
    }, async () => {
      throw new Error('SQLiteDiskIOWriteError');
    });

    expect(outcome.status).toBe('volatile');
    expect(outcome.entry.notSavedLocally).toBe(true);
    expect(outcome.entry.answer).toContain('drainage');
  });
});
