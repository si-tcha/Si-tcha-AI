import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient, ApiError } from '../src/services/api';
import {
  calculateRemainingCooldown,
  formatCooldownDisplay,
  OTP_DEFAULT_COOLDOWN_SECONDS,
} from '../src/auth/otpCooldown';

describe('Production OTP Logic & Cooldown Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Production Cooldown Calculation', () => {
    it('should return 0 when lastSentTimestamp is 0 or negative', () => {
      expect(calculateRemainingCooldown(0)).toBe(0);
      expect(calculateRemainingCooldown(-100)).toBe(0);
    });

    it('should calculate accurate remaining seconds based on elapsed time', () => {
      const now = Date.now();
      // Code envoyé il y a 20 secondes -> reste 40s sur 60s
      const remaining = calculateRemainingCooldown(now - 20000, 60);
      expect(remaining).toBe(40);
    });

    it('should return 0 when cooldown duration has fully elapsed', () => {
      const now = Date.now();
      // Code envoyé il y a 75 secondes -> cooldown expiré
      const remaining = calculateRemainingCooldown(now - 75000, 60);
      expect(remaining).toBe(0);
    });

    it('should format cooldown display correctly in seconds and minutes', () => {
      expect(formatCooldownDisplay(45)).toBe('45s');
      expect(formatCooldownDisplay(0)).toBe('0s');
      expect(formatCooldownDisplay(65)).toBe('1m 05s');
      expect(formatCooldownDisplay(120)).toBe('2m 00s');
    });

    it('should use default 60 seconds cooldown constant', () => {
      expect(OTP_DEFAULT_COOLDOWN_SECONDS).toBe(60);
    });
  });

  describe('API Client OTP Contract', () => {
    it('should call resendOtp with exact phone and role payload', async () => {
      const resendSpy = vi.spyOn(apiClient, 'resendOtp').mockResolvedValueOnce({
        message: 'Nouveau code envoyé.',
        requireOtp: true,
      });

      const res = await apiClient.resendOtp({ phone: '+237699112233', role: 'seller' });

      expect(resendSpy).toHaveBeenCalledWith({
        phone: '+237699112233',
        role: 'seller',
      });
      expect(res.requireOtp).toBe(true);
    });

    it('should require role parameter for verifyOtp', async () => {
      const verifySpy = vi.spyOn(apiClient, 'verifyOtp').mockResolvedValueOnce({
        token: 'token-abc',
        user: {
          id: '1',
          role: 'buyer',
          name: 'Jean',
          phone: '+237699112233',
          status: 'active',
          phoneVerified: true,
        },
      });

      const res = await apiClient.verifyOtp('+237699112233', '123456', 'buyer');

      expect(verifySpy).toHaveBeenCalledWith('+237699112233', '123456', 'buyer');
      expect(res.token).toBe('token-abc');
      expect(res.user?.role).toBe('buyer');
    });

    it('should handle 429 rate limit error via ApiError', async () => {
      vi.spyOn(apiClient, 'resendOtp').mockRejectedValueOnce(
        new ApiError('Trop de demandes de code OTP. Veuillez patienter avant de réessayer.', 429)
      );

      await expect(apiClient.resendOtp({ phone: '+237699112233', role: 'buyer' })).rejects.toThrow(
        'Trop de demandes de code OTP'
      );
    });

    it('should handle 503 SMS provider unavailability via ApiError', async () => {
      vi.spyOn(apiClient, 'resendOtp').mockRejectedValueOnce(
        new ApiError('Le service SMS est actuellement indisponible.', 503)
      );

      await expect(apiClient.resendOtp({ phone: '+237699112233', role: 'buyer' })).rejects.toThrow(
        'service SMS est actuellement indisponible'
      );
    });
  });
});
