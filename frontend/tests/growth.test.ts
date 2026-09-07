import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateYieldDrop, isValidIsoDate } from '../src/utils/growthUtils';
import { ParcelGrowthRecord } from '../src/services/database.shared';

vi.mock('../src/services/database', () => {
  return {
    dbService: {
      initDatabase: vi.fn().mockResolvedValue(undefined),
      getParcels: vi.fn().mockResolvedValue([]),
      saveParcels: vi.fn().mockResolvedValue(undefined),
      updateParcelHarvest: vi.fn().mockResolvedValue(undefined),
    },
  };
});

import { growthService } from '../src/services/growthService';
import { apiClient, ApiError, isNetworkError } from '../src/services/api';
import { dbService } from '../src/services/database';

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
      // 100 kg prévu, 85 kg récolté = 15.000% de perte
      const res = calculateYieldDrop(100, 85);
      expect(res.dropPercent).toBe(15);
      expect(res.isDropAlert).toBe(false); // 15% exact ne doit PAS déclencher l'alerte
    });

    it('déclenche l alerte dès 15.01% de perte', () => {
      // 100 kg prévu, 84.99 kg récolté = 15.01% de perte
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

  describe('3. Growth Service — Online & Offline Data Authority', () => {
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

    it('en mode connecté : charge depuis l API, met à jour le cache SQLite et enrichit l alerte de rendement', async () => {
      const getParcelsSpy = vi.spyOn(apiClient, 'getParcels').mockResolvedValueOnce({ parcels: mockRemoteParcels });
      const saveParcelsSpy = vi.spyOn(dbService, 'saveParcels').mockResolvedValueOnce();

      const result = await growthService.loadParcels();

      expect(getParcelsSpy).toHaveBeenCalledTimes(1);
      expect(saveParcelsSpy).toHaveBeenCalledWith(result.parcels);
      expect(result.isOffline).toBe(false);
      expect(result.parcels).toHaveLength(1);
      expect(result.parcels[0].yieldDropAlert).toBe(true);
      expect(result.parcels[0].yieldDropPercent).toBe(20);
    });

    it('en mode déconnecté (erreur réseau 0) : bascule en consultation transparente du cache local', async () => {
      vi.spyOn(apiClient, 'getParcels').mockRejectedValueOnce(new ApiError('Impossible de joindre le serveur', 0));
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

      const result = await growthService.loadParcels();

      expect(result.isOffline).toBe(true);
      expect(result.parcels).toHaveLength(1);
      expect(result.parcels[0].parcelName).toBe('Champ Caféier');
      expect(result.parcels[0].yieldDropAlert).toBe(false);
    });

    it('rejette l écriture si hors-ligne : la création nécessite une connexion et ne simule pas de succès fictif', async () => {
      vi.spyOn(apiClient, 'createParcel').mockRejectedValueOnce(new ApiError('Connexion requise', 0));
      const dbSaveSpy = vi.spyOn(dbService, 'saveParcels');

      await expect(
        growthService.createParcel({
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
        growthService.createParcel({
          parcelName: 'Champ Invalide',
          crop: 'Manioc',
          sowingDate: '2025-06-01',
          estimatedHarvestDate: '2025-05-01', // Antérieur au semis
          estimatedVolumeKg: 300,
        })
      ).rejects.toThrow('La date de récolte estimée ne peut pas être antérieure');
    });

    it('rejette la mise à jour de récolte si la date réelle est antérieure au semis', async () => {
      await expect(
        growthService.updateParcel(
          'parcel-uuid-1',
          {
            actualHarvestDate: '2025-01-01', // Semis est le 2025-01-10
            actualHarvestVolumeKg: 400,
          },
          '2025-01-10'
        )
      ).rejects.toThrow('La date de récolte réelle ne peut pas être antérieure');
    });

    it('met à jour une parcelle en ligne et actualise le cache local avec le recalcul du rendement', async () => {
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
      const saveParcelsSpy = vi.spyOn(dbService, 'saveParcels').mockResolvedValueOnce();

      const result = await growthService.updateParcel(
        'parcel-uuid-1',
        {
          actualHarvestVolumeKg: 700,
          actualHarvestDate: '2025-05-16',
          stage: 'Récolté',
        },
        '2025-01-10'
      );

      expect(saveParcelsSpy).toHaveBeenCalledTimes(1);
      expect(result.yieldDropAlert).toBe(true);
      expect(result.yieldDropPercent).toBe(30);
    });
  });

  describe('4. Agronomist Client Interaction & Security Requirements', () => {
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

    it('gère l indisponibilité temporaire (timeout ou quota 503/504) sans prétendre être une IA locale autonome', async () => {
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
});
