/**
 * Utilitaires pour le journal de croissance et l'agronomie
 */

/**
 * Valide si une chaîne est une date calendrier réelle au format ISO 'YYYY-MM-DD'.
 * Rejette les dates inexistantes comme le 2026-02-31.
 */
export function isValidIsoDate(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;

  const [yearStr, monthStr, dayStr] = trimmed.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export interface YieldDropResult {
  dropPercent: number;
  isDropAlert: boolean;
}

/**
 * Calcule la baisse de rendement entre l'estimation initiale et la récolte réelle.
 * L'alerte se déclenche STRICTEMENT lorsque la baisse dépasse 15 % (> 15.0 %).
 * Une baisse exacte de 15 % (ex: 85 kg récoltés pour 100 kg prévus) ne déclenche PAS d'alerte.
 */
export function calculateYieldDrop(
  estimatedVolumeKg: number,
  actualHarvestVolumeKg: number | null | undefined
): YieldDropResult {
  if (
    actualHarvestVolumeKg === null ||
    actualHarvestVolumeKg === undefined ||
    typeof actualHarvestVolumeKg !== 'number' ||
    isNaN(actualHarvestVolumeKg) ||
    typeof estimatedVolumeKg !== 'number' ||
    isNaN(estimatedVolumeKg) ||
    estimatedVolumeKg <= 0
  ) {
    return { dropPercent: 0, isDropAlert: false };
  }

  const difference = estimatedVolumeKg - actualHarvestVolumeKg;
  if (difference <= 0) {
    return { dropPercent: 0, isDropAlert: false };
  }

  // Élimination du bruit de virgule flottante IEEE 754
  const dropRatio = Number((difference / estimatedVolumeKg).toFixed(6));
  const dropPercent = Number((dropRatio * 100).toFixed(4));

  // Seuil strict : strictement supérieur à 15% (0.15)
  const isDropAlert = dropRatio > 0.15;

  return { dropPercent, isDropAlert };
}
