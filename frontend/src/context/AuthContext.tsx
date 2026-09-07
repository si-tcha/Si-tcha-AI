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

import { performSessionRestore } from '@/auth/sessionRestore';

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
  restoreSession: () => Promise<void>;
  refreshUser: () => Promise<RefreshUserResult>;
  signIn: (phone: string, pin: string, role?: 'buyer' | 'seller') => Promise<SessionResponse>;
  completeOtp: (phone: string, code: string, role: 'buyer' | 'seller') => Promise<SessionResponse>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  const signOut = useCallback(async () => {
    try {
      await apiClient.logout();
    } catch {
      // Ignorer l'échec backend pour garantir le nettoyage local
    } finally {
      await clearSession();
      setUser(null);
      setToken(null);
      setIsOffline(false);
    }
  }, []);

  const refreshUser = useCallback(async (): Promise<RefreshUserResult> => {
    try {
      const res = await apiClient.getMe();
      if (res.user) {
        setUser(res.user);
        setIsOffline(false);
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
        setIsOffline(true);
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
    setLoading(true);
    try {
      const result = await performSessionRestore();
      if (result.type === 'no_session') {
        setUser(null);
        setToken(null);
        setIsOffline(false);
      } else if (result.type === 'authenticated') {
        setToken(result.token);
        setUser(result.user);
        setIsOffline(false);
      } else if (result.type === 'invalid_token') {
        setToken(null);
        setUser(null);
        setIsOffline(false);
      } else if (result.type === 'offline') {
        setToken(result.token);
        setUser(result.user);
        setIsOffline(true);
      } else if (result.type === 'server_error') {
        setToken(result.token);
        setUser(result.user);
        setIsOffline(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setToken(null);
    });

    restoreSession();

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [restoreSession]);

  const signIn = useCallback(
    async (phone: string, pin: string, role?: 'buyer' | 'seller'): Promise<SessionResponse> => {
      const session = await apiClient.login(phone, pin, role);
      if (session.token && session.user) {
        setToken(session.token);
        setUser(session.user);
        setIsOffline(false);
      }
      return session;
    },
    []
  );

  const completeOtp = useCallback(
    async (phone: string, code: string, role: 'buyer' | 'seller'): Promise<SessionResponse> => {
      const session = await apiClient.verifyOtp(phone, code, role);
      if (session.token && session.user) {
        setToken(session.token);
        setUser(session.user);
        setIsOffline(false);
      }
      return session;
    },
    []
  );

  // Authentifié uniquement si token, user valides ET connecté en ligne
  const authenticated = Boolean(token && user && !isOffline);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        authenticated,
        isOffline,
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
