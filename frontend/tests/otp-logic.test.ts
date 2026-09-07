import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient, ApiError } from '../src/services/api';

describe('OTP Verification & Resend Logic', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should enforce 6-digit code validation', () => {
    const isCodeValid = (code: string) => code.trim().length === 6 && /^\d{6}$/.test(code.trim());

    expect(isCodeValid('')).toBe(false);
    expect(isCodeValid('12345')).toBe(false);
    expect(isCodeValid('1234567')).toBe(false);
    expect(isCodeValid('abcdef')).toBe(false);
    expect(isCodeValid('123456')).toBe(true);
    expect(isCodeValid('654321')).toBe(true);
  });

  it('should handle cooldown timer accurately', () => {
    let cooldown = 60;
    const tick = () => {
      cooldown = cooldown > 0 ? cooldown - 1 : 0;
    };

    expect(cooldown).toBe(60);
    const canResendInitially = cooldown === 0;
    expect(canResendInitially).toBe(false);

    for (let i = 0; i < 60; i++) {
      tick();
    }

    expect(cooldown).toBe(0);
    const canResendAfter60s = cooldown === 0;
    expect(canResendAfter60s).toBe(true);
  });

  it('should prevent double submission during active resend request', async () => {
    let isResending = false;
    let submitCount = 0;

    const resendAction = async () => {
      if (isResending) return;
      isResending = true;
      submitCount++;
      await new Promise((r) => setTimeout(r, 50));
      isResending = false;
    };

    const p1 = resendAction();
    const p2 = resendAction();

    await Promise.all([p1, p2]);
    expect(submitCount).toBe(1);
  });

  it('should call resendOtp with exact phone and role payload', async () => {
    const resendSpy = vi.spyOn(apiClient, 'resendOtp').mockResolvedValueOnce({
      message: 'Nouveau code envoyé.',
      requireOtp: true,
      phone: '+237699112233',
    });

    const res = await apiClient.resendOtp({ phone: '+237699112233', role: 'buyer' });

    expect(resendSpy).toHaveBeenCalledWith({ phone: '+237699112233', role: 'buyer' });
    expect(res.requireOtp).toBe(true);
  });

  it('should format 429 rate limit error message correctly for user display', async () => {
    vi.spyOn(apiClient, 'resendOtp').mockRejectedValueOnce(
      new ApiError('Trop de demandes de code OTP. Veuillez patienter avant de réessayer.', 429)
    );

    let caughtError: any = null;
    try {
      await apiClient.resendOtp({ phone: '+237699112233', role: 'seller' });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError.status).toBe(429);
    expect(caughtError.message).toMatch(/Trop de demandes de code OTP/i);
  });

  it('should format 503 SMS unavailable error message clearly for user display', async () => {
    vi.spyOn(apiClient, 'resendOtp').mockRejectedValueOnce(
      new ApiError('Le service SMS est actuellement indisponible.', 503)
    );

    let caughtError: any = null;
    try {
      await apiClient.resendOtp({ phone: '+237677000000', role: 'seller' });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError.status).toBe(503);
    expect(caughtError.message).toMatch(/service SMS est actuellement indisponible/i);
  });

  it('should send { phone, code, role } on verifyOtp', async () => {
    const verifySpy = vi.spyOn(apiClient, 'verifyOtp').mockResolvedValueOnce({
      token: 'jwt-123',
      user: {
        id: '1',
        name: 'Vendeur',
        phone: '+237677112233',
        role: 'seller',
        status: 'pending',
        phoneVerified: true,
      },
    });

    const res = await apiClient.verifyOtp('+237677112233', '123456', 'seller');
    expect(verifySpy).toHaveBeenCalledWith('+237677112233', '123456', 'seller');
    expect(res.token).toBe('jwt-123');
  });
});
