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

export type SessionStatus =
  | 'loading'
  | 'authenticated'
  | 'offline'
  | 'server_error'
  | 'storage_error'
  | 'unauthenticated';

export interface AuthSessionState {
  status: SessionStatus;
  user: UserProfile | null;
  token: string | null;
  error: { status?: number; message: string } | null;
}

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
  save: (token: string, user: UserProfile) => Promise<boolean | void>;
  clear: () => Promise<boolean | void>;
}

const defaultDeps: SessionRestoreDeps = {
  readSession: readStoredSession,
  getMe: () => apiClient.getMe(),
  save: saveSession,
  clear: clearSession,
};

/**
 * Réducteur pur transformant le résultat de restauration en état d'authentification central.
 * Utilisé directement par AuthContext et testé de manière unitaire.
 */
export function resolveRestoreSessionState(result: RestoreSessionResult): AuthSessionState {
  switch (result.type) {
    case 'authenticated':
      return {
        status: 'authenticated',
        token: result.token,
        user: result.user,
        error: null,
      };
    case 'offline':
      return {
        status: 'offline',
        token: result.token,
        user: result.user,
        error: { message: result.error.message },
      };
    case 'server_error':
      return {
        status: 'server_error',
        token: result.token,
        user: result.user,
        error: { status: result.status, message: result.message },
      };
    case 'storage_error':
      return {
        status: 'storage_error',
        token: null,
        user: null,
        error: { message: result.error.message },
      };
    case 'invalid_token':
    case 'no_session':
    default:
      return {
        status: 'unauthenticated',
        token: null,
        user: null,
        error: null,
      };
  }
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
