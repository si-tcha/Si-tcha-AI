import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  UserProfile,
  SessionResponse,
  apiClient,
  readToken,
  clearSession,
  setUnauthorizedHandler,
  ApiError,
} from '@/services/api';

export interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  authenticated: boolean;
  isOffline: boolean;
  restoreSession: () => Promise<void>;
  refreshUser: () => Promise<UserProfile | null>;
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
      // Ignorer les erreurs réseau pour garantir la déconnexion locale
    } finally {
      await clearSession();
      setUser(null);
      setToken(null);
      setIsOffline(false);
    }
  }, []);

  const refreshUser = useCallback(async (): Promise<UserProfile | null> => {
    try {
      const res = await apiClient.getMe();
      if (res.user) {
        setUser(res.user);
        setIsOffline(false);
        return res.user;
      }
      return null;
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) {
        await signOut();
        return null;
      }
      if (err instanceof ApiError && err.status === 0) {
        setIsOffline(true);
      }
      return null;
    }
  }, [signOut]);

  const restoreSession = useCallback(async () => {
    setLoading(true);
    try {
      const storedToken = await readToken();
      if (!storedToken) {
        setUser(null);
        setToken(null);
        setIsOffline(false);
        return;
      }

      // Valider obligatoirement le token auprès du backend via GET /api/auth/me
      try {
        const res = await apiClient.getMe();
        if (res.user) {
          setUser(res.user);
          setToken(storedToken);
          setIsOffline(false);
        } else {
          await clearSession();
          setUser(null);
          setToken(null);
          setIsOffline(false);
        }
      } catch (err: any) {
        if (err instanceof ApiError && err.status === 401) {
          // Token expiré ou révoqué
          await clearSession();
          setUser(null);
          setToken(null);
          setIsOffline(false);
        } else if (err instanceof ApiError && err.status === 0) {
          // Échec réseau au démarrage : mode dégradé explicite sans inventer un profil utilisateur actif non validé
          setIsOffline(true);
          setUser(null);
          setToken(null);
        } else {
          await clearSession();
          setUser(null);
          setToken(null);
        }
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

  const authenticated = Boolean(token && user);

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
