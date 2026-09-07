import { apiClient, isNetworkError } from './api';
import { dbService } from './database';
import { ParcelGrowthRecord, ParcelStage } from './database.shared';
import { calculateYieldDrop, isValidIsoDate } from '../utils/growthUtils';

export interface CreateParcelInput {
  parcelName: string;
  crop: string;
  sowingDate: string;
  stage?: ParcelStage;
  estimatedHarvestDate: string;
  estimatedVolumeKg: number;
  actualHarvestVolumeKg?: number | null;
  actualHarvestDate?: string | null;
}

export interface UpdateParcelInput {
  parcelName?: string;
  crop?: string;
  sowingDate?: string;
  stage?: ParcelStage;
  estimatedHarvestDate?: string;
  estimatedVolumeKg?: number;
  actualHarvestVolumeKg?: number | null;
  actualHarvestDate?: string | null;
}

export interface FetchParcelsResult {
  parcels: ParcelGrowthRecord[];
  isOffline: boolean;
  error?: string;
}

function enrichParcel(p: ParcelGrowthRecord): ParcelGrowthRecord {
  const { dropPercent, isDropAlert } = calculateYieldDrop(
    p.estimatedVolumeKg,
    p.actualHarvestVolumeKg
  );
  return {
    ...p,
    yieldDropPercent: dropPercent,
    yieldDropAlert: isDropAlert,
  };
}

export const growthService = {
  /**
   * Charge les parcelles du GIC authentifié.
   * Le backend est l'autorité : s'il est joignable, les données serveur font foi et le cache est mis à jour.
   * En cas de panne de réseau, les parcelles sont lues depuis le cache hors-ligne local.
   */
  async loadParcels(): Promise<FetchParcelsResult> {
    try {
      await dbService.initDatabase();
      const res = await apiClient.getParcels();
      if (Array.isArray(res?.parcels)) {
        const enriched = res.parcels.map(enrichParcel);
        await dbService.saveParcels(enriched);
        return { parcels: enriched, isOffline: false };
      }
    } catch (err: any) {
      if (isNetworkError(err)) {
        // Mode hors ligne : lecture depuis le cache
        const cached = (await dbService.getParcels()) || [];
        return { parcels: cached.map(enrichParcel), isOffline: true };
      }
      // Autre erreur (ex: 401, 403, 500)
      const cached = (await dbService.getParcels()) || [];
      return {
        parcels: cached.map(enrichParcel),
        isOffline: true,
        error: err?.message || 'Erreur lors du chargement des parcelles.',
      };
    }

    const cached = (await dbService.getParcels()) || [];
    return { parcels: cached.map(enrichParcel), isOffline: true };
  },

  /**
   * Crée une parcelle sur le serveur.
   * Exige une confirmation serveur : ne prétend jamais qu'une donnée locale existe sur le serveur.
   */
  async createParcel(input: CreateParcelInput): Promise<ParcelGrowthRecord> {
    if (!input.parcelName?.trim()) {
      throw new Error('Le nom de la parcelle est requis.');
    }
    if (!input.crop?.trim()) {
      throw new Error('La culture est requise.');
    }
    if (!isValidIsoDate(input.sowingDate)) {
      throw new Error('Date de semis invalide (format YYYY-MM-DD attendu).');
    }
    if (!isValidIsoDate(input.estimatedHarvestDate)) {
      throw new Error('Date de récolte estimée invalide (format YYYY-MM-DD attendu).');
    }
    if (input.estimatedHarvestDate < input.sowingDate) {
      throw new Error('La date de récolte estimée ne peut pas être antérieure à la date de semis.');
    }
    if (input.actualHarvestDate) {
      if (!isValidIsoDate(input.actualHarvestDate)) {
        throw new Error('Date de récolte réelle invalide (format YYYY-MM-DD attendu).');
      }
      if (input.actualHarvestDate < input.sowingDate) {
        throw new Error('La date de récolte réelle ne peut pas être antérieure à la date de semis.');
      }
    }
    if (typeof input.estimatedVolumeKg !== 'number' || isNaN(input.estimatedVolumeKg) || input.estimatedVolumeKg <= 0) {
      throw new Error('Le volume estimé doit être strictement supérieur à 0 kg.');
    }
    if (
      input.actualHarvestVolumeKg !== null &&
      input.actualHarvestVolumeKg !== undefined &&
      (typeof input.actualHarvestVolumeKg !== 'number' || isNaN(input.actualHarvestVolumeKg) || input.actualHarvestVolumeKg < 0)
    ) {
      throw new Error('Le volume réel récolté doit être supérieur ou égal à 0 kg.');
    }

    const res = await apiClient.createParcel(input);
    if (!res?.parcel) {
      throw new Error('Réponse serveur invalide lors de la création.');
    }

    const enriched = enrichParcel(res.parcel);
    // Mise à jour du cache local
    const current = await dbService.getParcels();
    await dbService.saveParcels([enriched, ...current.filter((p) => p.id !== enriched.id)]);

    return enriched;
  },

  /**
   * Met à jour une parcelle sur le serveur (étape de croissance, récolte réelle, etc.).
   * Exige une confirmation serveur.
   */
  async updateParcel(
    id: string,
    input: UpdateParcelInput,
    sowingDate?: string
  ): Promise<ParcelGrowthRecord> {
    if (!id) {
      throw new Error('Identifiant de parcelle manquant.');
    }

    if (input.sowingDate && !isValidIsoDate(input.sowingDate)) {
      throw new Error('Date de semis invalide (format YYYY-MM-DD attendu).');
    }
    if (input.estimatedHarvestDate && !isValidIsoDate(input.estimatedHarvestDate)) {
      throw new Error('Date de récolte estimée invalide (format YYYY-MM-DD attendu).');
    }
    if (input.actualHarvestDate && !isValidIsoDate(input.actualHarvestDate)) {
      throw new Error('Date de récolte réelle invalide (format YYYY-MM-DD attendu).');
    }
    const effectiveSowing = input.sowingDate || sowingDate;
    if (effectiveSowing && input.estimatedHarvestDate && input.estimatedHarvestDate < effectiveSowing) {
      throw new Error('La date de récolte estimée ne peut pas être antérieure à la date de semis.');
    }
    if (effectiveSowing && input.actualHarvestDate && input.actualHarvestDate < effectiveSowing) {
      throw new Error('La date de récolte réelle ne peut pas être antérieure à la date de semis.');
    }
    if (
      input.estimatedVolumeKg !== undefined &&
      (typeof input.estimatedVolumeKg !== 'number' || isNaN(input.estimatedVolumeKg) || input.estimatedVolumeKg <= 0)
    ) {
      throw new Error('Le volume estimé doit être strictement supérieur à 0 kg.');
    }
    if (
      input.actualHarvestVolumeKg !== null &&
      input.actualHarvestVolumeKg !== undefined &&
      (typeof input.actualHarvestVolumeKg !== 'number' || isNaN(input.actualHarvestVolumeKg) || input.actualHarvestVolumeKg < 0)
    ) {
      throw new Error('Le volume réel récolté doit être supérieur ou égal à 0 kg.');
    }

    const res = await apiClient.updateParcel(id, input);
    if (!res?.parcel) {
      throw new Error('Réponse serveur invalide lors de la mise à jour.');
    }

    const enriched = enrichParcel(res.parcel);
    // Mise à jour du cache local
    const current = await dbService.getParcels();
    await dbService.saveParcels(current.map((p) => (p.id === id ? enriched : p)));

    return enriched;
  },

  calculateYieldDrop,
  isValidIsoDate,
};
