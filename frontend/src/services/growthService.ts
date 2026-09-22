import { apiClient, isNetworkError } from './api';
import { dbService } from './database';
import { ParcelGrowthRecord, ParcelStage } from './database.shared';
import { calculateYieldDrop, isValidIsoDate } from '../utils/growthUtils';
import {
  parcelCacheKey,
  agronomistCacheKey,
  ValidSellerContext,
  assertValidSellerContext,
} from '../utils/cacheKey';

// --- Types --------------------------------------------------------------

export type UserCacheContext = ValidSellerContext;

export interface CreateParcelInput {
  parcelName: string;
  crop: string;
  sowingDate: string;
  stage?: ParcelStage;
  estimatedHarvestDate: string;
  estimatedVolumeKg: number;
  /** actualHarvestVolumeKg et actualHarvestDate doivent être fournis ensemble ou tous deux null */
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
  /** actualHarvestVolumeKg et actualHarvestDate doivent être fournis ensemble ou tous deux null */
  actualHarvestVolumeKg?: number | null;
  actualHarvestDate?: string | null;
}

export interface FetchParcelsResult {
  parcels: ParcelGrowthRecord[];
  isOffline: boolean;
  error?: string;
}

export interface AgronomistHistoryEntry {
  id: string;
  crop: string;
  category: string;
  question: string;
  answer: string;
  disclaimer: string;
  askedAt: string;
  notSavedLocally?: boolean;
}

// --- Helpers internes ---------------------------------------------------

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

/**
 * Retourne le cache de parcelles pour un contexte utilisateur précis.
 * Clé = sitcha_parcels_{role}_{userId}_{gicId}
 * Les contextes invalides ou incomplets sont rejetés.
 */
async function getCachedParcels(ctx: UserCacheContext): Promise<ParcelGrowthRecord[]> {
  assertValidSellerContext(ctx);
  return dbService.getParcels(parcelCacheKey(ctx.role, ctx.userId, ctx.gicId));
}

async function setCachedParcels(ctx: UserCacheContext, parcels: ParcelGrowthRecord[]): Promise<void> {
  assertValidSellerContext(ctx);
  return dbService.saveParcels(parcels, parcelCacheKey(ctx.role, ctx.userId, ctx.gicId));
}

// --- Service principal --------------------------------------------------

