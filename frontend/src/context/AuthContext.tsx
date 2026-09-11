import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  apiClient,
  SessionResponse,
  UserProfile,
  readToken,
  saveSession,
  clearSession,
  isNetworkError,
  ApiError,
  setUnauthorizedHandler,
} from '@/services/api';
import {
  performSessionRestore,
  resolveRestoreSessionState,
  SessionStatus,
  AuthSessionState,
} from '@/auth/sessionRestore';
import { dbService, isValidBuyerId } from '@/services/database';
import { cartStore } from '@/services/cart-store';

export type RefreshUserResult =
  | { type: 'success'; user: UserProfile }
  | { type: 'unauthenticated' }
  | { type: 'network_error'; error: Error }
  | { type: 'server_error'; status: number; message: string }
  | { type: 'obsolete' };

export interface AuthContextType {
  user: UserProfile | null;
  buyerId: string | null;
  token: string | null;
  loading: boolean;
  isLoading: boolean;
  authenticated: boolean;
  isOffline: boolean;
  sessionStatus: SessionStatus;
  sessionSeq: number;
  serverError: { status: number; message: string } | null;
  storageError: string | null;
  restoreSession: () => Promise<void>;
  refreshUser: () => Promise<RefreshUserResult>;
  signIn: (phone: string, pin: string, role?: 'buyer' | 'seller') => Promise<SessionResponse>;
  completeOtp: (phone: string, code: string, role: 'buyer' | 'seller') => Promise<SessionResponse>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuthProviderState(): AuthContextType {
  // Source de vérité unique pour la session
  const [session, setSession] = useState<AuthSessionState>({
    status: 'loading',
    user: null,
    token: null,
    error: null,
  });

  const sessionOpSeq = useRef(0);

  // Opération atomique centralisée de transition de session
  const commitSession = useCallback(
    async (
      opId: number,
      nextSession: AuthSessionState,
      userToActivate: UserProfile | null,
      options?: { saveToken?: string | null; runSync?: boolean }
    ): Promise<boolean> => {
      // Si une opération plus récente a débuté, rejeter immédiatement
      if (sessionOpSeq.current !== opId) {
        return false;
      }

      if (userToActivate && userToActivate.role === 'buyer') {
        const buyerId = (userToActivate.buyerId || userToActivate.id || '').trim();
        if (isValidBuyerId(buyerId)) {
          dbService.setActiveBuyerId(buyerId);
          await cartStore.setBuyerId(buyerId);

          // Revérifier après l'attente asynchrone de cartStore
          if (sessionOpSeq.current !== opId) {
            return false;
          }

          if (options?.saveToken) {
            await saveSession(options.saveToken, userToActivate);
          }

          if (sessionOpSeq.current !== opId) {
            return false;
          }

          setSession(nextSession);

          if (options?.runSync) {
            dbService.syncBuyerData(buyerId).catch(() => {});
          }
          return true;
        }
      }

      // Rôle non-acheteur, non-connecté ou déconnexion
      cartStore.reset();
      dbService.setActiveBuyerId(null);

      if (sessionOpSeq.current !== opId) {
        return false;
      }

      setSession(nextSession);
      return true;
    },
    []
  );

  const signOut = useCallback(async () => {
    const opId = ++sessionOpSeq.current;
    try {
      await apiClient.logout();
    } catch {
      // Ignorer l'échec backend pour garantir le nettoyage local
    } finally {
      await clearSession();
      if (sessionOpSeq.current === opId) {
        cartStore.reset();
        dbService.setActiveBuyerId(null);
        setSession({
          status: 'unauthenticated',
          user: null,
          token: null,
          error: null,
        });
      }
    }
  }, []);

  const refreshUser = useCallback(async (): Promise<RefreshUserResult> => {
    const opId = ++sessionOpSeq.current;
    try {
      const res = await apiClient.getMe();
      if (sessionOpSeq.current !== opId) {
        return { type: 'obsolete' };
      }
      if (res.user) {
        const currentToken = await readToken();
        if (sessionOpSeq.current !== opId) {
          return { type: 'obsolete' };
        }
        const committed = await commitSession(
          opId,
          {
            status: 'authenticated',
            user: res.user,
            token: currentToken,
            error: null,
          },
          res.user,
          { saveToken: currentToken, runSync: true }
        );
        if (!committed) {
          return { type: 'obsolete' };
        }
        return { type: 'success', user: res.user };
      }
      return { type: 'server_error', status: 500, message: 'Réponse utilisateur invalide' };
    } catch (err: any) {
      if (sessionOpSeq.current !== opId) {
        return { type: 'obsolete' };
      }
      if (err instanceof ApiError && err.status === 401) {
        await signOut();
        return { type: 'unauthenticated' };
      }
      if (isNetworkError(err)) {
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
  }, [commitSession, signOut]);

  const restoreSession = useCallback(async () => {
    const opId = ++sessionOpSeq.current;
    setSession((prev) => ({ ...prev, status: 'loading' }));
    try {
      const result = await performSessionRestore();
      if (sessionOpSeq.current !== opId) return;

      const nextSession = resolveRestoreSessionState(result);
      if (nextSession.status === 'authenticated' && nextSession.user) {
        await commitSession(opId, nextSession, nextSession.user, { runSync: true });
      } else {
        await commitSession(opId, nextSession, null);
      }
    } catch (err: any) {
      if (sessionOpSeq.current !== opId) return;
      await commitSession(
        opId,
        {
          status: 'storage_error',
          user: null,
          token: null,
          error: { message: err?.message || 'Erreur critique lors de la lecture du stockage' },
        },
        null
      );
    }
  }, [commitSession]);

  useEffect(() => {
    setUnauthorizedHandler(async () => {
      const opId = ++sessionOpSeq.current;
      await clearSession();
      if (sessionOpSeq.current === opId) {
        cartStore.reset();
        dbService.setActiveBuyerId(null);
        setSession({
          status: 'unauthenticated',
          user: null,
          token: null,
          error: null,
        });
      }
    });

    restoreSession();

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [restoreSession]);

  const signIn = useCallback(
    async (phone: string, pin: string, role?: 'buyer' | 'seller'): Promise<SessionResponse> => {
      const opId = ++sessionOpSeq.current;
      const res = await apiClient.login(phone, pin, role);
      if (sessionOpSeq.current !== opId) {
        return { message: 'Opération de session obsolète', obsolete: true };
      }
      if (res.token && res.user) {
        const committed = await commitSession(
          opId,
          {
            status: 'authenticated',
            user: res.user,
            token: res.token,
            error: null,
          },
          res.user,
          { saveToken: res.token, runSync: true }
        );
        if (!committed) {
          return { message: 'Opération de session obsolète', obsolete: true };
        }
      }
      return res;
    },
    [commitSession]
  );

  const completeOtp = useCallback(
    async (phone: string, code: string, role: 'buyer' | 'seller'): Promise<SessionResponse> => {
      const opId = ++sessionOpSeq.current;
      const res = await apiClient.verifyOtp(phone, code, role);
      if (sessionOpSeq.current !== opId) {
        return { message: 'Opération de session obsolète', obsolete: true };
      }
      if (res.token && res.user) {
        const committed = await commitSession(
          opId,
          {
            status: 'authenticated',
            user: res.user,
            token: res.token,
            error: null,
          },
          res.user,
          { saveToken: res.token, runSync: true }
        );
        if (!committed) {
          return { message: 'Opération de session obsolète', obsolete: true };
        }
      }
      return res;
    },
    [commitSession]
  );

  // Propriétés dérivées de manière stricte et prévisible
  const loading = session.status === 'loading';
  const isLoading = loading;
  const authenticated = session.status === 'authenticated' && Boolean(session.token && session.user);
  const rawBuyerId = session.user?.role === 'buyer' ? (session.user.buyerId || session.user.id || null) : null;
  const buyerId = rawBuyerId && isValidBuyerId(rawBuyerId) ? rawBuyerId : null;
  const isOffline = session.status === 'offline';
  const serverError =
    session.status === 'server_error' && session.error
      ? { status: session.error.status || 500, message: session.error.message }
      : null;
  const storageError =
    session.status === 'storage_error' ? session.error?.message || 'Stockage sécurisé indisponible' : null;

  return {
    user: session.user,
    buyerId,
    token: session.token,
    loading,
    isLoading,
    authenticated,
    isOffline,
    sessionStatus: session.status,
    sessionSeq: sessionOpSeq.current,
    serverError,
    storageError,
    restoreSession,
    refreshUser,
    signIn,
    completeOtp,
    signOut,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const value = useAuthProviderState();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé à l’intérieur d’un AuthProvider');
  }
  return context;
}
