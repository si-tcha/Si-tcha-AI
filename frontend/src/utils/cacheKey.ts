/**
 * Gestion et validation stricte des clés de cache privé isolées par (role, userId, gicId).
 *
 * Invariants de sécurité :
 * - Interdiction stricte de userId = "anonymous" ou gicId = "0"
 * - Aucune donnée privée n'est lue ou écrite sans contexte authentifié complet et valide.
 * - Aucune donnée sensible (téléphone, PIN, token JWT, secret) n'apparaît dans la clé.
 * - Tout contexte incomplet est explicitement rejeté par une exception pour empêcher la production
 *   ou le partage accidentel d'une clé globale/générique.
 */

export interface ValidSellerContext {
  role: 'seller';
  userId: string;
  gicId: string;
}

const POSITIVE_DECIMAL_ID = /^[1-9]\d*$/;
const PARCEL_CACHE_KEY = /^sitcha_parcels_seller_[1-9]\d*_[1-9]\d*$/;
const AGRONOMIST_CACHE_KEY = /^sitcha_agro_history_seller_[1-9]\d*_[1-9]\d*$/;

function normalizePositiveDecimalId(value: unknown): string | null {
  if (typeof value === 'string') {
    return POSITIVE_DECIMAL_ID.test(value) ? value : null;
  }
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }
  return null;
}

export function isValidParcelCacheKey(key: unknown): key is string {
  return typeof key === 'string' && PARCEL_CACHE_KEY.test(key);
}

export function isValidAgronomistCacheKey(key: unknown): key is string {
  return typeof key === 'string' && AGRONOMIST_CACHE_KEY.test(key);
}

/**
 * Vérifie si un contexte est un contexte vendeur valide et complet.
 */
export function isValidSellerContext(ctx: unknown): ctx is ValidSellerContext {
  if (!ctx || typeof ctx !== 'object') return false;
  const c = ctx as Record<string, unknown>;
  if (c.role !== 'seller') return false;

  return normalizePositiveDecimalId(c.userId) !== null
    && normalizePositiveDecimalId(c.gicId) !== null;
}

/**
 * Valide strictement un contexte vendeur et lève une exception descriptive s'il est incomplet.
 */
export function assertValidSellerContext(ctx: unknown): asserts ctx is ValidSellerContext {
  if (!ctx || typeof ctx !== 'object') {
    throw new Error('Contexte utilisateur manquant ou invalide.');
  }
  const c = ctx as Record<string, unknown>;
  if (c.role !== 'seller') {
    throw new Error(`Rôle vendeur requis (reçu: '${String(c.role)}').`);
  }
  if (normalizePositiveDecimalId(c.userId) === null) {
    throw new Error(`Identifiant utilisateur (userId) invalide ou anonyme : '${String(c.userId)}'.`);
  }
  if (normalizePositiveDecimalId(c.gicId) === null) {
    throw new Error(`Identifiant GIC (gicId) invalide ou nul : '${String(c.gicId)}'.`);
  }
}

/**
 * Génère une clé de cache de parcelles isolée par (role, userId, gicId).
 * Rejette explicitement tout contexte invalide ou incomplet.
 */
export function parcelCacheKey(role: string, userId: string | number, gicId: string | number): string {
  assertValidSellerContext({ role, userId, gicId });
  const cleanUserId = String(userId);
  const cleanGicId = String(gicId);
  return `sitcha_parcels_${role}_${cleanUserId}_${cleanGicId}`;
}

/**
 * Génère la clé du cache d'historique agronome isolé par (role, userId, gicId).
 * Rejette explicitement tout contexte invalide ou incomplet.
 */
export function agronomistCacheKey(role: string, userId: string | number, gicId: string | number): string {
  assertValidSellerContext({ role, userId, gicId });
  const cleanUserId = String(userId);
  const cleanGicId = String(gicId);
  return `sitcha_agro_history_${role}_${cleanUserId}_${cleanGicId}`;
}
