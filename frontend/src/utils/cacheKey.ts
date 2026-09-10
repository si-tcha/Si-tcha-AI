/**
 * Génère une clé de cache de parcelles isolée par (role, userId, gicId).
 *
 * Invariants de sécurité :
 * - La clé ne contient jamais de téléphone, PIN, token ou secret.
 * - Un vendeur ne peut jamais lire le cache d'un autre (userId et gicId sont inclus).
 * - Les données non rattachées (clé legacy sans contexte user) ne sont jamais affichées.
 */
export function parcelCacheKey(role: string, userId: string | number, gicId: string | number): string {
  return `sitcha_parcels_${role}_${userId}_${gicId}`;
}

/**
 * Génère la clé du cache d'historique agronome isolé par (role, userId, gicId).
 * Jamais de clé partagée entre deux utilisateurs différents.
 */
export function agronomistCacheKey(role: string, userId: string | number, gicId: string | number): string {
  return `sitcha_agro_history_${role}_${userId}_${gicId}`;
}
