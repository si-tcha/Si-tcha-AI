import React, { createContext, useContext, useEffect, useRef, useSyncExternalStore } from 'react';
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

// ─── COORDINATEUR DE SESSION ATOMIQUE (Latest-Wins) ──────────────────────────

export class AuthSessionCoordinator {
  private sessionOpSeq = 0;
  private session: AuthSessionState = {
    status: 'loading',
    user: null,
    token: null,
    error: null,
  };
  private listeners = new Set<() => void>();

  constructor() {
    this.session = {
      status: 'loading',
      user: null,
      token: null,
      error: null,
    };
  }

  public subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public getState = (): AuthSessionState => {
    return this.session;
  };

  public getSessionOpSeq = (): number => {
    return this.sessionOpSeq;
  };

  public commitSession = async (
    opId: number,
    nextSession: AuthSessionState,
    userToActivate: UserProfile | null,
    options?: { saveToken?: string | null; runSync?: boolean }
  ): Promise<boolean> => {
    // Si une opération plus récente a débuté, rejeter immédiatement
    if (opId < this.sessionOpSeq) {
      return false;
    }
    this.sessionOpSeq = Math.max(this.sessionOpSeq, opId);

    if (userToActivate && userToActivate.role === 'buyer') {
      const buyerId = (userToActivate.buyerId || userToActivate.id || '').trim();
      if (isValidBuyerId(buyerId)) {
        dbService.setActiveBuyerId(buyerId);
        await cartStore.setBuyerId(buyerId);

        // Revérifier après l'attente asynchrone de cartStore
        if (this.sessionOpSeq > opId) {
          return false;
        }

        if (options?.saveToken) {
          await saveSession(options.saveToken, userToActivate, opId);
        }

        if (this.sessionOpSeq > opId) {
          return false;
        }

        this.session = nextSession;
        this.notify();

        if (options?.runSync) {
          dbService.syncBuyerData(buyerId).catch(() => {});
        }
        return true;
      }
    }

    // Rôle non-acheteur, non-connecté ou déconnexion
    cartStore.reset();
    dbService.setActiveBuyerId(null);

    if (this.sessionOpSeq > opId) {
      return false;
    }

    this.session = nextSession;
    this.notify();
    return true;
  };

  public signIn = async (phone: string, pin: string, role?: 'buyer' | 'seller'): Promise<SessionResponse> => {
    const opId = ++this.sessionOpSeq;
    const res = await apiClient.login(phone, pin, role);
    if (this.sessionOpSeq !== opId) {
      return { message: 'Opération de session obsolète', obsolete: true };
    }
    if (res.token && res.user) {
      const committed = await this.commitSession(
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
  };

  public completeOtp = async (phone: string, code: string, role: 'buyer' | 'seller'): Promise<SessionResponse> => {
    const opId = ++this.sessionOpSeq;
    const res = await apiClient.verifyOtp(phone, code, role);
    if (this.sessionOpSeq !== opId) {
      return { message: 'Opération de session obsolète', obsolete: true };
    }
    if (res.token && res.user) {
      const committed = await this.commitSession(
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
  };

  public signOut = async (): Promise<void> => {
    const opId = ++this.sessionOpSeq;
    try {
      await apiClient.logout();
    } catch {
      // Ignorer l'échec backend pour garantir le nettoyage local
    } finally {
      if (this.sessionOpSeq === opId) {
        await clearSession(opId);
        cartStore.reset();
        dbService.setActiveBuyerId(null);
        this.session = {
          status: 'unauthenticated',
          user: null,
          token: null,
          error: null,
        };
        this.notify();
      }
    }
  };

  public refreshUser = async (): Promise<RefreshUserResult> => {
    const opId = ++this.sessionOpSeq;
    try {
      const res = await apiClient.getMe();
      if (this.sessionOpSeq !== opId) {
        return { type: 'obsolete' };
      }
      if (res.user) {
        const currentToken = await readToken();
        if (this.sessionOpSeq !== opId) {
          return { type: 'obsolete' };
        }
        const committed = await this.commitSession(
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
      if (this.sessionOpSeq !== opId) {
        return { type: 'obsolete' };
      }
      if (err instanceof ApiError && err.status === 401) {
        await this.signOut();
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
  };

  public restoreSession = async (): Promise<void> => {
    const opId = ++this.sessionOpSeq;
    this.session = { ...this.session, status: 'loading' };
    this.notify();

    try {
      const result = await performSessionRestore({
        save: async (token, user) => {
          if (this.sessionOpSeq === opId) {
            await saveSession(token, user, opId);
          }
        },
        clear: async () => {
          if (this.sessionOpSeq === opId) {
            await clearSession(opId);
          }
        },
      });
      if (this.sessionOpSeq !== opId) return;

      const nextSession = resolveRestoreSessionState(result);
      if (nextSession.status === 'authenticated' && nextSession.user) {
        await this.commitSession(opId, nextSession, nextSession.user, { runSync: true });
      } else {
        await this.commitSession(opId, nextSession, null);
      }
    } catch (err: any) {
      if (this.sessionOpSeq !== opId) return;
      await this.commitSession(
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
  };

  public handleUnauthorized = async (evictedToken?: string): Promise<void> => {
    // Si le 401 concerne un ancien token différent du token actuellement en session, ignorer
    if (evictedToken && this.session.token && this.session.token !== evictedToken) {
      return;
    }
    const opId = ++this.sessionOpSeq;
    await clearSession(opId);
    if (this.sessionOpSeq === opId) {
      cartStore.reset();
      dbService.setActiveBuyerId(null);
      this.session = {
        status: 'unauthenticated',
        user: null,
        token: null,
        error: null,
      };
      this.notify();
    }
  };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuthProviderState(): AuthContextType {
  const coordinatorRef = useRef<AuthSessionCoordinator | null>(null);
  if (!coordinatorRef.current) {
    coordinatorRef.current = new AuthSessionCoordinator();
  }
  const coordinator = coordinatorRef.current;

  const session = useSyncExternalStore(coordinator.subscribe, coordinator.getState);

  useEffect(() => {
    setUnauthorizedHandler((token) => {
      coordinator.handleUnauthorized(token);
    });

    coordinator.restoreSession();

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [coordinator]);

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
    sessionSeq: coordinator.getSessionOpSeq(),
    serverError,
    storageError,
    restoreSession: coordinator.restoreSession,
    refreshUser: coordinator.refreshUser,
    signIn: coordinator.signIn,
    completeOtp: coordinator.completeOtp,
    signOut: coordinator.signOut,
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
