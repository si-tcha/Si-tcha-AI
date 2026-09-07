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

export type RestoreSessionResult =
  | { type: 'no_session' }
  | { type: 'authenticated'; token: string; user: UserProfile }
  | { type: 'invalid_token' }
  | { type: 'offline'; token: string; user: UserProfile; error: Error }
  | { type: 'server_error'; token: string; user: UserProfile; status: number; message: string };

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
 * Logique centralisée de restauration de session de production.
 */
export async function performSessionRestore(
  customDeps?: Partial<SessionRestoreDeps>
): Promise<RestoreSessionResult> {
  const deps: SessionRestoreDeps = { ...defaultDeps, ...customDeps };

  const stored = await deps.readSession();
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
