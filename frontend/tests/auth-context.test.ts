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
import { performSessionRestore } from '../src/auth/sessionRestore';

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
