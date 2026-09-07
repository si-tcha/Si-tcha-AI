import { Platform } from 'react-native';
import { AlertPreferences, OrderType, ParcelGrowthRecord } from './database.shared';

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

// Safe dynamic require pour expo-device
let isPhysicalDevice = false;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Device = require('expo-device');
  isPhysicalDevice = Boolean(Device?.isDevice);
} catch {
  // Non disponible dans cet environnement
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
 * Résout l'URL de l'API selon l'environnement, la plateforme et le type d'appareil.
 */
export interface ApiUrlResolutionOptions {
  platform: string;
  isDevice?: boolean;
  envUrl?: string;
  isDev?: boolean;
}

export function computeNativePhysicalDevice(platform: string, isDevice: boolean): boolean {
  return (platform === 'android' || platform === 'ios') && isDevice === true;
}

export function resolveApiBaseUrl(options: ApiUrlResolutionOptions): string {
  const envUrl = options.envUrl?.trim();
  if (envUrl && envUrl.length > 0) {
    return envUrl.replace(/\/+$/, '');
  }

  const isDev = options.isDev !== undefined ? options.isDev : true;
  if (!isDev) {
    throw new Error(
      'Configuration manquante: EXPO_PUBLIC_API_URL doit être définie en environnement de production / preview.'
    );
  }

  // La notion d'appareil physique ne s'applique qu'à android et ios.
  // Sur le Web, expo-device renvoie toujours isDevice: true, mais l'environnement utilise localhost:4000 en développement.
  const isNativeMobile = options.platform === 'android' || options.platform === 'ios';
  if (isNativeMobile && options.isDevice) {
    throw new Error(
      "Configuration manquante: EXPO_PUBLIC_API_URL est obligatoire sur un appareil physique (les adresses localhost et 10.0.2.2 ne sont pas accessibles depuis un téléphone réel)."
    );
  }

  if (options.platform === 'android') {
    return 'http://10.0.2.2:4000/api';
  }

  return 'http://localhost:4000/api';
}

export function getApiBaseUrl(): string {
  const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
  const nativePhysicalDevice = computeNativePhysicalDevice(Platform.OS, isPhysicalDevice);

  return resolveApiBaseUrl({
    platform: Platform.OS,
    isDevice: nativePhysicalDevice,
    envUrl: process.env.EXPO_PUBLIC_API_URL,
    isDev,
  });
}

// ─── Persistance Atomique et Versionnée de Session ──────────────────────────

export const SESSION_KEY = 'sitcha_session_v1';

export interface StoredSessionV1 {
  version: 1;
  token: string;
  user: UserProfile;
}

export function isValidStoredSession(data: any): data is StoredSessionV1 {
  if (!data || typeof data !== 'object') return false;
  if (data.version !== 1) return false;
  if (typeof data.token !== 'string' || data.token.trim().length === 0) return false;

  const user = data.user;
  if (!user || typeof user !== 'object') return false;
  if (typeof user.id !== 'string' || user.id.trim().length === 0) return false;
  if (typeof user.phone !== 'string' || user.phone.trim().length === 0) return false;
  if (typeof user.name !== 'string') return false;
  if (user.role !== 'buyer' && user.role !== 'seller' && user.role !== 'admin') return false;
  if (user.status !== 'active' && user.status !== 'pending' && user.status !== 'rejected') return false;
  if (typeof user.phoneVerified !== 'boolean') return false;

  return true;
}

let memorySession: StoredSessionV1 | null = null;

export function _resetMemorySessionForTesting() {
  memorySession = null;
}

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
 * Ne masque pas les pannes réelles du stockage (disque / keychain / permissions).
 * Si les données sont corrompues, les supprime proprement et retourne null.
 */
export async function readStoredSession(): Promise<StoredSessionV1 | null> {
  if (memorySession) return memorySession;

  let rawSession: string | null = null;

  // Lecture dans le stockage persistant
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined' || !localStorage) {
      throw new Error('Stockage persistant indisponible: localStorage non disponible.');
    }
    rawSession = localStorage.getItem(SESSION_KEY);
  } else {
    if (!SecureStore || typeof SecureStore.getItemAsync !== 'function') {
      throw new Error('Stockage persistant indisponible: SecureStore non disponible.');
    }
    rawSession = await SecureStore.getItemAsync(SESSION_KEY);
  }

  // 1. Session versionnée existante
  if (rawSession) {
    let parsed: any;
    try {
      parsed = JSON.parse(rawSession);
    } catch {
      // Données JSON corrompues -> purge sécurisée
      await clearSession();
      return null;
    }

    if (isValidStoredSession(parsed)) {
      memorySession = parsed;
      return memorySession;
    }

    // Données incomplètes ou invalides -> purge sécurisée
    await clearSession();
    return null;
  }

  // 2. Migration des anciennes clés si sitcha_session_v1 n'existe pas encore
  let legacyToken: string | null = null;
  let legacyUserRaw: string | null = null;

  if (Platform.OS === 'web') {
    legacyToken = localStorage.getItem('sitcha_api_token') || localStorage.getItem('si_tcha_token');
    legacyUserRaw = localStorage.getItem('sitcha_user_profile') || localStorage.getItem('si_tcha_user');
  } else if (SecureStore) {
    legacyToken =
      (await SecureStore.getItemAsync('sitcha_api_token')) ||
      (await SecureStore.getItemAsync('si_tcha_token'));
    legacyUserRaw =
      (await SecureStore.getItemAsync('sitcha_user_profile')) ||
      (await SecureStore.getItemAsync('si_tcha_user'));
  }

  if (legacyToken && legacyUserRaw) {
    let parsedUser: any;
    try {
      parsedUser = JSON.parse(legacyUserRaw);
    } catch {
      return null;
    }

    const candidateSession: StoredSessionV1 = {
      version: 1,
      token: legacyToken,
      user: {
        id: parsedUser?.id,
        name: parsedUser?.name,
        phone: parsedUser?.phone,
        role: parsedUser?.role,
        status: parsedUser?.status,
        statut: parsedUser?.statut,
        phoneVerified: parsedUser?.phoneVerified,
        gicId: parsedUser?.gicId,
        buyerId: parsedUser?.buyerId,
        gicRole: parsedUser?.gicRole,
        estLeader: parsedUser?.estLeader,
      },
    };

    if (isValidStoredSession(candidateSession)) {
      await saveSession(candidateSession.token, candidateSession.user);

      // Nettoyer les anciennes clés après migration réussie
      if (Platform.OS === 'web') {
        for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key);
      } else if (SecureStore) {
        for (const key of LEGACY_STORAGE_KEYS) {
          try {
            await SecureStore.deleteItemAsync(key);
          } catch {}
        }
      }
      return memorySession;
    } else {
      // Session legacy invalide ou incomplète : nettoyer sans promouvoir et forcer une reconnexion
      if (Platform.OS === 'web') {
        for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key);
      } else if (SecureStore) {
        for (const key of LEGACY_STORAGE_KEYS) {
          try {
            await SecureStore.deleteItemAsync(key);
          } catch {}
        }
      }
      return null;
    }
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
 * Lève une erreur si le stockage n'est pas disponible ou si l'écriture échoue.
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

  if (!isValidStoredSession(sessionData)) {
    throw new Error('Données de session non conformes au schéma v1.');
  }

  const serialized = JSON.stringify(sessionData);

  // 1. Écriture dans le stockage persistant
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined' || !localStorage) {
      throw new Error('Stockage persistant indisponible: localStorage non disponible.');
    }
    localStorage.setItem(SESSION_KEY, serialized);
  } else {
    if (!SecureStore || typeof SecureStore.setItemAsync !== 'function') {
      throw new Error('Stockage persistant indisponible: SecureStore non disponible.');
    }
    await SecureStore.setItemAsync(SESSION_KEY, serialized);
  }

  // 2. Mise à jour de l'état mémoire UNIQUEMENT après persistance réussie
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
      payload?.error ||
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
  askAgronomist: async (crop: string, category: string, question: string) => {
    if (!question || !question.trim()) {
      throw new Error('La question ne peut pas être vide.');
    }
    if (question.length > 1000) {
      throw new Error('La question ne peut pas dépasser 1000 caractères.');
    }
    return request<{ answer: string; disclaimer?: string; question?: string; model?: string; timestamp?: string }>(
      '/gic/agronomist',
      'POST',
      { crop: crop?.trim() || 'Culture diverse', category: category?.trim() || 'Autre', question: question.trim() }
    );
  },

  // B2B Marketplace
  getB2BOffers: () => request<{ offers: unknown[] }>('/b2b/offers'),
  createB2BOffer: (data: { title: string; type: string; category: string; priceOrExchange: string; gicName: string; location: string; contact: string }) =>
    request<{ offer: unknown }>('/b2b/offers', 'POST', data),

  // Parcelles / Journal de croissance
  getParcels: () => request<{ parcels: ParcelGrowthRecord[] }>('/gic/parcels'),
  createParcel: (data: {
    parcelName: string;
    crop: string;
    sowingDate: string;
    stage?: string;
    estimatedHarvestDate: string;
    estimatedVolumeKg: number;
    actualHarvestVolumeKg?: number | null;
    actualHarvestDate?: string | null;
  }) => request<{ parcel: ParcelGrowthRecord }>('/gic/parcels', 'POST', data),
  updateParcel: (
    id: string,
    data: {
      parcelName?: string;
      crop?: string;
      sowingDate?: string;
      stage?: string;
      estimatedHarvestDate?: string;
      estimatedVolumeKg?: number;
      actualHarvestVolumeKg?: number | null;
      actualHarvestDate?: string | null;
    }
  ) => request<{ parcel: ParcelGrowthRecord }>(`/gic/parcels/${id}`, 'PUT', data),

  // Préfinancement
  getPrefinancingDeals: () => request<{ deals: unknown[] }>('/prefinancing/deals'),
  createPrefinancingDeal: (data: { gicName: string; buyerName: string; amountFcfa: number; inputDescription: string; reservedProduct: string; reservedVolumeKg: number }) =>
    request<{ deal: unknown }>('/prefinancing/deals', 'POST', data),

  // Trust Ratings
  getTrustRatings: () => request<{ ratings: unknown[] }>('/trust/ratings'),
  createTrustRating: (data: { targetId: string; targetType: string; rating: number; comment: string; authorName: string }) =>
    request<{ rating: unknown }>('/trust/ratings', 'POST', data),
};
