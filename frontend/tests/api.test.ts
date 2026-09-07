import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getApiBaseUrl,
  ApiError,
  request,
  saveSession,
  clearSession,
  readToken,
  readRole,
  readStoredUser,
  setUnauthorizedHandler,
  UserProfile,
} from '../src/services/api';

describe('API Service & URL Resolution', () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_URL;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalEnv;
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it('should resolve base URL from EXPO_PUBLIC_API_URL and strip trailing slash', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com/api/';
    expect(getApiBaseUrl()).toBe('https://api.example.com/api');
  });

  it('should fallback to local dev URL when EXPO_PUBLIC_API_URL is missing in dev mode', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    process.env.NODE_ENV = 'development';
    const url = getApiBaseUrl();
    expect(url).toMatch(/http:\/\/(localhost|10\.0\.2\.2):5000\/api/);
  });

  it('should throw explicit error when EXPO_PUBLIC_API_URL is missing in production mode', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    process.env.NODE_ENV = 'production';
    expect(() => getApiBaseUrl()).toThrow(/Configuration manquante: EXPO_PUBLIC_API_URL/i);
  });
});

describe('ApiError class', () => {
  it('should instantiate correctly with status, message, payload and requireOtp', () => {
    const payload = { detail: 'invalid' };
    const err = new ApiError('Validation échouée', 400, payload, true);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiError');
    expect(err.message).toBe('Validation échouée');
    expect(err.status).toBe(400);
    expect(err.payload).toEqual(payload);
    expect(err.requireOtp).toBe(true);
  });
});

describe('request helper and error handling', () => {
  const mockUser: UserProfile = {
    id: 'user-1',
    role: 'buyer',
    name: 'Acheteur Test',
    phone: '+237699112233',
    status: 'active',
    phoneVerified: true,
  };

  beforeEach(async () => {
    await clearSession();
    vi.restoreAllMocks();
    process.env.EXPO_PUBLIC_API_URL = 'http://test-api.local/api';
  });

  it('should parse successful JSON response and include token when available', async () => {
    await saveSession('my-jwt-token', mockUser);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: [1, 2, 3] }),
    });
    globalThis.fetch = mockFetch;

    const res = await request<{ success: boolean; data: number[] }>('/test');
    expect(res.success).toBe(true);
    expect(res.data).toEqual([1, 2, 3]);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://test-api.local/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-jwt-token',
        }),
      })
    );
  });

  it('should handle network failures and throw ApiError with status 0', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    await expect(request('/catalog')).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
      message: expect.stringMatching(/Pas de connexion réseau/i),
    });
  });

  it('should normalize standard API error and extract requireOtp flag', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Code expiré', requireOtp: true }),
    });

    await expect(request('/auth/verify-otp')).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'Code expiré',
      requireOtp: true,
    });
  });

  it('should normalize Zod validation errors into a concatenated string message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        errors: [{ message: 'Le numéro de téléphone est requis' }, { message: 'PIN invalide' }],
      }),
    });

    await expect(request('/auth/login')).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'Le numéro de téléphone est requis, PIN invalide',
    });
  });

  it('should automatically clear session and call unauthorizedHandler on 401 response', async () => {
    await saveSession('old-token', mockUser);
    const unauthorizedSpy = vi.fn();
    setUnauthorizedHandler(unauthorizedSpy);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Session expirée' }),
    });

    await expect(request('/auth/me')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      message: 'Session expirée',
    });

    expect(unauthorizedSpy).toHaveBeenCalledTimes(1);
    expect(await readToken()).toBeNull();
    expect(await readRole()).toBeNull();
    expect(await readStoredUser()).toBeNull();
  });

  it('should NOT clear session or call unauthorizedHandler on 403 response', async () => {
    await saveSession('valid-token', mockUser);
    const unauthorizedSpy = vi.fn();
    setUnauthorizedHandler(unauthorizedSpy);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: 'Accès interdit pour ce rôle' }),
    });

    await expect(request('/gic/profile')).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      message: 'Accès interdit pour ce rôle',
    });

    expect(unauthorizedSpy).not.toHaveBeenCalled();
    expect(await readToken()).toBe('valid-token');
    expect(await readRole()).toBe('buyer');
  });
});

describe('Session Storage Management', () => {
  const mockUser: UserProfile = {
    id: 'user-2',
    role: 'seller',
    name: 'Vendeur Planteur',
    phone: '+237677889900',
    status: 'pending',
    phoneVerified: true,
    gicId: 'gic-42',
    gicRole: 'member',
  };

  it('should atomically save and retrieve session info', async () => {
    await clearSession();
    await saveSession('seller-token-xyz', mockUser);

    expect(await readToken()).toBe('seller-token-xyz');
    expect(await readRole()).toBe('seller');
    const storedUser = await readStoredUser();
    expect(storedUser).toEqual(mockUser);
  });

  it('should atomically clear all session info upon clearSession', async () => {
    await saveSession('seller-token-xyz', mockUser);
    await clearSession();

    expect(await readToken()).toBeNull();
    expect(await readRole()).toBeNull();
    expect(await readStoredUser()).toBeNull();
  });
});
