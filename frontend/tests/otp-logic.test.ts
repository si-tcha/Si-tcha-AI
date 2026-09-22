import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient, ApiError } from '../src/services/api';
import {
  calculateRemainingCooldown,
  formatCooldownDisplay,
  OTP_DEFAULT_COOLDOWN_SECONDS,
} from '../src/auth/otpCooldown';
import { validateOtpParams, normalizeRouteParam } from '../src/auth/otpValidation';

describe('Production OTP Logic, Boundary Network & Validation Tests', () => {
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
      const remaining = calculateRemainingCooldown(now - 20000, 60);
      expect(remaining).toBe(40);
    });

    it('should return 0 when cooldown duration has fully elapsed', () => {
      const now = Date.now();
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

  describe('Route Parameters Validation & Normalization', () => {
    it('should normalize single string and array parameters correctly', () => {
      expect(normalizeRouteParam('+237699112233')).toBe('+237699112233');
      expect(normalizeRouteParam(['+237699112233'])).toBe('+237699112233');
      expect(normalizeRouteParam(['   +237699112233  '])).toBe('+237699112233');
      expect(normalizeRouteParam(undefined)).toBeUndefined();
      expect(normalizeRouteParam('')).toBeUndefined();
      expect(normalizeRouteParam([])).toBeUndefined();
    });

    it('should validate valid buyer and seller parameters', () => {
      const buyerResult = validateOtpParams('+237699112233', 'buyer');
      expect(buyerResult.isValid).toBe(true);
      if (buyerResult.isValid) {
        expect(buyerResult.params.phone).toBe('+237699112233');
        expect(buyerResult.params.role).toBe('buyer');
      }

      const sellerResult = validateOtpParams('+237677889900', 'seller');
      expect(sellerResult.isValid).toBe(true);
      if (sellerResult.isValid) {
        expect(sellerResult.params.phone).toBe('+237677889900');
        expect(sellerResult.params.role).toBe('seller');
      }
    });

    it('should reject missing or empty phone number', () => {
      const res1 = validateOtpParams('', 'seller');
      expect(res1.isValid).toBe(false);

      const res2 = validateOtpParams(undefined, 'seller');
      expect(res2.isValid).toBe(false);
    });

    it('should reject missing, malformed, or unauthorized role without defaulting to buyer', () => {
      const res1 = validateOtpParams('+237699112233', undefined);
      expect(res1.isValid).toBe(false);

      const res2 = validateOtpParams('+237699112233', 'admin');
      expect(res2.isValid).toBe(false);

      const res3 = validateOtpParams('+237699112233', 'guest');
      expect(res3.isValid).toBe(false);

      const res4 = validateOtpParams('+237699112233', '');
      expect(res4.isValid).toBe(false);
    });

    it('should guarantee that invalid params prevent network execution', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const validation = validateOtpParams(undefined, 'invalid_role');

      expect(validation.isValid).toBe(false);

      if (validation.isValid) {
        await apiClient.resendOtp(validation.params);
      }

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('Real API Client OTP Network Boundary Tests', () => {
    it('should send POST to exact /api/auth/resend-otp with exact JSON payload', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message: 'Code OTP envoyé par SMS.',
          requireOtp: true,
        }),
      } as any);

      const res = await apiClient.resendOtp({ phone: '+237699112233', role: 'seller' });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, requestInit] = fetchSpy.mock.calls[0] as [string, RequestInit];

      expect(url).toMatch(/\/api\/auth\/resend-otp$/);
      expect(requestInit.method).toBe('POST');
      expect((requestInit.headers as Record<string, string>)['Content-Type']).toBe('application/json');
      expect(JSON.parse(requestInit.body as string)).toEqual({
        phone: '+237699112233',
        role: 'seller',
      });
      expect(res.requireOtp).toBe(true);
    });

    it('should send POST to exact /api/auth/verify-otp with phone, code, and mandatory role', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          token: 'jwt-otp-token-xyz',
          user: {
            id: 'buyer-42',
            role: 'buyer',
            name: 'Coopérative Test',
            phone: '+237699112233',
            status: 'active',
            phoneVerified: true,
          },
        }),
      } as any);

      const res = await apiClient.verifyOtp('+237699112233', '654321', 'buyer');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, requestInit] = fetchSpy.mock.calls[0] as [string, RequestInit];

      expect(url).toMatch(/\/api\/auth\/verify-otp$/);
      expect(requestInit.method).toBe('POST');
      expect((requestInit.headers as Record<string, string>)['Content-Type']).toBe('application/json');
      expect(JSON.parse(requestInit.body as string)).toEqual({
        phone: '+237699112233',
        code: '654321',
        role: 'buyer',
      });
      expect(res.token).toBe('jwt-otp-token-xyz');
      expect(res.user?.role).toBe('buyer');
    });

    it('should transform HTTP 429 response into ApiError with status 429', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          message: 'Trop de requêtes. Veuillez patienter 15 minutes.',
        }),
      } as any);

      let caughtError: any;
      try {
        await apiClient.resendOtp({ phone: '+237699112233', role: 'seller' });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ApiError);
      expect(caughtError.status).toBe(429);
      expect(caughtError.message).toContain('Trop de requêtes');
    });

    it('should transform HTTP 503 response into ApiError with status 503', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          message: "Service d'envoi SMS temporairement indisponible.",
        }),
      } as any);

      let caughtError: any;
      try {
        await apiClient.resendOtp({ phone: '+237699112233', role: 'buyer' });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ApiError);
      expect(caughtError.status).toBe(503);
      expect(caughtError.message).toContain('SMS temporairement indisponible');
    });
  });
});
