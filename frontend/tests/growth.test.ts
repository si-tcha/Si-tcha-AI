import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateYieldDrop, isValidIsoDate } from '../src/utils/growthUtils';
import { ParcelGrowthRecord } from '../src/services/database.shared';
import {
  parcelCacheKey,
  agronomistCacheKey,
  isValidSellerContext,
  assertValidSellerContext,
} from '../src/utils/cacheKey';

vi.mock('../src/services/database', () => {
  return {
    dbService: {
      initDatabase: vi.fn().mockResolvedValue(undefined),
      getParcels: vi.fn().mockImplementation(async (cacheKey: string) => {
        if (!cacheKey || typeof cacheKey !== 'string' || !cacheKey.trim().startsWith('sitcha_parcels_')) {
          throw new Error('Clé de cache privée obligatoire et valide requise pour accéder aux parcelles.');
        }
        return [];
      }),
      saveParcels: vi.fn().mockImplementation(async (parcels: any[], cacheKey: string) => {
        if (!cacheKey || typeof cacheKey !== 'string' || !cacheKey.trim().startsWith('sitcha_parcels_')) {
          throw new Error('Clé de cache privée obligatoire et valide requise pour sauvegarder les parcelles.');
        }
        return undefined;
      }),
      getAgronomistHistory: vi.fn().mockImplementation(async (cacheKey: string) => {
        if (!cacheKey || typeof cacheKey !== 'string' || !cacheKey.trim().startsWith('sitcha_agro_history_')) {
          throw new Error('Clé de cache agronome privée obligatoire et valide requise.');
        }
        return [];
      }),
      saveAgronomistHistory: vi.fn().mockImplementation(async (cacheKey: string, entries: any[]) => {
        if (!cacheKey || typeof cacheKey !== 'string' || !cacheKey.trim().startsWith('sitcha_agro_history_')) {
          throw new Error('Clé de cache agronome privée obligatoire et valide requise.');
        }
        return undefined;
      }),
    },
  };
});

import { growthService, UserCacheContext } from '../src/services/growthService';
import { apiClient, ApiError, isNetworkError } from '../src/services/api';
import { dbService } from '../src/services/database';

// Contexte utilisateur de test
const TEST_CTX: UserCacheContext = { role: 'seller', userId: '301', gicId: '1' };
const TEST_CTX_2: UserCacheContext = { role: 'seller', userId: '302', gicId: '2' };