export const growthService = {
  /**
   * Charge les parcelles du GIC authentifié.
   *
   * Stratégie stricte :
   * - Rejette tout contexte non authentifié ou incomplet.
   * - Si le serveur répond → données serveur font foi, cache mis à jour.
   * - Si erreur réseau (status 0) → cache hors-ligne de cet utilisateur retourné.
   * - Si 401 → session invalide, pas de cache, erreur propagée.
   * - Si 403 → accès refusé, pas de cache.
   * - Si 4xx/5xx autre → erreur affichée, pas de bascule silencieuse.
   * - Si réponse malformée → erreur, pas de cache.
   */
  async loadParcels(ctx: UserCacheContext): Promise<FetchParcelsResult> {
    assertValidSellerContext(ctx);
    try {
      await dbService.initDatabase();
      const res = await apiClient.getParcels();

      // Réponse malformée → erreur explicite, pas de bascule silencieuse sur cache
      if (!res || !Array.isArray(res?.parcels)) {
        return {
          parcels: [],
          isOffline: false,
          error: 'Réponse serveur invalide pour les parcelles.',
        };
      }

      const enriched = res.parcels.map(enrichParcel);
      await setCachedParcels(ctx, enriched);
      return { parcels: enriched, isOffline: false };
    } catch (err: any) {
      // Panne réseau (fetch échoue, status 0, TypeError: network)
      if (isNetworkError(err)) {
        const cached = await getCachedParcels(ctx);
        return { parcels: cached.map(enrichParcel), isOffline: true };
      }

      const status = err?.status ?? err?.statusCode;

      // 401 → session invalide : invalider le cache, propager l'erreur sans cache
      if (status === 401) {
        return {
          parcels: [],
          isOffline: false,
          error: 'Session expirée. Veuillez vous reconnecter.',
        };
      }

      // 403 → accès refusé : pas de cache, propager
      if (status === 403) {
        return {
          parcels: [],
          isOffline: false,
          error: 'Accès refusé.',
        };
      }

      // Toute autre erreur serveur (400, 404, 409, 500, 503) → afficher l'erreur, pas de cache
      return {
        parcels: [],
        isOffline: false,
        error: err?.message || 'Erreur lors du chargement des parcelles.',
      };
    }
  },

  /**
   * Crée une parcelle sur le serveur.
   * Exige une confirmation serveur : ne prétend jamais qu'une donnée locale existe côté serveur.
   */
  async createParcel(ctx: UserCacheContext, input: CreateParcelInput): Promise<ParcelGrowthRecord> {
    assertValidSellerContext(ctx);

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

    // actualHarvestVolumeKg et actualHarvestDate : ensemble ou tous deux null
    const hasVol = input.actualHarvestVolumeKg !== null && input.actualHarvestVolumeKg !== undefined;
    const hasDate = !!input.actualHarvestDate;
    if (hasVol !== hasDate) {
      throw new Error('Le volume récolté et la date de récolte réelle doivent être fournis ensemble ou tous deux omis.');
    }

    if (input.actualHarvestDate) {
      if (!isValidIsoDate(input.actualHarvestDate)) {
        throw new Error('Date de récolte réelle invalide (format YYYY-MM-DD attendu).');
      }
      if (input.actualHarvestDate < input.sowingDate) {
        throw new Error('La date de récolte réelle ne peut pas être antérieure à la date de semis.');
      }
    }
    if (typeof input.estimatedVolumeKg !== 'number' || isNaN(input.estimatedVolumeKg) || !isFinite(input.estimatedVolumeKg) || input.estimatedVolumeKg <= 0 || input.estimatedVolumeKg > 1_000_000) {
      throw new Error('Le volume estimé doit être un nombre fini strictement positif (max 1 000 000 kg).');
    }
    if (
      input.actualHarvestVolumeKg !== null &&
      input.actualHarvestVolumeKg !== undefined &&
      (typeof input.actualHarvestVolumeKg !== 'number' || isNaN(input.actualHarvestVolumeKg) || !isFinite(input.actualHarvestVolumeKg) || input.actualHarvestVolumeKg < 0 || input.actualHarvestVolumeKg > 1_000_000)
    ) {
      throw new Error('Le volume réel récolté doit être un nombre fini >= 0 (max 1 000 000 kg).');
    }

    const res = await apiClient.createParcel(input);
    if (!res?.parcel) {
      throw new Error('Réponse serveur invalide lors de la création.');
    }

    const enriched = enrichParcel(res.parcel);
    const current = await getCachedParcels(ctx);
    await setCachedParcels(ctx, [enriched, ...current.filter((p) => p.id !== enriched.id)]);

    return enriched;
  },

  /**
   * Met à jour une parcelle sur le serveur.
   * Exige une confirmation serveur.
   */
  async updateParcel(
    ctx: UserCacheContext,
    id: string,
    input: UpdateParcelInput,
    sowingDate?: string
  ): Promise<ParcelGrowthRecord> {
    assertValidSellerContext(ctx);

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

    // actualHarvestVolumeKg et actualHarvestDate doivent être fournis ensemble si l'un est présent
    const hasVol = input.actualHarvestVolumeKg !== null && input.actualHarvestVolumeKg !== undefined;
    const hasDate = input.actualHarvestDate !== null && input.actualHarvestDate !== undefined;
    if (hasVol !== hasDate) {
      throw new Error('Le volume récolté et la date de récolte réelle doivent être modifiés ensemble.');
    }

    if (
      input.estimatedVolumeKg !== undefined &&
      (typeof input.estimatedVolumeKg !== 'number' || isNaN(input.estimatedVolumeKg) || !isFinite(input.estimatedVolumeKg) || input.estimatedVolumeKg <= 0 || input.estimatedVolumeKg > 1_000_000)
    ) {
      throw new Error('Le volume estimé doit être un nombre fini strictement positif (max 1 000 000 kg).');
    }
    if (
      input.actualHarvestVolumeKg !== null &&
      input.actualHarvestVolumeKg !== undefined &&
      (typeof input.actualHarvestVolumeKg !== 'number' || isNaN(input.actualHarvestVolumeKg) || !isFinite(input.actualHarvestVolumeKg) || input.actualHarvestVolumeKg < 0 || input.actualHarvestVolumeKg > 1_000_000)
    ) {
      throw new Error('Le volume réel récolté doit être un nombre fini >= 0 (max 1 000 000 kg).');
    }

    const res = await apiClient.updateParcel(id, input);
    if (!res?.parcel) {
      throw new Error('Réponse serveur invalide lors de la mise à jour.');
    }

    const enriched = enrichParcel(res.parcel);
    const current = await getCachedParcels(ctx);
    await setCachedParcels(ctx, current.map((p) => (p.id === id ? enriched : p)));

    return enriched;
  },

  /**
   * Persiste une consultation agronomique dans le cache user/GIC après réponse serveur.
   * Lève une exception si l'écriture locale échoue pour permettre à l'appelant de signaler
   * honnêtement l'échec tout en conservant la réponse en mémoire.
   */
  async persistAgronomistConsultation(
    ctx: UserCacheContext,
    entry: Omit<AgronomistHistoryEntry, 'id'>
  ): Promise<AgronomistHistoryEntry> {
    assertValidSellerContext(ctx);
    const key = agronomistCacheKey(ctx.role, ctx.userId, ctx.gicId);
    const existing: AgronomistHistoryEntry[] = await dbService.getAgronomistHistory(key);
    const newEntry: AgronomistHistoryEntry = {
      id: `agro-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...entry,
    };
    const updated = [newEntry, ...existing].slice(0, 50); // max 50 entrées
    await dbService.saveAgronomistHistory(key, updated);
    return newEntry;
  },

  /**
   * Charge l'historique agronome depuis le cache isolé user/GIC.
   */
  async loadAgronomistHistory(ctx: UserCacheContext): Promise<AgronomistHistoryEntry[]> {
    assertValidSellerContext(ctx);
    const key = agronomistCacheKey(ctx.role, ctx.userId, ctx.gicId);
    return await dbService.getAgronomistHistory(key);
  },

  calculateYieldDrop,
  isValidIsoDate,
};
