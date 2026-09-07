import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  apiClient,
  saveSession,
  clearSession,
  readStoredSession,
  UserProfile,
  ApiError,
  SESSION_KEY,
} from '../src/services/api';
import {
  performSessionRestore,
  resolveRestoreSessionState,
  RestoreSessionResult,
} from '../src/auth/sessionRestore';

describe('Production Session Restoration, Persistence & Lifecycle Tests', () => {
  const mockBuyer: UserProfile = {
    id: '101',
    role: 'buyer',
    name: 'Entreprise Cacao Sarl',
    phone: '+237699112233',
    status: 'active',
    phoneVerified: true,
  };

  const mockSellerPending: UserProfile = {
    id: '202',
    role: 'seller',
    name: 'Planteur Martin',
    phone: '+237677223344',
    status: 'pending',
    statut: 'EN_ATTENTE',
    phoneVerified: true,
    gicId: 'gic-10',
  };

  beforeEach(async () => {
    await clearSession();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('Session Restoration (performSessionRestore)', () => {
    it('should return no_session when local storage is empty', async () => {
      const result = await performSessionRestore();
      expect(result.type).toBe('no_session');
    });

    it('should return authenticated and update stored session when token is valid', async () => {
      await saveSession('token-xyz', mockBuyer);

      vi.spyOn(apiClient, 'getMe').mockResolvedValueOnce({
        user: { ...mockBuyer, name: 'Entreprise Cacao Modifiée' },
      });

      const result = await performSessionRestore();

      expect(result.type).toBe('authenticated');
      if (result.type === 'authenticated') {
        expect(result.token).toBe('token-xyz');
        expect(result.user.name).toBe('Entreprise Cacao Modifiée');
      }

      const stored = await readStoredSession();
      expect(stored?.user.name).toBe('Entreprise Cacao Modifiée');
    });

    it('should return invalid_token and clean storage when getMe returns 401', async () => {
      await saveSession('expired-token', mockBuyer);

      vi.spyOn(apiClient, 'getMe').mockRejectedValueOnce(
        new ApiError('Token expiré', 401)
      );

      const result = await performSessionRestore();

      expect(result.type).toBe('invalid_token');
      const stored = await readStoredSession();
      expect(stored).toBeNull();
    });

    it('should enter offline mode and PRESERVE local session during network failure', async () => {
      await saveSession('saved-offline-token', mockSellerPending);

      const networkError = new ApiError('Pas de connexion réseau.', 0);
      vi.spyOn(apiClient, 'getMe').mockRejectedValueOnce(networkError);

      const result = await performSessionRestore();

      expect(result.type).toBe('offline');
      if (result.type === 'offline') {
        expect(result.token).toBe('saved-offline-token');
        expect(result.user.name).toBe('Planteur Martin');
      }

      // La session locale DOIT être préservée intacte en mode hors ligne
      const stored = await readStoredSession();
      expect(stored).not.toBeNull();
      expect(stored?.token).toBe('saved-offline-token');
    });

    it('should return server_error on HTTP 500, preserve local session for retry, and block dashboard access', async () => {
      await saveSession('server-error-token', mockBuyer);

      vi.spyOn(apiClient, 'getMe').mockRejectedValueOnce(
        new ApiError('Erreur interne du serveur.', 500)
      );

      const result = await performSessionRestore();

      expect(result.type).toBe('server_error');
      if (result.type === 'server_error') {
        expect(result.status).toBe(500);
        expect(result.token).toBe('server-error-token');
        expect(result.user.id).toBe('101');
      }

      // Vérifier que la session locale reste présente pour permettre un retry ultérieur
      const stored = await readStoredSession();
      expect(stored).not.toBeNull();
      expect(stored?.token).toBe('server-error-token');
    });

    it('should successfully restore user after retry when network returns', async () => {
      await saveSession('retry-token', mockBuyer);

      // 1. Première tentative : panne réseau
      vi.spyOn(apiClient, 'getMe').mockRejectedValueOnce(
        new ApiError('Pas de connexion réseau.', 0)
      );

      const firstAttempt = await performSessionRestore();
      expect(firstAttempt.type).toBe('offline');

      // 2. Deuxième tentative (Retry) : le réseau est rétabli
      vi.spyOn(apiClient, 'getMe').mockResolvedValueOnce({
        user: mockBuyer,
      });

      const retryAttempt = await performSessionRestore();
      expect(retryAttempt.type).toBe('authenticated');
      if (retryAttempt.type === 'authenticated') {
        expect(retryAttempt.user.id).toBe('101');
      }
    });

    it('should return storage_error when persistent storage read fails (no silent logout)', async () => {
      const storageError = new Error('SecureStore hardware enclave unavailable');
      const result = await performSessionRestore({
        readSession: vi.fn().mockRejectedValue(storageError),
      });

      expect(result.type).toBe('storage_error');
      if (result.type === 'storage_error') {
        expect(result.error.message).toBe('SecureStore hardware enclave unavailable');
      }

      // La réduction d'état doit être storage_error, PAS unauthenticated
      const state = resolveRestoreSessionState(result);
      expect(state.status).toBe('storage_error');
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.error?.message).toBe('SecureStore hardware enclave unavailable');
    });

    it('should recover after retry once storage becomes accessible again', async () => {
      let storageAvailable = false;
      const deps = {
        readSession: vi.fn().mockImplementation(async () => {
          if (!storageAvailable) {
            throw new Error('Keyring locked');
          }
          return { version: 1 as const, token: 'recovered-token', user: mockBuyer };
        }),
        getMe: vi.fn().mockResolvedValue({ user: mockBuyer }),
        save: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      };

      // 1. Première tentative : échec du stockage
      const firstResult = await performSessionRestore(deps);
      expect(firstResult.type).toBe('storage_error');
      const firstState = resolveRestoreSessionState(firstResult);
      expect(firstState.status).toBe('storage_error');

      // 2. Deuxième tentative (Retry) : le stockage est redevenu accessible
      storageAvailable = true;
      const retryResult = await performSessionRestore(deps);
      expect(retryResult.type).toBe('authenticated');
      const retryState = resolveRestoreSessionState(retryResult);
      expect(retryState.status).toBe('authenticated');
      expect(retryState.token).toBe('recovered-token');
      expect(retryState.user?.id).toBe('101');
    });
  });

  describe('Pure resolveRestoreSessionState Reducer Tests (Single Source of Truth)', () => {
    it('should reduce authenticated result to authenticated state', () => {
      const result: RestoreSessionResult = {
        type: 'authenticated',
        token: 'auth-tok',
        user: mockBuyer,
      };
      const state = resolveRestoreSessionState(result);
      expect(state).toEqual({
        status: 'authenticated',
        token: 'auth-tok',
        user: mockBuyer,
        error: null,
      });
    });

    it('should reduce offline result to offline state preserving user, token, and error', () => {
      const result: RestoreSessionResult = {
        type: 'offline',
        token: 'off-tok',
        user: mockBuyer,
        error: new Error('Network offline'),
      };
      const state = resolveRestoreSessionState(result);
      expect(state.status).toBe('offline');
      expect(state.token).toBe('off-tok');
      expect(state.user).toEqual(mockBuyer);
      expect(state.error?.message).toBe('Network offline');
    });

    it('should reduce server_error result to server_error state preserving user, token, and status code', () => {
      const result: RestoreSessionResult = {
        type: 'server_error',
        token: 'srv-tok',
        user: mockBuyer,
        status: 503,
        message: 'Service Unavailable',
      };
      const state = resolveRestoreSessionState(result);
      expect(state.status).toBe('server_error');
      expect(state.token).toBe('srv-tok');
      expect(state.user).toEqual(mockBuyer);
      expect(state.error).toEqual({ status: 503, message: 'Service Unavailable' });
    });

    it('should reduce storage_error result to storage_error state WITHOUT fake unauthenticated or logout', () => {
      const result: RestoreSessionResult = {
        type: 'storage_error',
        error: new Error('SecureStore disk failure'),
      };
      const state = resolveRestoreSessionState(result);
      expect(state.status).toBe('storage_error');
      expect(state.status).not.toBe('unauthenticated');
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
      expect(state.error?.message).toBe('SecureStore disk failure');
    });

    it('should reduce invalid_token and no_session to unauthenticated', () => {
      const noSessionState = resolveRestoreSessionState({ type: 'no_session' });
      expect(noSessionState).toEqual({
        status: 'unauthenticated',
        token: null,
        user: null,
        error: null,
      });

      const invalidTokenState = resolveRestoreSessionState({ type: 'invalid_token' });
      expect(invalidTokenState).toEqual({
        status: 'unauthenticated',
        token: null,
        user: null,
        error: null,
      });
    });
  });

  describe('Atomic Storage, Corruption & Migration', () => {
    it('should delete corrupt session data and return null', async () => {
      localStorage.setItem(SESSION_KEY, 'invalid-non-json-content{');

      const stored = await readStoredSession();
      expect(stored).toBeNull();
      expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    });

    it('should delete session data with invalid schema (e.g. missing role) and return null', async () => {
      const invalidData = {
        version: 1,
        token: 'token-123',
        user: { id: '99', name: 'Invalide' }, // role manquant
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(invalidData));

      const stored = await readStoredSession();
      expect(stored).toBeNull();
      expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    });

    it('should throw and not update memory state if storage persistence fails', async () => {
      vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
        throw new Error('QuotaExceeded / SecureStore disk full');
      });

      await expect(saveSession('failed-token', mockBuyer)).rejects.toThrow(
        'QuotaExceeded / SecureStore disk full'
      );

      // La mémoire ne doit pas être mise à jour
      const current = await readStoredSession();
      expect(current).toBeNull();
    });

    it('should migrate legacy storage keys to sitcha_session_v1 and clean up old keys', async () => {
      // Simuler la présence d'anciennes clés
      localStorage.setItem('sitcha_api_token', 'legacy-token-777');
      localStorage.setItem('sitcha_user_profile', JSON.stringify(mockBuyer));
      localStorage.setItem('sitcha_user_role', 'buyer');

      const session = await readStoredSession();

      expect(session).not.toBeNull();
      expect(session?.token).toBe('legacy-token-777');
      expect(session?.user.role).toBe('buyer');

      // Vérifier que la nouvelle clé sitcha_session_v1 a été créée
      expect(localStorage.getItem(SESSION_KEY)).not.toBeNull();

      // Vérifier que les anciennes clés ont été supprimées
      expect(localStorage.getItem('sitcha_api_token')).toBeNull();
      expect(localStorage.getItem('sitcha_user_profile')).toBeNull();
      expect(localStorage.getItem('sitcha_user_role')).toBeNull();
    });
  });
});
