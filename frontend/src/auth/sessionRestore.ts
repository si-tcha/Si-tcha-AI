import {
  UserProfile,
  readStoredSession,
  saveSession,
  clearSession,
  apiClient,
  ApiError,
  isNetworkError,
  StoredSessionV1,
} from '../services/api';

export type SessionState = 'loading' | 'authenticated' | 'offline' | 'server_error' | 'unauthenticated';

export type RestoreSessionResult =
  | { type: 'no_session' }
  | { type: 'authenticated'; token: string; user: UserProfile }
  | { type: 'invalid_token' }
  | { type: 'offline'; token: string; user: UserProfile; error: Error }
  | { type: 'server_error'; token: string; user: UserProfile; status: number; message: string }
  | { type: 'storage_error'; error: Error };

export interface SessionRestoreDeps {
  readSession: () => Promise<StoredSessionV1 | null>;
  getMe: () => Promise<{ user: UserProfile }>;
  save: (token: string, user: UserProfile) => Promise<void>;
  clear: () => Promise<void>;
}

const defaultDeps: SessionRestoreDeps = {
  readSession: readStoredSession,
  getMe: () => apiClient.getMe(),
  save: saveSession,
  clear: clearSession,
};

/**
 * Calcule de manière déterministe et pure l'état d'authentification visible.
 */
export function computeSessionState(params: {
  loading: boolean;
  token: string | null;
  user: UserProfile | null;
  isOffline: boolean;
  hasServerError: boolean;
  hasVerifiedSession: boolean;
}): SessionState {
  if (params.loading) return 'loading';
  if (!params.token || !params.user) return 'unauthenticated';
  if (params.hasServerError) return 'server_error';
  if (params.isOffline) return 'offline';
  if (params.hasVerifiedSession) return 'authenticated';
  return 'unauthenticated';
}

/**
 * Logique centralisée de restauration de session de production.
 */
export async function performSessionRestore(
  customDeps?: Partial<SessionRestoreDeps>
): Promise<RestoreSessionResult> {
  const deps: SessionRestoreDeps = { ...defaultDeps, ...customDeps };

  let stored: StoredSessionV1 | null = null;
  try {
    stored = await deps.readSession();
  } catch (err: any) {
    return {
      type: 'storage_error',
      error: err instanceof Error ? err : new Error(String(err?.message || 'Erreur accès stockage')),
    };
  }

  if (!stored) {
    return { type: 'no_session' };
  }

  try {
    const res = await deps.getMe();
    if (res.user) {
      await deps.save(stored.token, res.user);
      return { type: 'authenticated', token: stored.token, user: res.user };
    }
    return {
      type: 'server_error',
      token: stored.token,
      user: stored.user,
      status: 500,
      message: 'Profil vide',
    };
  } catch (err: any) {
    if (err instanceof ApiError && err.status === 401) {
      await deps.clear();
      return { type: 'invalid_token' };
    }
    if (isNetworkError(err)) {
      return {
        type: 'offline',
        token: stored.token,
        user: stored.user,
        error: err instanceof Error ? err : new Error(String(err?.message || 'Erreur réseau')),
      };
    }
    if (err instanceof ApiError) {
      return {
        type: 'server_error',
        token: stored.token,
        user: stored.user,
        status: err.status,
        message: err.message,
      };
    }
    return {
      type: 'server_error',
      token: stored.token,
      user: stored.user,
      status: 500,
      message: err?.message || 'Erreur inconnue',
    };
  }
}
