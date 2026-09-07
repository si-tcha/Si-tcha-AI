import { Platform } from 'react-native';
import { AlertPreferences, OrderType } from './database.shared';

// Safe dynamic require pour expo-secure-store (non supporté hors environnement natif/Expo)
let SecureStore: typeof import('expo-secure-store') | null = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    SecureStore = require('expo-secure-store');
  } catch {
    // Non disponible dans cet environnement
  }
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type CanonicalRole = 'seller' | 'buyer' | 'admin';
export type CanonicalStatus = 'active' | 'pending' | 'rejected';

export interface UserProfile {
  id: string;
  role: CanonicalRole;
  name: string;
  phone: string;
  status: CanonicalStatus;
  statut?: string; // backend agriculteur: 'EN_ATTENTE' | 'APPROUVE' | 'REJETE'
  phoneVerified: boolean;
  gicId?: string;
  buyerId?: string;
  gicRole?: 'leader' | 'member';
  estLeader?: boolean;
}

export interface SessionResponse {
  token?: string;
  user?: UserProfile;
  message?: string;
  requireOtp?: boolean;
  phone?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class ApiError extends Error {
  status: number;
  payload?: any;
  requireOtp?: boolean;

  constructor(message: string, status: number, payload?: any, requireOtp?: boolean) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
    this.requireOtp = requireOtp;
  }
}

/**
 * Détermine si une erreur correspond à une absence de connectivité réseau.
 */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof ApiError && error.status === 0) return true;
  if (
    error instanceof TypeError &&
    (error.message.includes('fetch') ||
      error.message.includes('Network') ||
      error.message.includes('network') ||
      error.message.includes('Failed to fetch'))
  ) {
    return true;
  }
  const msg = String((error as any)?.message || error);
  return (
    msg.includes('Network request failed') ||
    msg.includes('Failed to fetch') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('Pas de connexion réseau')
  );
}

/**
 * Résout l'URL de l'API avec port 4000 par défaut en développement.
 */
export function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/+$/, '');
  }

  const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
  if (!isDev) {
    throw new Error(
      'Configuration manquante: EXPO_PUBLIC_API_URL doit être définie en environnement de production / preview.'
    );
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4000/api';
  }
  return 'http://localhost:4000/api';
}

// ─── Persistance Atomique et Versionnée de Session ──────────────────────────

export const SESSION_KEY = 'sitcha_session_v1';

export interface StoredSessionV1 {
  version: 1;
  token: string;
  user: UserProfile;
}

export function isValidStoredSession(data: any): data is StoredSessionV1 {
  return (
    data &&
    typeof data === 'object' &&
    data.version === 1 &&
    typeof data.token === 'string' &&
    data.token.trim().length > 0 &&
    data.user &&
    typeof data.user === 'object' &&
    typeof data.user.id === 'string' &&
    (data.user.role === 'buyer' || data.user.role === 'seller' || data.user.role === 'admin')
  );
}

let memorySession: StoredSessionV1 | null = null;

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

const LEGACY_STORAGE_KEYS = [
  'sitcha_api_token',
  'sitcha_user_role',
  'sitcha_user_profile',
  'si_tcha_token',
  'si_tcha_user_role',
  'si_tcha_user',
];

/**
 * Lit la session persistée. Si absente, tente de migrer les anciennes clés une fois.
 * Si les données sont corrompues, les supprime proprement et retourne null.
 */
export async function readStoredSession(): Promise<StoredSessionV1 | null> {
  if (memorySession) return memorySession;

  let rawSession: string | null = null;

  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        rawSession = localStorage.getItem(SESSION_KEY);
      }
    } else if (SecureStore) {
      rawSession = await SecureStore.getItemAsync(SESSION_KEY);
    }
  } catch (err) {
    console.warn('Erreur lecture stockage session:', err);
    return null;
  }

  // 1. Session versionnée existante
  if (rawSession) {
    try {
      const parsed = JSON.parse(rawSession);
      if (isValidStoredSession(parsed)) {
        memorySession = parsed;
        return memorySession;
      }
    } catch {
      // JSON corrompu
    }
    // Nettoyage en cas de corruption
    await clearSession();
    return null;
  }

  // 2. Migration des anciennes clés si sitcha_session_v1 n'existe pas encore
  try {
    let legacyToken: string | null = null;
    let legacyUserRaw: string | null = null;

    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        legacyToken = localStorage.getItem('sitcha_api_token') || localStorage.getItem('si_tcha_token');
        legacyUserRaw = localStorage.getItem('sitcha_user_profile') || localStorage.getItem('si_tcha_user');
      }
    } else if (SecureStore) {
      legacyToken =
        (await SecureStore.getItemAsync('sitcha_api_token')) ||
        (await SecureStore.getItemAsync('si_tcha_token'));
      legacyUserRaw =
        (await SecureStore.getItemAsync('sitcha_user_profile')) ||
        (await SecureStore.getItemAsync('si_tcha_user'));
    }

    if (legacyToken && legacyUserRaw) {
      const parsedUser = JSON.parse(legacyUserRaw);
      if (parsedUser && typeof parsedUser.id === 'string' && parsedUser.role) {
        const migrated: StoredSessionV1 = {
          version: 1,
          token: legacyToken,
          user: parsedUser,
        };
        // Persister la session migrée
        await saveSession(migrated.token, migrated.user);

        // Nettoyer les anciennes clés
        if (Platform.OS === 'web') {
          if (typeof localStorage !== 'undefined') {
            for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key);
          }
        } else if (SecureStore) {
          for (const key of LEGACY_STORAGE_KEYS) {
            try {
              await SecureStore.deleteItemAsync(key);
            } catch {}
          }
        }

        return memorySession;
      }
    }
  } catch {
    // Échec silencieux de migration
  }

  return null;
}