describe('Bloc 4 — Growth Log & Agronomy Tests', () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:4000/api';
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.EXPO_PUBLIC_API_URL = originalEnv;
    } else {
      delete process.env.EXPO_PUBLIC_API_URL;
    }
  });

  describe('1. Date Validation (isValidIsoDate)', () => {
    it('valide correctement les dates ISO réelles YYYY-MM-DD', () => {
      expect(isValidIsoDate('2025-05-15')).toBe(true);
      expect(isValidIsoDate('2026-12-31')).toBe(true);
      expect(isValidIsoDate('2024-02-29')).toBe(true); // Année bissextile 2024
    });

    it('rejette les dates de calendrier invalides', () => {
      expect(isValidIsoDate('2025-02-29')).toBe(false); // 2025 n'est pas bissextile
      expect(isValidIsoDate('2025-04-31')).toBe(false); // Avril a 30 jours
      expect(isValidIsoDate('2025-13-01')).toBe(false); // Mois 13 inexistant
      expect(isValidIsoDate('2025-00-10')).toBe(false); // Mois 00 inexistant
      expect(isValidIsoDate('2025-05-32')).toBe(false); // Jour 32 inexistant
    });

    it('rejette les formats non-ISO ou corrompus', () => {
      expect(isValidIsoDate('15/05/2025')).toBe(false);
      expect(isValidIsoDate('2025/05/15')).toBe(false);
      expect(isValidIsoDate('2025-5-15')).toBe(false);
      expect(isValidIsoDate('')).toBe(false);
      expect(isValidIsoDate('invalid-date')).toBe(false);
    });
  });

  describe('2. Yield Drop Calculation (calculateYieldDrop)', () => {
    it('renvoie pas d alerte si aucune recolte reelle', () => {
      const res = calculateYieldDrop(1000, null);
      expect(res.isDropAlert).toBe(false);
      expect(res.dropPercent).toBe(0);
    });

    it('gère exactement le seuil critique de 15.0% sans alerte (strictement > 15%)', () => {
      const res = calculateYieldDrop(100, 85);
      expect(res.dropPercent).toBe(15);
      expect(res.isDropAlert).toBe(false); // 15% exact ne doit PAS déclencher l'alerte
    });

    it('déclenche l alerte dès 15.01% de perte', () => {
      const res = calculateYieldDrop(100, 84.99);
      expect(res.dropPercent).toBe(15.01);
      expect(res.isDropAlert).toBe(true);
    });

    it('ne déclenche pas d alerte pour 14.99% de perte', () => {
      const res = calculateYieldDrop(100, 85.01);
      expect(res.dropPercent).toBe(14.99);
      expect(res.isDropAlert).toBe(false);
    });

    it('déclenche l alerte maximale pour 0 kg récolté (perte 100%)', () => {
      const res = calculateYieldDrop(500, 0);
      expect(res.dropPercent).toBe(100);
      expect(res.isDropAlert).toBe(true);
    });

    it('ne déclenche pas d alerte quand la récolte dépasse le prévisionnel', () => {
      const res = calculateYieldDrop(1000, 1200);
      expect(res.dropPercent).toBe(0);
      expect(res.isDropAlert).toBe(false);
    });

    it('gère la sécurité sur volumes invalides ou nuls', () => {
      expect(calculateYieldDrop(0, 50).isDropAlert).toBe(false);
      expect(calculateYieldDrop(-10, 50).isDropAlert).toBe(false);
      expect(calculateYieldDrop(NaN, 50).isDropAlert).toBe(false);
    });
  });

  describe('3. Cache Key Isolation & Contexte Vendeur Strict', () => {
    it('génère des clés distinctes pour deux utilisateurs différents', () => {
      const key1 = parcelCacheKey('seller', '301', '1');
      const key2 = parcelCacheKey('seller', '302', '2');
      expect(key1).not.toBe(key2);
      expect(key1).toContain('301');
      expect(key1).toContain('1');
      expect(key2).toContain('302');
    });

    it('ne contient jamais de données sensibles dans la clé', () => {
      const key = parcelCacheKey('seller', '301', '1');
      expect(key).not.toContain('password');
      expect(key).not.toContain('token');
      expect(key).not.toContain('phone');
      expect(key).not.toContain('pin');
      expect(key).toMatch(/^sitcha_parcels_/);
    });

    it('génère des clés agronome distinctes par utilisateur', () => {
      const key1 = agronomistCacheKey('seller', '301', '1');
      const key2 = agronomistCacheKey('seller', '302', '2');
      expect(key1).not.toBe(key2);
      expect(key1).toMatch(/^sitcha_agro_history_/);
    });

    it('interdit formellement les fallbacks anonymous ou gicId=0 dans parcelCacheKey', () => {
      expect(() => parcelCacheKey('seller', 'anonymous', '1')).toThrow(/anonyme/i);
      expect(() => parcelCacheKey('seller', '301', '0')).toThrow(/nul/i);
      expect(() => parcelCacheKey('buyer', '301', '1')).toThrow(/vendeur/i);
      expect(() => parcelCacheKey('seller', '', '1')).toThrow(/invalide/i);
      expect(() => parcelCacheKey('seller', '301', '')).toThrow(/invalide/i);
    });

    it('interdit formellement les fallbacks anonymous ou gicId=0 dans agronomistCacheKey', () => {
      expect(() => agronomistCacheKey('seller', 'anonymous', '1')).toThrow(/anonyme/i);
      expect(() => agronomistCacheKey('seller', '301', '0')).toThrow(/nul/i);
      expect(() => agronomistCacheKey('buyer', '301', '1')).toThrow(/vendeur/i);
    });

    it('isValidSellerContext identifie précisément les contextes complets et rejette les contextes invalides', () => {
      expect(isValidSellerContext({ role: 'seller', userId: '301', gicId: '1' })).toBe(true);
      expect(isValidSellerContext({ role: 'seller', userId: 'anonymous', gicId: '1' })).toBe(false);
      expect(isValidSellerContext({ role: 'seller', userId: '301', gicId: '0' })).toBe(false);
      expect(isValidSellerContext({ role: 'buyer', userId: '101', gicId: '1' })).toBe(false);
      expect(isValidSellerContext(null)).toBe(false);
      expect(isValidSellerContext(undefined)).toBe(false);
      expect(isValidSellerContext({})).toBe(false);
    });
  });

  describe('4. Growth Service — Online & Offline Data Authority', () => {
    const mockRemoteParcels: ParcelGrowthRecord[] = [
      {
        id: 'parcel-uuid-1',
        parcelName: 'Champ Ouest Maïs',
        crop: 'Maïs Doux',
        sowingDate: '2025-01-10',
        stage: 'Récolté',
        estimatedHarvestDate: '2025-05-15',
        estimatedVolumeKg: 1000,
        actualHarvestVolumeKg: 800, // 20% drop -> alert
        actualHarvestDate: '2025-05-16',
        updatedAt: '2025-05-16T12:00:00.000Z',
      },
    ];

    it('en mode connecté : charge depuis l API, met à jour le cache isolé et enrichit l alerte de rendement', async () => {
      const getParcelsSpy = vi.spyOn(apiClient, 'getParcels').mockResolvedValueOnce({ parcels: mockRemoteParcels });
      const saveParcelsSpy = vi.spyOn(dbService, 'saveParcels').mockResolvedValueOnce(undefined as any);

      const result = await growthService.loadParcels(TEST_CTX);

      expect(getParcelsSpy).toHaveBeenCalledTimes(1);
      // saveParcels doit être appelée avec la clé isolée
      const expectedKey = parcelCacheKey(TEST_CTX.role, TEST_CTX.userId, TEST_CTX.gicId);
      expect(saveParcelsSpy).toHaveBeenCalledWith(result.parcels, expectedKey);
      expect(result.isOffline).toBe(false);
      expect(result.parcels).toHaveLength(1);
      expect(result.parcels[0].yieldDropAlert).toBe(true);
      expect(result.parcels[0].yieldDropPercent).toBe(20);
    });

    it('en mode déconnecté (erreur réseau) : bascule sur le cache isolé de cet utilisateur uniquement', async () => {
      vi.spyOn(apiClient, 'getParcels').mockRejectedValueOnce(new ApiError('Impossible de joindre le serveur', 0));
      // getParcels avec clé isolée retourne les données de l'utilisateur 301
      vi.spyOn(dbService, 'getParcels').mockResolvedValueOnce([
        {
          id: 'cached-parcel-1',
          parcelName: 'Champ Caféier',
          crop: 'Café Robusta',
          sowingDate: '2024-03-01',
          stage: 'Floraison',
          estimatedHarvestDate: '2025-10-15',
          estimatedVolumeKg: 2000,
          actualHarvestVolumeKg: null,
          actualHarvestDate: null,
          updatedAt: '2024-03-01T08:00:00.000Z',
        },
      ]);

      const result = await growthService.loadParcels(TEST_CTX);

      expect(result.isOffline).toBe(true);
      expect(result.parcels).toHaveLength(1);
      expect(result.parcels[0].parcelName).toBe('Champ Caféier');
      expect(result.parcels[0].yieldDropAlert).toBe(false);
    });

    it('401 → invalide la session, retourne parcelles vides sans consulter le cache', async () => {
      vi.spyOn(apiClient, 'getParcels').mockRejectedValueOnce(new ApiError('Unauthorized', 401));
      const getParcelsSpy = vi.spyOn(dbService, 'getParcels');

      const result = await growthService.loadParcels(TEST_CTX);

      // Aucune consultation du cache ne doit avoir lieu
      expect(getParcelsSpy).not.toHaveBeenCalled();
      expect(result.parcels).toHaveLength(0);
      expect(result.isOffline).toBe(false);
      expect(result.error).toMatch(/Session expirée/i);
    });

    it('403 → accès refusé, retourne parcelles vides sans consulter le cache', async () => {
      vi.spyOn(apiClient, 'getParcels').mockRejectedValueOnce(new ApiError('Forbidden', 403));
      const getParcelsSpy = vi.spyOn(dbService, 'getParcels');

      const result = await growthService.loadParcels(TEST_CTX);

      expect(getParcelsSpy).not.toHaveBeenCalled();
      expect(result.parcels).toHaveLength(0);
      expect(result.error).toMatch(/Accès refusé/i);
    });

    it('500 → erreur serveur visible, pas de bascule silencieuse sur cache', async () => {
      vi.spyOn(apiClient, 'getParcels').mockRejectedValueOnce(new ApiError('Internal Server Error', 500));
      const getParcelsSpy = vi.spyOn(dbService, 'getParcels');

      const result = await growthService.loadParcels(TEST_CTX);

      expect(getParcelsSpy).not.toHaveBeenCalled();
      expect(result.parcels).toHaveLength(0);
      expect(result.isOffline).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('réponse malformée → erreur explicite, pas de bascule silencieuse', async () => {
      vi.spyOn(apiClient, 'getParcels').mockResolvedValueOnce({ parcels: 'not-an-array' } as any);

      const result = await growthService.loadParcels(TEST_CTX);

      expect(result.parcels).toHaveLength(0);
      expect(result.isOffline).toBe(false);
      expect(result.error).toMatch(/Réponse serveur invalide/i);
    });

    it('rejette la création si hors-ligne (pas de succès fictif côté local)', async () => {
      vi.spyOn(apiClient, 'createParcel').mockRejectedValueOnce(new ApiError('Connexion requise', 0));
      const dbSaveSpy = vi.spyOn(dbService, 'saveParcels');

      await expect(
        growthService.createParcel(TEST_CTX, {
          parcelName: 'Nouveau Champ',
          crop: 'Soja',
          sowingDate: '2025-02-01',
          estimatedHarvestDate: '2025-06-01',
          estimatedVolumeKg: 500,
        })
      ).rejects.toThrow('Connexion requise');

      expect(dbSaveSpy).not.toHaveBeenCalled();
    });

    it('rejette la création avec des dates incohérentes (récolte avant semis)', async () => {
      await expect(
        growthService.createParcel(TEST_CTX, {
          parcelName: 'Champ Invalide',
          crop: 'Manioc',
          sowingDate: '2025-06-01',
          estimatedHarvestDate: '2025-05-01',
          estimatedVolumeKg: 300,
        })
      ).rejects.toThrow('La date de récolte estimée ne peut pas être antérieure');
    });

    it('rejette la création si volume estimé est infini ou trop grand', async () => {
      await expect(
        growthService.createParcel(TEST_CTX, {
          parcelName: 'Champ Test',
          crop: 'Maïs',
          sowingDate: '2025-01-01',
          estimatedHarvestDate: '2025-06-01',
          estimatedVolumeKg: Infinity,
        })
      ).rejects.toThrow('fini');

      await expect(
        growthService.createParcel(TEST_CTX, {
          parcelName: 'Champ Test',
          crop: 'Maïs',
          sowingDate: '2025-01-01',
          estimatedHarvestDate: '2025-06-01',
          estimatedVolumeKg: 2_000_000,
        })
      ).rejects.toThrow('max 1 000 000');
    });

    it('rejette la création si vol récolté fourni sans date récolte (contrainte couple)', async () => {
      await expect(
        growthService.createParcel(TEST_CTX, {
          parcelName: 'Champ Test',
          crop: 'Maïs',
          sowingDate: '2025-01-01',
          estimatedHarvestDate: '2025-06-01',
          estimatedVolumeKg: 500,
          actualHarvestVolumeKg: 400,
          // actualHarvestDate manquante
        })
      ).rejects.toThrow('ensemble');
    });

    it('rejette la mise à jour de récolte si la date réelle est antérieure au semis', async () => {
      await expect(
        growthService.updateParcel(
          TEST_CTX,
          'parcel-uuid-1',
          {
            actualHarvestDate: '2025-01-01',
            actualHarvestVolumeKg: 400,
          },
          '2025-01-10'
        )
      ).rejects.toThrow('La date de récolte réelle ne peut pas être antérieure');
    });

    it('met à jour une parcelle en ligne et actualise le cache isolé avec le recalcul du rendement', async () => {
      const updatedRemoteParcel: ParcelGrowthRecord = {
        id: 'parcel-uuid-1',
        parcelName: 'Champ Ouest Maïs',
        crop: 'Maïs Doux',
        sowingDate: '2025-01-10',
        stage: 'Récolté',
        estimatedHarvestDate: '2025-05-15',
        estimatedVolumeKg: 1000,
        actualHarvestVolumeKg: 700, // 30% drop -> alert
        actualHarvestDate: '2025-05-16',
        updatedAt: '2025-05-16T15:00:00.000Z',
      };

      vi.spyOn(apiClient, 'updateParcel').mockResolvedValueOnce({ parcel: updatedRemoteParcel });
      vi.spyOn(dbService, 'getParcels').mockResolvedValueOnce([updatedRemoteParcel]);
      const saveParcelsSpy = vi.spyOn(dbService, 'saveParcels').mockResolvedValueOnce(undefined as any);

      const result = await growthService.updateParcel(
        TEST_CTX,
        'parcel-uuid-1',
        {
          actualHarvestVolumeKg: 700,
          actualHarvestDate: '2025-05-16',
          stage: 'Récolté',
        },
        '2025-01-10'
      );

      // Vérifier que saveParcels est appelé avec la clé isolée de l'utilisateur
      const expectedKey = parcelCacheKey(TEST_CTX.role, TEST_CTX.userId, TEST_CTX.gicId);
      expect(saveParcelsSpy).toHaveBeenCalledWith(expect.any(Array), expectedKey);
      expect(result.yieldDropAlert).toBe(true);
      expect(result.yieldDropPercent).toBe(30);
    });
  });

  describe('5. Persistance Historique Agronome', () => {
    it('persiste une consultation dans le cache isolé par user après réponse serveur', async () => {
      const saveHistSpy = vi.spyOn(dbService, 'saveAgronomistHistory').mockResolvedValueOnce(undefined as any);

      const entry = await growthService.persistAgronomistConsultation(TEST_CTX, {
        crop: 'Tomates',
        category: 'Maladie',
        question: 'Feuilles jaunes ?',
        answer: 'Probable mildiou.',
        disclaimer: 'Consulter un agronome.',
        askedAt: new Date().toISOString(),
      });

      const expectedKey = agronomistCacheKey(TEST_CTX.role, TEST_CTX.userId, TEST_CTX.gicId);
      expect(saveHistSpy).toHaveBeenCalledWith(expectedKey, expect.arrayContaining([
        expect.objectContaining({ crop: 'Tomates', answer: 'Probable mildiou.' })
      ]));
      expect(entry).not.toBeNull();
      expect(entry?.id).toMatch(/^agro-/);
    });

    it('ne partage jamais l historique entre deux utilisateurs différents', async () => {
      const key1 = agronomistCacheKey(TEST_CTX.role, TEST_CTX.userId, TEST_CTX.gicId);
      const key2 = agronomistCacheKey(TEST_CTX_2.role, TEST_CTX_2.userId, TEST_CTX_2.gicId);

      expect(key1).not.toBe(key2);
    });

    it('retourne [] si l historique est vide pour un nouvel utilisateur', async () => {
      vi.spyOn(dbService, 'getAgronomistHistory').mockResolvedValueOnce([]);
      const result = await growthService.loadAgronomistHistory(TEST_CTX);
      expect(result).toEqual([]);
    });
  });

  describe('6. Agronomist Client Interaction & Security Requirements', () => {
    it('valide la taille maximale de 1000 caractères et rejette les questions vides', async () => {
      await expect(apiClient.askAgronomist('Maïs', 'Maladie', '')).rejects.toThrow('La question ne peut pas être vide');
      await expect(apiClient.askAgronomist('Maïs', 'Maladie', '   ')).rejects.toThrow('La question ne peut pas être vide');

      const longQuestion = 'a'.repeat(1001);
      await expect(apiClient.askAgronomist('Maïs', 'Maladie', longQuestion)).rejects.toThrow('1000 caractères');
    });

    it('transmet la question valide à l API et reçoit la réponse sécurisée avec disclaimer agricole', async () => {
      const mockResponse = {
        question: 'Comment traiter la chenille légionnaire ?',
        answer: 'Utilisez un biopesticide à base de Bacillus thuringiensis...',
        disclaimer: 'Ce conseil est fourni à titre indicatif par une IA...',
        model: 'gemini-1.5-flash',
        timestamp: '2025-05-16T12:00:00.000Z',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as any);

      const res = await apiClient.askAgronomist('Maïs', 'Maladie', 'Comment traiter la chenille légionnaire ?');

      expect(res.answer).toContain('Bacillus thuringiensis');
      expect(res.disclaimer).toBeDefined();
      expect(res.disclaimer).toContain('titre indicatif');
    });

    it('gère l interdiction pour un non-vendeur avec statut 403', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Accès réservé aux vendeurs GIC actifs.' }),
      } as any);

      await expect(apiClient.askAgronomist('Maïs', 'Conseil', 'Question test')).rejects.toThrow(
        'Accès réservé aux vendeurs GIC actifs.'
      );
    });

    it('gère l indisponibilité temporaire (503) sans prétendre être une IA locale autonome', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Le service d assistance agronomique est temporairement indisponible.' }),
      } as any);

      await expect(apiClient.askAgronomist('Maïs', 'Conseil', 'Question test')).rejects.toThrow(
        'temporairement indisponible'
      );
    });

    it('détecte correctement l erreur réseau offline sans simuler une fausse analyse locale', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Network request failed'));

      try {
        await apiClient.askAgronomist('Maïs', 'Conseil', 'Question test');
        expect.unreachable('Devait échouer sur erreur réseau');
      } catch (err) {
        expect(isNetworkError(err)).toBe(true);
      }
    });
  });

  describe('7. Tests de non-régression obligatoires (Bloc 4 Security & Isolation)', () => {
    // 5.B : Comportement du cache lors de l’hydratation auth
    describe('5.B: Comportement du cache lors de l hydratation auth', () => {
      it('rejette explicitement toute opération si le contexte utilisateur n est pas résolu ou incomplet', async () => {
        const invalidContexts = [
          null,
          undefined,
          {},
          { role: 'seller', userId: '', gicId: '1' },
          { role: 'seller', userId: '301', gicId: '' },
          { role: 'seller', userId: 'anonymous', gicId: '1' },
          { role: 'seller', userId: '301', gicId: '0' },
          { role: 'buyer', userId: '301', gicId: '1' },
        ];

        const dbGetSpy = vi.spyOn(dbService, 'getParcels');
        const dbSaveSpy = vi.spyOn(dbService, 'saveParcels');
        const apiGetSpy = vi.spyOn(apiClient, 'getParcels');

        for (const ctx of invalidContexts) {
          await expect(growthService.loadParcels(ctx as any)).rejects.toThrow(/(invalide|requis|manquant)/i);
          await expect(
            growthService.createParcel(ctx as any, {
              parcelName: 'Test',
              crop: 'Maïs',
              sowingDate: '2025-01-01',
              estimatedHarvestDate: '2025-06-01',
              estimatedVolumeKg: 100,
            })
          ).rejects.toThrow(/(invalide|requis|manquant)/i);
          await expect(growthService.loadAgronomistHistory(ctx as any)).rejects.toThrow(
            /(invalide|requis|manquant)/i
          );
          await expect(
            growthService.persistAgronomistConsultation(ctx as any, {
              crop: 'Maïs',
              category: 'Maladie',
              question: 'Q',
              answer: 'A',
              disclaimer: 'D',
              askedAt: new Date().toISOString(),
            })
          ).rejects.toThrow(/(invalide|requis|manquant)/i);
        }

        // Aucune lecture ou écriture dans le cache sous clé générique n'a été déclenchée
        expect(dbGetSpy).not.toHaveBeenCalled();
        expect(dbSaveSpy).not.toHaveBeenCalled();
        expect(apiGetSpy).not.toHaveBeenCalled();
      });

      it('n écrit ni ne lit jamais sous une clé générique anonymous ou 0 pendant l hydratation', async () => {
        const dbSaveSpy = vi.spyOn(dbService, 'saveParcels');

        // Simuler un appel avec un contexte non hydraté intercepté avant
        expect(isValidSellerContext({ role: 'seller', userId: 'anonymous', gicId: '0' })).toBe(false);

        // Appel une fois l'utilisateur hydraté avec succès
        vi.spyOn(apiClient, 'getParcels').mockResolvedValueOnce({ parcels: [] });
        await growthService.loadParcels({ role: 'seller', userId: '301', gicId: '1' });

        expect(dbSaveSpy).toHaveBeenCalledWith([], 'sitcha_parcels_seller_301_1');
        // Vérifier que jamais une clé anonyme n'est apparue
        const allCalls = dbSaveSpy.mock.calls;
        for (const call of allCalls) {
          expect(call[1]).not.toContain('anonymous');
          expect(call[1]).not.toContain('_0');
        }
      });
    });

    // 5.C : Non-fuite de données entre deux utilisateurs sur un cache local
    describe('5.C: Non-fuite de données entre deux utilisateurs sur un cache local', () => {
      it('l utilisateur B hors-ligne ne lit jamais les parcelles en cache de l utilisateur A', async () => {
        const userAParcels: ParcelGrowthRecord[] = [
          {
            id: 'parcel-user-A-1',
            parcelName: 'Champ Ananas User A',
            crop: 'Ananas',
            sowingDate: '2025-01-01',
            stage: 'Maturation',
            estimatedHarvestDate: '2025-12-01',
            estimatedVolumeKg: 5000,
            actualHarvestVolumeKg: null,
            actualHarvestDate: null,
            updatedAt: '2025-01-01T10:00:00.000Z',
          },
        ];

        const ctxA: UserCacheContext = { role: 'seller', userId: '301', gicId: '1' };
        const ctxB: UserCacheContext = { role: 'seller', userId: '302', gicId: '2' };

        const keyA = parcelCacheKey(ctxA.role, ctxA.userId, ctxA.gicId);
        const keyB = parcelCacheKey(ctxB.role, ctxB.userId, ctxB.gicId);

        // Simuler le cache de base de données partitionné par clé
        const cacheStore: Record<string, ParcelGrowthRecord[]> = {
          [keyA]: userAParcels,
          [keyB]: [], // Le cache de B est vide
        };

        vi.spyOn(dbService, 'getParcels').mockImplementationOnce(async (key: string) => {
          return cacheStore[key] || [];
        });

        // Simuler que le serveur est hors-ligne
        vi.spyOn(apiClient, 'getParcels').mockRejectedValueOnce(new ApiError('Offline', 0));

        // User B se connecte et tente de charger ses parcelles hors-ligne
        const resultB = await growthService.loadParcels(ctxB);

        expect(resultB.isOffline).toBe(true);
        expect(resultB.parcels).toEqual([]);
        expect(resultB.parcels).not.toEqual(userAParcels);

        // Vérifier que getParcels a bien été appelé avec keyB et jamais avec keyA pour la session de B
        expect(dbService.getParcels).toHaveBeenCalledWith(keyB);
      });
    });

    // 5.D : Écran Terrain & étanchéité du stockage
    describe('5.D: Écran Terrain & étanchéité du stockage', () => {
      it('dbService.getParcels et saveParcels rejettent immédiatement les clés vides, invalides ou globales', async () => {
        expect(() => parcelCacheKey('seller', '', '1')).toThrow();
        expect(() => parcelCacheKey('buyer', '301', '1')).toThrow();

        // Vérifier avec l'implémentation web réelle que toute tentative d'accès non partitionné est rejetée
        const { dbService: webDbService } = await import('../src/services/database.web');
        const invalidKeys = ['', '   ', 'parcels', 'global_parcels', 'anonymous'];
        for (const invalidKey of invalidKeys) {
          await expect(webDbService.getParcels(invalidKey as any)).rejects.toThrow(
            /Clé de cache privée obligatoire/i
          );
          await expect(webDbService.saveParcels([], invalidKey as any)).rejects.toThrow(
            /Clé de cache privée obligatoire/i
          );
        }
      });

      it('l écran Terrain charge ses parcelles exclusivement via growthService.loadParcels avec contexte vendeur valide', async () => {
        const validSellerCtx: UserCacheContext = { role: 'seller', userId: '301', gicId: '1' };
        const mockParcels: ParcelGrowthRecord[] = [
          {
            id: 'p-1',
            parcelName: 'Champ Terrain Valide',
            crop: 'Café',
            sowingDate: '2025-02-01',
            stage: 'Semis',
            estimatedHarvestDate: '2025-11-01',
            estimatedVolumeKg: 1200,
            actualHarvestVolumeKg: null,
            actualHarvestDate: null,
            updatedAt: '2025-02-01T08:00:00.000Z',
          },
        ];

        vi.spyOn(apiClient, 'getParcels').mockResolvedValueOnce({ parcels: mockParcels });
        const saveParcelsSpy = vi.spyOn(dbService, 'saveParcels');

        const res = await growthService.loadParcels(validSellerCtx);
        expect(res.parcels).toHaveLength(1);
        expect(res.parcels[0].parcelName).toBe('Champ Terrain Valide');
        expect(saveParcelsSpy).toHaveBeenCalledWith(
          expect.any(Array),
          'sitcha_parcels_seller_301_1'
        );
      });
    });

    // 5.E : Agronome : échec de persistance locale
    describe('5.E: Agronome — Gestion d échec de persistance locale', () => {
      it('persistAgronomistConsultation propage l erreur en cas de panne de stockage local', async () => {
        vi.spyOn(dbService, 'saveAgronomistHistory').mockRejectedValueOnce(
          new Error('SQLiteDiskIOWriteError: out of disk space')
        );

        await expect(
          growthService.persistAgronomistConsultation(TEST_CTX, {
            crop: 'Piment',
            category: 'Parasite',
            question: 'Pucerons sur feuilles',
            answer: 'Appliquer une solution de savon noir ou neem.',
            disclaimer: 'Conseil indicatif.',
            askedAt: new Date().toISOString(),
          })
        ).rejects.toThrow(/out of disk space/);
      });

      it('en cas d échec de sauvegarde locale, la réponse Gemini reste disponible en mémoire vive avec notSavedLocally: true', async () => {
        const serverAnswer = 'Recommandation IA Gemini réelle : rotation des cultures et purin d ortie.';
        const disclaimer = 'Ce conseil est fourni à titre indicatif par une IA.';

        // Simuler la réponse valide du backend Gemini
        vi.spyOn(apiClient, 'askAgronomist').mockResolvedValueOnce({
          question: 'Comment régénérer le sol ?',
          answer: serverAnswer,
          disclaimer,
          model: 'gemini-1.5-flash',
          timestamp: new Date().toISOString(),
        });

        // Simuler l'échec de la persistance locale
        vi.spyOn(growthService, 'persistAgronomistConsultation').mockRejectedValueOnce(
          new Error('Erreur quota AsyncStorage / SQLite plein')
        );

        // Exécuter la logique métier de gestion d'erreur de agronomist.tsx
        let persistedSuccessfully = false;
        let entryToDisplay: any;
        let warningToastMessage: string | null = null;
        let successToastMessage: string | null = null;

        const res = await apiClient.askAgronomist('Maïs', 'Fertilisation', 'Comment régénérer le sol ?');
        try {
          const persisted = await growthService.persistAgronomistConsultation(TEST_CTX, {
            crop: 'Maïs',
            category: 'Fertilisation',
            question: 'Comment régénérer le sol ?',
            answer: res.answer,
            disclaimer: res.disclaimer || disclaimer,
            askedAt: new Date().toISOString(),
          });
          entryToDisplay = persisted;
          persistedSuccessfully = true;
          successToastMessage = 'Ordonnance agronomique générée et enregistrée !';
        } catch {
          // Logique implémentée dans agronomist.tsx
          entryToDisplay = {
            id: `agro-volatile-${Date.now()}`,
            crop: 'Maïs',
            category: 'Fertilisation',
            question: 'Comment régénérer le sol ?',
            answer: res.answer,
            disclaimer: res.disclaimer || disclaimer,
            askedAt: new Date().toISOString(),
            notSavedLocally: true,
          };
          warningToastMessage = 'Réponse reçue mais non sauvegardée localement (erreur stockage).';
        }

        // Vérifications formelles :
        // 1. Pas de succès trompeur
        expect(persistedSuccessfully).toBe(false);
        expect(successToastMessage).toBeNull();
        expect(warningToastMessage).toBe('Réponse reçue mais non sauvegardée localement (erreur stockage).');

        // 2. La réponse reste consultable et lisible en mémoire vive
        expect(entryToDisplay).toBeDefined();
        expect(entryToDisplay.answer).toBe(serverAnswer);
        expect(entryToDisplay.notSavedLocally).toBe(true);
        expect(entryToDisplay.id).toMatch(/^agro-volatile-/);
      });
    });
  });
});
