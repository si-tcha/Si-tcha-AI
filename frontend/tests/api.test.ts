import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  apiClient,
  ApiError,
  getApiBaseUrl,
  isNetworkError,
  saveSession,
  readStoredSession,
  clearSession,
  setUnauthorizedHandler,
  UserProfile,
} from '../src/services/api';

describe('Production API Client, Networking & Configuration Tests', () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_URL;

  const mockUser: UserProfile = {
    id: 'user-1',
    role: 'buyer',
    name: 'Entreprise Test',
    phone: '+237699112233',
    status: 'active',
    phoneVerified: true,
  };

  beforeEach(async () => {
    await clearSession();
    localStorage.clear();
    vi.restoreAllMocks();
    delete process.env.EXPO_PUBLIC_API_URL;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.EXPO_PUBLIC_API_URL = originalEnv;
    } else {
      delete process.env.EXPO_PUBLIC_API_URL;
    }
  });

  describe('Centralized Base URL Resolution (Port 4000)', () => {
    it('should use EXPO_PUBLIC_API_URL if defined in environment', () => {
      process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.50:4000/api/';
      expect(getApiBaseUrl()).toBe('http://192.168.1.50:4000/api');
    });

    it('should fallback to port 4000 in development', () => {
      delete process.env.EXPO_PUBLIC_API_URL;
      const url = getApiBaseUrl();
      expect(url).toMatch(/http:\/\/(localhost|10\.0\.2\.2):4000\/api/);
    });
  });

  describe('Centralized Health Check', () => {
    it('apiClient.health() should return true when GET /api/health responds ok', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' }),
      } as any);

      const isHealthy = await apiClient.health();
      expect(isHealthy).toBe(true);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/health$/),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('apiClient.health() should return false when endpoint fails or network is down', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network offline'));

      const isHealthy = await apiClient.health();
      expect(isHealthy).toBe(false);
    });
  });

  describe('HTTP Request & Security Lifecycle', () => {
    it('should automatically attach Authorization header when session token exists', async () => {
      await saveSession('jwt-token-alpha', mockUser);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ user: mockUser }),
      } as any);

      await apiClient.getMe();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer jwt-token-alpha',
          }),
        })
      );
    });

    it('should evict session on HTTP 401 Unauthorized', async () => {
      await saveSession('expired-token', mockUser);

      let unauthorizedCallbackCalled = false;
      setUnauthorizedHandler(() => {
        unauthorizedCallbackCalled = true;
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Session expirée' }),
      } as any);

      await expect(apiClient.getMe()).rejects.toThrow('Session expirée');

      // Le stockage de session doit être purgé
      const session = await readStoredSession();
      expect(session).toBeNull();
      expect(unauthorizedCallbackCalled).toBe(true);

      setUnauthorizedHandler(null);
    });

    it('should NOT evict session on HTTP 403 Forbidden', async () => {
      await saveSession('valid-token-forbidden-action', mockUser);

      let unauthorizedCallbackCalled = false;
      setUnauthorizedHandler(() => {
        unauthorizedCallbackCalled = true;
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Accès refusé' }),
      } as any);

      await expect(apiClient.getMe()).rejects.toThrow('Accès refusé');

      // Le stockage de session NE DOIT PAS être purgé sur un 403
      const session = await readStoredSession();
      expect(session).not.toBeNull();
      expect(session?.token).toBe('valid-token-forbidden-action');
      expect(unauthorizedCallbackCalled).toBe(false);

      setUnauthorizedHandler(null);
    });

    it('should throw ApiError with status 0 on network request failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

      let caughtError: any;
      try {
        await apiClient.getMe();
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ApiError);
      expect(caughtError.status).toBe(0);
      expect(isNetworkError(caughtError)).toBe(true);
    });
  });

  describe('isNetworkError Utility', () => {
    it('should identify network errors correctly', () => {
      expect(isNetworkError(new ApiError('Offline', 0))).toBe(true);
      expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
      expect(isNetworkError(new Error('Network request failed'))).toBe(true);
      expect(isNetworkError(new Error('connect ECONNREFUSED 127.0.0.1:4000'))).toBe(true);
      expect(isNetworkError(new ApiError('Not found', 404))).toBe(false);
      expect(isNetworkError(new ApiError('Server error', 500))).toBe(false);
      expect(isNetworkError(null)).toBe(false);
    });
  });
});