export async function readToken(): Promise<string | null> {
  const session = await readStoredSession();
  return session ? session.token : null;
}

export async function readRole(): Promise<CanonicalRole | null> {
  const session = await readStoredSession();
  return session ? session.user.role : null;
}

export async function readStoredUser(): Promise<UserProfile | null> {
  const session = await readStoredSession();
  return session ? session.user : null;
}

/**
 * Enregistre la session de manière atomique.
 * Ne met à jour l'état mémoire qu'après succès de la persistance.
 * Ne masque pas les erreurs de SecureStore.
 */
export async function saveSession(token: string, user: UserProfile): Promise<void> {
  if (!token || !user) {
    throw new Error('Données de session incomplètes.');
  }

  const sessionData: StoredSessionV1 = {
    version: 1,
    token,
    user,
  };
  const serialized = JSON.stringify(sessionData);

  // 1. Écriture dans le stockage persistant
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SESSION_KEY, serialized);
    }
  } else if (SecureStore) {
    // L'erreur doit se propager si SecureStore échoue
    await SecureStore.setItemAsync(SESSION_KEY, serialized);
  }

  // 2. Mise à jour de l'état mémoire après persistance réussie
  memorySession = sessionData;
}

/**
 * Supprime la session locale et l'état en mémoire.
 */
export async function clearSession(): Promise<void> {
  memorySession = null;

  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(SESSION_KEY);
        for (const key of LEGACY_STORAGE_KEYS) {
          localStorage.removeItem(key);
        }
      } catch (err) {
        console.warn('Erreur localStorage clearSession:', err);
      }
    }
  } else if (SecureStore) {
    try {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    } catch (err) {
      console.warn('Erreur SecureStore clearSession:', err);
    }
    for (const key of LEGACY_STORAGE_KEYS) {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {}
    }
  }
}

// Aliases pour rétrocompatibilité
export const clearToken = clearSession;
export const clearRole = clearSession;

export async function request<T>(path: string, method: HttpMethod = 'GET', body?: unknown): Promise<T> {
  const token = await readToken();
  const baseUrl = getApiBaseUrl();
  let response: Response;

  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Bypass-Tunnel-Reminder': 'true',
        'localtunnel-warning': 'ignore',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Pas de connexion réseau. Vérifiez votre connexion Internet et réessayez.', 0);
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      payload?.message ||
      (Array.isArray(payload?.errors) ? payload.errors.map((e: any) => e.message || e).join(', ') : 'Erreur API SI-TCHA.');
    const requireOtp = Boolean(payload?.requireOtp);

    // Sur 401 sur route protégée : invalider la session immédiatement
    if (response.status === 401) {
      await clearSession();
      if (unauthorizedHandler) {
        unauthorizedHandler();
      }
    }
    // Sur 403 : ne PAS invalider le token ou déconnecter l'utilisateur

    throw new ApiError(message, response.status, payload, requireOtp);
  }

  return payload as T;
}

