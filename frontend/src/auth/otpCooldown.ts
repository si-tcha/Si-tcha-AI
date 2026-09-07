/**
 * Module de calcul et gestion du cooldown OTP (production).
 */

export const OTP_DEFAULT_COOLDOWN_SECONDS = 60;

export function calculateRemainingCooldown(
  lastSentTimestampMs: number,
  cooldownSeconds = OTP_DEFAULT_COOLDOWN_SECONDS
): number {
  if (!lastSentTimestampMs || lastSentTimestampMs <= 0) return 0;
  const elapsedSeconds = Math.floor((Date.now() - lastSentTimestampMs) / 1000);
  const remaining = cooldownSeconds - elapsedSeconds;
  return remaining > 0 ? remaining : 0;
}

export function formatCooldownDisplay(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  if (mins > 0) {
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  }
  return `${secs}s`;
}
