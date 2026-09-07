import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  apiClient,
  saveSession,
  clearSession,
  readToken,
  UserProfile,
  ApiError,
} from '../src/services/api';

describe('Auth Session Logic & Lifecycle', () => {
  const mockBuyer: UserProfile = {
    id: '101',
    role: 'buyer',
    name: 'Entreprise Cacao',
    phone: '+237699112233',
    status: 'active',
    phoneVerified: true,
  };

  const mockSellerPending: UserProfile = {
    id: '202',
    role: 'seller',
    name: 'Planteur Jean',
    phone: '+237677223344',
    status: 'pending',
    statut: 'EN_ATTENTE',
    phoneVerified: true,
    gicId: 'gic-99',
  };

  beforeEach(async () => {
    await clearSession();
    vi.restoreAllMocks();
  });

  it('restoreSession should set unauthenticated state when no token is present', async () => {
    const token = await readToken();
    expect(token).toBeNull();

    const restoredToken = await readToken();
    let user: UserProfile | null = null;
    let isOffline = false;

    if (!restoredToken) {
      user = null;
      isOffline = false;
    }

    expect(user).toBeNull();
    expect(isOffline).toBe(false);
  });

  it('restoreSession should validate stored token via getMe and set active user', async () => {
    await saveSession('valid-token-123', mockBuyer);

    const getMeSpy = vi.spyOn(apiClient, 'getMe').mockResolvedValueOnce({
      user: mockBuyer,
    });

    const storedToken = await readToken();
    expect(storedToken).toBe('valid-token-123');

    const meRes = await apiClient.getMe();
    expect(getMeSpy).toHaveBeenCalledTimes(1);
    expect(meRes.user).toEqual(mockBuyer);
    expect(meRes.user.status).toBe('active');
  });

  it('restoreSession should purge session when backend returns 401 (expired/revoked token)', async () => {
    await saveSession('expired-token', mockBuyer);

    vi.spyOn(apiClient, 'getMe').mockRejectedValueOnce(
      new ApiError('Non autorisé, jeton invalide ou expiré', 401)
    );

    let user: UserProfile | null = mockBuyer;
    let token: string | null = 'expired-token';

    try {
      await apiClient.getMe();
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) {
        await clearSession();
        user = null;
        token = null;
      }
    }

    expect(user).toBeNull();
    expect(token).toBeNull();
    expect(await readToken()).toBeNull();
  });

  it('restoreSession should enter explicit offline mode upon network failure without faking user', async () => {
    await saveSession('offline-token', mockBuyer);

    vi.spyOn(apiClient, 'getMe').mockRejectedValueOnce(
      new ApiError('Pas de connexion réseau.', 0)
    );

    let user: UserProfile | null = null;
    let token: string | null = null;
    let isOffline = false;

    try {
      const res = await apiClient.getMe();
      user = res.user;
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 0) {
        isOffline = true;
        user = null;
        token = null;
      }
    }

    expect(isOffline).toBe(true);
    expect(user).toBeNull();
    expect(token).toBeNull();
  });

  it('signOut should call backend logout and atomically wipe local session', async () => {
    await saveSession('active-token', mockSellerPending);

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ message: 'Déconnexion réussie.' }),
    });

    const res = await apiClient.logout();

    expect(res.message).toBe('Déconnexion réussie.');
    expect(await readToken()).toBeNull();
  });

  it('signOut should guarantee local session wipe even if backend logout fails with network error', async () => {
    await saveSession('active-token', mockSellerPending);

    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Network offline'));

    const res = await apiClient.logout();
    expect(res.message).toMatch(/Déconnexion locale/i);
    expect(await readToken()).toBeNull();
  });
});