export const apiClient = {
  /**
   * Health check centralisé vers GET /api/health
   */
  async health(): Promise<boolean> {
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/health`, { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  },

  // Login : téléphone + PIN, rôle facultatif
  async login(phone: string, pin: string, role?: 'buyer' | 'seller'): Promise<SessionResponse> {
    const session = await request<SessionResponse>('/auth/login', 'POST', { phone, pin, role });
    if (session.token && session.user) {
      await saveSession(session.token, session.user);
    }
    return session;
  },

  // Verify OTP : rôle obligatoire (strictement aligné avec le backend)
  async verifyOtp(phone: string, code: string, role: 'buyer' | 'seller'): Promise<SessionResponse> {
    const session = await request<SessionResponse>('/auth/verify-otp', 'POST', { phone, code, role });
    if (session.token && session.user) {
      await saveSession(session.token, session.user);
    }
    return session;
  },

  async resendOtp(input: { phone: string; role: 'buyer' | 'seller' }): Promise<SessionResponse> {
    return request<SessionResponse>('/auth/resend-otp', 'POST', input);
  },

  async registerBuyer(input: { companyName: string; phone: string; pin: string; address?: string }): Promise<SessionResponse> {
    return request<SessionResponse>('/auth/register/buyer', 'POST', input);
  },

  async registerSeller(input: { fullName: string; phone: string; pin: string; gicName: string }): Promise<SessionResponse> {
    return request<SessionResponse>('/auth/register/seller', 'POST', input);
  },

  async getMe(): Promise<{ user: UserProfile }> {
    const res = await request<{ user: UserProfile }>('/auth/me', 'GET');
    if (res.user) {
      const token = await readToken();
      if (token) {
        await saveSession(token, res.user);
      }
    }
    return res;
  },

  async logout(): Promise<{ message: string }> {
    try {
      return await request<{ message: string }>('/auth/logout', 'POST');
    } catch {
      return { message: 'Déconnexion locale effectuée.' };
    } finally {
      await clearSession();
    }
  },

  getProducts: (page = 1, limit = 20) => request<{ products: unknown[]; meta: PaginationMeta }>(`/catalog/products?page=${page}&limit=${limit}`),
  getPublicGics: (page = 1, limit = 20) => request<{ gics: unknown[]; meta: PaginationMeta }>(`/gics/public?page=${page}&limit=${limit}`),
  getTerrain: () => request<{ weather: unknown[]; market: unknown[]; phytoAlerts: unknown[]; programs: unknown[] }>('/terrain'),
  getGicProfile: () => request<{ profile: unknown; members: unknown[]; needs: unknown[] }>('/gic/profile'),
  getHarvests: (page = 1, limit = 20) => request<{ harvests: unknown[]; meta: PaginationMeta }>(`/gic/harvests?page=${page}&limit=${limit}`),
  addHarvest: (product: string, volume: number) => request<{ harvest: unknown }>('/gic/harvests', 'POST', { product, volume }),
  getExpenses: (page = 1, limit = 20) => request<{ expenses: unknown[]; meta: PaginationMeta }>(`/gic/expenses?page=${page}&limit=${limit}`),
  addExpense: (label: string, amount: number, category: string) =>
    request<{ expense: unknown }>('/gic/expenses', 'POST', { label, amount, category }),
  addGicNeed: (need: { id: string; category: string; description: string; updatedAt?: string; authorRole?: string }) =>
    request<{ need: unknown }>('/gic/needs', 'POST', need),
  createOrder: (type: OrderType, items: { productId: string; quantity: number }[]) =>
    request<{ orders: unknown[] }>('/buyer/orders', 'POST', { type, items }),
  getOrders: (page = 1, limit = 20) => request<{ orders: unknown[]; meta: PaginationMeta }>(`/buyer/orders?page=${page}&limit=${limit}`),
  getGicOrders: (page = 1, limit = 20) => request<{ orders: unknown[]; meta: PaginationMeta }>(`/gic/orders?page=${page}&limit=${limit}`),
  getAlertPreferences: () => request<{ preferences: AlertPreferences }>('/buyer/alert-preferences'),
  saveAlertPreferences: (preferences: AlertPreferences) =>
    request<{ preferences: AlertPreferences }>('/buyer/alert-preferences', 'PUT', preferences),
  askAgronomist: (crop: string, category: string, question: string) =>
    request<{ answer: string }>('/gic/agronomist', 'POST', { crop, category, question }),

  // B2B Marketplace
  getB2BOffers: () => request<{ offers: unknown[] }>('/b2b/offers'),
  createB2BOffer: (data: { title: string; type: string; category: string; priceOrExchange: string; gicName: string; location: string; contact: string }) =>
    request<{ offer: unknown }>('/b2b/offers', 'POST', data),

  // Parcelles / Journal de croissance
  getParcels: () => request<{ parcels: unknown[] }>('/gic/parcels'),
  createParcel: (data: { parcelName: string; crop: string; sowingDate: string; stage: string; estimatedHarvestDate: string; estimatedVolumeKg: number; actualHarvestVolumeKg?: number }) =>
    request<{ parcel: unknown }>('/gic/parcels', 'POST', data),

  // Préfinancement
  getPrefinancingDeals: () => request<{ deals: unknown[] }>('/prefinancing/deals'),
  createPrefinancingDeal: (data: { gicName: string; buyerName: string; amountFcfa: number; inputDescription: string; reservedProduct: string; reservedVolumeKg: number }) =>
    request<{ deal: unknown }>('/prefinancing/deals', 'POST', data),

  // Trust Ratings
  getTrustRatings: () => request<{ ratings: unknown[] }>('/trust/ratings'),
  createTrustRating: (data: { targetId: string; targetType: string; rating: number; comment: string; authorName: string }) =>
    request<{ rating: unknown }>('/trust/ratings', 'POST', data),
};
