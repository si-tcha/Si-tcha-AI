import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  apiClient,
  ApiError,
  getApiBaseUrl,
  resolveApiBaseUrl,
  isNetworkError,
  saveSession,
  readStoredSession,
  clearSession,
  setUnauthorizedHandler,
  isValidStoredSession,
  computeNativePhysicalDevice,
  _resetMemorySessionForTesting,
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
    _resetMemorySessionForTesting();
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

  describe('Centralized Base URL Resolution & Physical Device Detection', () => {
    it('1. Web local en développement avec isDevice: true doit pointer sur http://localhost:4000/api', () => {
      // Sur le web, expo-device renvoie toujours isDevice: true
      const url = resolveApiBaseUrl({
        platform: 'web',
        isDevice: true,
        envUrl: undefined,
        isDev: true,
      });
      expect(url).toBe('http://localhost:4000/api');
    });

    it('2. Simulateur iOS en développement doit pointer sur http://localhost:4000/api', () => {
      const url = resolveApiBaseUrl({
        platform: 'ios',
        isDevice: false,
        envUrl: undefined,
        isDev: true,
      });
      expect(url).toBe('http://localhost:4000/api');
    });

    it('3. Émulateur Android en développement doit pointer sur http://10.0.2.2:4000/api', () => {
      const url = resolveApiBaseUrl({
        platform: 'android',
        isDevice: false,
        envUrl: undefined,
        isDev: true,
      });
      expect(url).toBe('http://10.0.2.2:4000/api');
    });

    it('4. Android physique avec URL explicite doit utiliser cette URL', () => {
      const url = resolveApiBaseUrl({
        platform: 'android',
        isDevice: true,
        envUrl: 'http://192.168.1.50:4000/api/',
        isDev: true,
      });
      expect(url).toBe('http://192.168.1.50:4000/api');
    });

    it('5. Android ou iOS physique sans EXPO_PUBLIC_API_URL doit lever une erreur explicite sans tenter 10.0.2.2', () => {
      expect(() =>
        resolveApiBaseUrl({
          platform: 'android',
          isDevice: true,
          envUrl: undefined,
          isDev: true,
        })
      ).toThrowError(/EXPO_PUBLIC_API_URL est obligatoire sur un appareil physique/);

      expect(() =>
        resolveApiBaseUrl({
          platform: 'ios',
          isDevice: true,
          envUrl: undefined,
          isDev: true,
        })
      ).toThrowError(/EXPO_PUBLIC_API_URL est obligatoire sur un appareil physique/);
    });

    it('6. Mode production sans EXPO_PUBLIC_API_URL doit lever une erreur de configuration sur toute plateforme', () => {
      expect(() =>
        resolveApiBaseUrl({
          platform: 'web',
          isDevice: true,
          envUrl: undefined,
          isDev: false,
        })
      ).toThrowError(/EXPO_PUBLIC_API_URL doit être définie en environnement de production/);

      expect(() =>
        resolveApiBaseUrl({
          platform: 'android',
          isDevice: false,
          envUrl: undefined,
          isDev: false,
        })
      ).toThrowError(/EXPO_PUBLIC_API_URL doit être définie en environnement de production/);
    });

    it('7. Mode production avec validation stricte de l’URL API (HTTPS, non-local, credentials, etc.)', () => {
      // Refus de HTTP au lieu de HTTPS
      expect(() =>
        resolveApiBaseUrl({
          platform: 'web',
          isDevice: true,
          envUrl: 'http://api.sitcha.org/api',
          isDev: false,
        })
      ).toThrowError(/doit impérativement utiliser le protocole HTTPS/);

      // Refus de 192.168.0.0/16
      expect(() =>
        resolveApiBaseUrl({
          platform: 'android',
          isDevice: true,
          envUrl: 'http://192.168.1.20:4000/api',
          isDev: false,
        })
      ).toThrowError(/doit impérativement utiliser le protocole HTTPS/);

      expect(() =>
        resolveApiBaseUrl({
          platform: 'android',
          isDevice: true,
          envUrl: 'https://192.168.1.20:4000/api',
          isDev: false,
        })
      ).toThrowError(/réseau privé 192\.168\.0\.0\/16/);

      // Refus de 172.16.0.0/12
      expect(() =>
        resolveApiBaseUrl({
          platform: 'android',
          isDevice: true,
          envUrl: 'http://172.16.0.5/api',
          isDev: false,
        })
      ).toThrowError(/doit impérativement utiliser le protocole HTTPS/);

      expect(() =>
        resolveApiBaseUrl({
          platform: 'android',
          isDevice: true,
          envUrl: 'https://172.16.0.5/api',
          isDev: false,
        })
      ).toThrowError(/réseau privé 172\.16\.0\.0\/12/);

      // Refus de 10.0.0.0/8
      expect(() =>
        resolveApiBaseUrl({
          platform: 'android',
          isDevice: false,
          envUrl: 'http://10.1.2.3/api',
          isDev: false,
        })
      ).toThrowError(/doit impérativement utiliser le protocole HTTPS/);

      expect(() =>
        resolveApiBaseUrl({
          platform: 'android',
          isDevice: false,
          envUrl: 'https://10.1.2.3/api',
          isDev: false,
        })
      ).toThrowError(/réseau privé 10\.0\.0\.0\/8/);

      // Refus de localhost et loopback 127.0.0.0/8
      expect(() =>
        resolveApiBaseUrl({
          platform: 'android',
          isDevice: true,
          envUrl: 'https://127.0.0.1:4000/api',
          isDev: false,
        })
      ).toThrowError(/boucle locale 127\.0\.0\.0\/8/);

      expect(() =>
        resolveApiBaseUrl({
          platform: 'web',
          isDevice: true,
          envUrl: 'https://localhost:4000/api',
          isDev: false,
        })
      ).toThrowError(/localhost/);

      // Refus de 0.0.0.0
      expect(() =>
        resolveApiBaseUrl({
          platform: 'web',
          isDevice: true,
          envUrl: 'https://0.0.0.0:4000/api',
          isDev: false,
        })
      ).toThrowError(/0\.0\.0\.0/);

      // Refus de link-local 169.254.0.0/16
      expect(() =>
        resolveApiBaseUrl({
          platform: 'android',
          isDevice: true,
          envUrl: 'https://169.254.1.1/api',
          isDev: false,
        })
      ).toThrowError(/link-local/);

      // Refus IPv6 localhost [::1]
      expect(() =>
        resolveApiBaseUrl({
          platform: 'android',
          isDevice: true,
          envUrl: 'http://[::1]:4000/api',
          isDev: false,
        })
      ).toThrowError(/doit impérativement utiliser le protocole HTTPS/);

      expect(() =>
        resolveApiBaseUrl({
          platform: 'android',
          isDevice: true,
          envUrl: 'https://[::1]:4000/api',
          isDev: false,
        })
      ).toThrowError(/adresse IPv6 locale ou réservée/);

      // Refus de username/password dans l'URL
      expect(() =>
        resolveApiBaseUrl({
          platform: 'android',
          isDevice: true,
          envUrl: 'https://user:password@api.sitcha.org/api',
          isDev: false,
        })
      ).toThrowError(/ne doit pas contenir d'identifiants/);

      // Refus d'URL malformée
      expect(() =>
        resolveApiBaseUrl({
          platform: 'android',
          isDevice: true,
          envUrl: 'not-an-url',
          isDev: false,
        })
      ).toThrowError(/n'est pas une URL valide/);

      // Acceptation d'une URL HTTPS publique valide avec normalisation du slash final
      const validProdUrl = resolveApiBaseUrl({
        platform: 'android',
        isDevice: true,
        envUrl: 'https://api.sitcha.org/api///',
        isDev: false,
      });
      expect(validProdUrl).toBe('https://api.sitcha.org/api');
    });

    it('8. computeNativePhysicalDevice et getApiBaseUrl doivent normaliser le Web comme non physique natif', () => {
      // computeNativePhysicalDevice
      expect(computeNativePhysicalDevice('web', true)).toBe(false);
      expect(computeNativePhysicalDevice('android', true)).toBe(true);
      expect(computeNativePhysicalDevice('ios', true)).toBe(true);
      expect(computeNativePhysicalDevice('android', false)).toBe(false);

      // getApiBaseUrl en dev sans envUrl doit retourner port 4000 valide
      delete process.env.EXPO_PUBLIC_API_URL;
      const baseUrl = getApiBaseUrl();
      expect(baseUrl).toMatch(/http:\/\/(localhost|10\.0\.2\.2):4000\/api/);
    });
  });

  describe('Session Validation & Storage Hardening', () => {
    it('isValidStoredSession should accept valid v1 session', () => {
      const valid = {
        version: 1,
        token: 'token-123',
        user: mockUser,
      };
      expect(isValidStoredSession(valid)).toBe(true);
    });

    it('isValidStoredSession should reject session with invalid version or empty token', () => {
      expect(isValidStoredSession({ version: 2, token: 'token', user: mockUser })).toBe(false);
      expect(isValidStoredSession({ version: 1, token: '', user: mockUser })).toBe(false);
      expect(isValidStoredSession({ version: 1, token: '   ', user: mockUser })).toBe(false);
    });

    it('isValidStoredSession should reject invalid or missing user fields', () => {
      expect(isValidStoredSession({ version: 1, token: 'token', user: { ...mockUser, role: 'invalid' } })).toBe(false);
      expect(isValidStoredSession({ version: 1, token: 'token', user: { ...mockUser, status: 'unknown' } })).toBe(false);
      expect(isValidStoredSession({ version: 1, token: 'token', user: { ...mockUser, phoneVerified: 'yes' } })).toBe(false);
      expect(isValidStoredSession({ version: 1, token: 'token', user: { ...mockUser, id: '' } })).toBe(false);
    });

    it('saveSession should throw and NOT update memory if storage write throws', async () => {
      vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });

      _resetMemorySessionForTesting();
      await expect(saveSession('token-abc', mockUser)).rejects.toThrow('QuotaExceededError');

      // memorySession ne doit PAS être mis à jour
      _resetMemorySessionForTesting();
      // Lecture via localStorage (qui est vide)
      const session = await readStoredSession();
      expect(session).toBeNull();
    });

    it('readStoredSession should clean up corrupted JSON and return null', async () => {
      localStorage.setItem('sitcha_session_v1', '{ invalid json syntax');
      _resetMemorySessionForTesting();

      const session = await readStoredSession();
      expect(session).toBeNull();
      expect(localStorage.getItem('sitcha_session_v1')).toBeNull();
    });

    it('readStoredSession should propagate real storage access failures', async () => {
      vi.spyOn(localStorage, 'getItem').mockImplementationOnce(() => {
        throw new Error('SecurityError: Access denied to storage');
      });
      _resetMemorySessionForTesting();

      await expect(readStoredSession()).rejects.toThrow('SecurityError: Access denied to storage');
    });

    it('should NEVER grant active or phoneVerified authorization to legacy profile lacking these fields', async () => {
      // Profil legacy sans status ni phoneVerified
      const insecureLegacyUser = {
        id: 'legacy-999',
        name: 'Utilisateur Ancien',
        phone: '+237699000000',
        role: 'buyer',
        // status et phoneVerified manquent volontairement
      };

      localStorage.setItem('sitcha_api_token', 'legacy-tok-999');
      localStorage.setItem('sitcha_user_profile', JSON.stringify(insecureLegacyUser));

      _resetMemorySessionForTesting();
      const session = await readStoredSession();

      // Ne doit JAMAIS créer une session v1 active ou vérifiée de manière artificielle
      expect(session).toBeNull();
      expect(localStorage.getItem('sitcha_session_v1')).toBeNull();
      // Les clés legacy invalides doivent être supprimées pour exiger une reconnexion
      expect(localStorage.getItem('sitcha_api_token')).toBeNull();
      expect(localStorage.getItem('sitcha_user_profile')).toBeNull();
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
    });
  });

  describe('Stand-alone CI Script validate-api-url.mjs Coherence', () => {
    it('valide de manière strictement identique à validateProductionApiUrl', async () => {
      const { validateApiUrl } = await import('../../scripts/validate-api-url.mjs');
      const { validateProductionApiUrl } = await import('../src/services/api');

      // URLs valides
      const validUrls = [
        'https://api.sitcha.org',
        'https://api-staging.sitcha.org/api/',
        'https://sub.domain.cm/api/v1',
      ];

      for (const url of validUrls) {
        expect(validateApiUrl(url)).toBe(validateProductionApiUrl(url));
      }

      // URLs invalides : toutes doivent lever une erreur dans les 2 validateurs
      const invalidUrls = [
        '',
        '   ',
        'http://api.sitcha.org',
        'https://localhost:4000',
        'https://dev.localhost',
        'https://127.0.0.1:4000',
        'https://10.0.2.2:4000',
        'https://192.168.1.50:4000',
        'https://172.20.0.2:4000',
        'https://169.254.1.1:4000',
        'https://0.0.0.0:4000',
        'https://user:pass@api.sitcha.org',
      ];

      for (const url of invalidUrls) {
        expect(() => validateApiUrl(url)).toThrow();
        expect(() => validateProductionApiUrl(url)).toThrow();
      }
    });
  });
});
