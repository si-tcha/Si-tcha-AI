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

/**
 * Vérifie si un contexte est un contexte vendeur valide et complet.
 */
export function isValidSellerContext(ctx: unknown): ctx is ValidSellerContext {
  if (!ctx || typeof ctx !== 'object') return false;
  const c = ctx as Record<string, unknown>;
  if (c.role !== 'seller') return false;

  const uid = typeof c.userId === 'string'
    ? c.userId.trim()
    : (typeof c.userId === 'number' && Number.isFinite(c.userId) ? String(c.userId) : '');
  if (!uid || uid === 'anonymous' || uid === 'undefined' || uid === 'null' || uid === '0') {
    return false;
  }

  const gid = typeof c.gicId === 'string'
    ? c.gicId.trim()
    : (typeof c.gicId === 'number' && Number.isFinite(c.gicId) ? String(c.gicId) : '');
  if (!gid || gid === '0' || gid === 'undefined' || gid === 'null') {
    return false;
  }

  return true;
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
  const uid = typeof c.userId === 'string'
    ? c.userId.trim()
    : (typeof c.userId === 'number' && Number.isFinite(c.userId) ? String(c.userId) : '');
  if (!uid || uid === 'anonymous' || uid === 'undefined' || uid === 'null' || uid === '0') {
    throw new Error(`Identifiant utilisateur (userId) invalide ou anonyme : '${String(c.userId)}'.`);
  }
  const gid = typeof c.gicId === 'string'
    ? c.gicId.trim()
    : (typeof c.gicId === 'number' && Number.isFinite(c.gicId) ? String(c.gicId) : '');
  if (!gid || gid === '0' || gid === 'undefined' || gid === 'null') {
    throw new Error(`Identifiant GIC (gicId) invalide ou nul : '${String(c.gicId)}'.`);
  }
}

/**
 * Génère une clé de cache de parcelles isolée par (role, userId, gicId).
 * Rejette explicitement tout contexte invalide ou incomplet.
 */
export function parcelCacheKey(role: string, userId: string | number, gicId: string | number): string {
  assertValidSellerContext({ role, userId, gicId });
  const cleanUserId = String(userId).trim();
  const cleanGicId = String(gicId).trim();
  return `sitcha_parcels_${role}_${cleanUserId}_${cleanGicId}`;
}

/**
 * Génère la clé du cache d'historique agronome isolé par (role, userId, gicId).
 * Rejette explicitement tout contexte invalide ou incomplet.
 */
export function agronomistCacheKey(role: string, userId: string | number, gicId: string | number): string {
  assertValidSellerContext({ role, userId, gicId });
  const cleanUserId = String(userId).trim();
  const cleanGicId = String(gicId).trim();
  return `sitcha_agro_history_${role}_${cleanUserId}_${cleanGicId}`;
}
