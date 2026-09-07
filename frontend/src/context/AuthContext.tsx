import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  UserProfile,
  SessionResponse,
  apiClient,
  readToken,
  saveSession,
  clearSession,
  setUnauthorizedHandler,
  ApiError,
  isNetworkError,
} from '@/services/api';

import {
  performSessionRestore,
  resolveRestoreSessionState,
  SessionStatus,
  AuthSessionState,
} from '@/auth/sessionRestore';

export type RefreshUserResult =
  | { type: 'success'; user: UserProfile }
  | { type: 'unauthenticated' }
  | { type: 'network_error'; error: Error }
  | { type: 'server_error'; status: number; message: string };

export interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  authenticated: boolean;
  isOffline: boolean;
  sessionStatus: SessionStatus;
  serverError: { status: number; message: string } | null;
  storageError: string | null;
  restoreSession: () => Promise<void>;
  refreshUser: () => Promise<RefreshUserResult>;
  signIn: (phone: string, pin: string, role?: 'buyer' | 'seller') => Promise<SessionResponse>;
  completeOtp: (phone: string, code: string, role: 'buyer' | 'seller') => Promise<SessionResponse>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Source de vérité unique pour la session
  const [session, setSession] = useState<AuthSessionState>({
    status: 'loading',
    user: null,
    token: null,
    error: null,
  });

  const signOut = useCallback(async () => {
    try {
      await apiClient.logout();
    } catch {
      // Ignorer l'échec backend pour garantir le nettoyage local
    } finally {
      await clearSession();
      setSession({
        status: 'unauthenticated',
        user: null,
        token: null,
        error: null,
      });
    }
  }, []);

  const refreshUser = useCallback(async (): Promise<RefreshUserResult> => {
    try {
      const res = await apiClient.getMe();
      if (res.user) {
        setSession((prev) => ({
          ...prev,
          user: res.user,
          status: 'authenticated',
          error: null,
        }));
        const currentToken = await readToken();
        if (currentToken) {
          await saveSession(currentToken, res.user);
        }
        return { type: 'success', user: res.user };
      }
      return { type: 'server_error', status: 500, message: 'Réponse utilisateur invalide' };
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) {
        await signOut();
        return { type: 'unauthenticated' };
      }
      if (isNetworkError(err)) {
        // En cas de panne temporaire lors du refresh en arrière-plan, conserver l'accès de l'utilisateur
        return {
          type: 'network_error',
          error: err instanceof Error ? err : new Error(String(err?.message || 'Erreur réseau')),
        };
      }
      if (err instanceof ApiError) {
        return { type: 'server_error', status: err.status, message: err.message };
      }
      return { type: 'server_error', status: 500, message: err?.message || 'Erreur serveur' };
    }
  }, [signOut]);

  const restoreSession = useCallback(async () => {
    setSession((prev) => ({ ...prev, status: 'loading' }));
    try {
      const result = await performSessionRestore();
      const nextSession = resolveRestoreSessionState(result);
      setSession(nextSession);
    } catch (err: any) {
      setSession({
        status: 'storage_error',
        user: null,
        token: null,
        error: { message: err?.message || 'Erreur critique lors de la lecture du stockage' },
      });
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setSession({
        status: 'unauthenticated',
        user: null,
        token: null,
        error: null,
      });
    });

    restoreSession();

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [restoreSession]);

  const signIn = useCallback(
    async (phone: string, pin: string, role?: 'buyer' | 'seller'): Promise<SessionResponse> => {
      const res = await apiClient.login(phone, pin, role);
      if (res.token && res.user) {
        setSession({
          status: 'authenticated',
          user: res.user,
          token: res.token,
          error: null,
        });
      }
      return res;
    },
    []
  );

  const completeOtp = useCallback(
    async (phone: string, code: string, role: 'buyer' | 'seller'): Promise<SessionResponse> => {
      const res = await apiClient.verifyOtp(phone, code, role);
      if (res.token && res.user) {
        setSession({
          status: 'authenticated',
          user: res.user,
          token: res.token,
          error: null,
        });
      }
      return res;
    },
    []
  );

  // Propriétés dérivées de manière stricte et prévisible
  const loading = session.status === 'loading';
  const authenticated = session.status === 'authenticated' && Boolean(session.token && session.user);
  const isOffline = session.status === 'offline';
  const serverError =
    session.status === 'server_error' && session.error
      ? { status: session.error.status || 500, message: session.error.message }
      : null;
  const storageError =
    session.status === 'storage_error' ? session.error?.message || 'Stockage sécurisé indisponible' : null;

  return (
    <AuthContext.Provider
      value={{
        user: session.user,
        token: session.token,
        loading,
        authenticated,
        isOffline,
        sessionStatus: session.status,
        serverError,
        storageError,
        restoreSession,
        refreshUser,
        signIn,
        completeOtp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé à l’intérieur d’un AuthProvider');
  }
  return context;
}
