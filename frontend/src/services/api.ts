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
  obsolete?: boolean;
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

type UnauthorizedHandler = (evictedToken?: string, requestTicket?: number) => void;
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

let sessionMutationSeq = 0;
let sessionWriteQueue: Promise<any> = Promise.resolve();

/**
 * Alloue un ticket de mutation de session strictement croissant.
 * Constitue l'unique autorité monotone pour toute l'application.
 */
export function allocateSessionMutationTicket(): number {
  return ++sessionMutationSeq;
}

export function getSessionMutationSeq(): number {
  return sessionMutationSeq;
}

export function _resetSessionMutationSeqForTesting(initial = 0) {
  sessionMutationSeq = initial;
  sessionWriteQueue = Promise.resolve();
}

/**
 * Enregistre la session de manière atomique avec coordination latest-wins.
 * Ne met à jour l'état mémoire qu'après succès de la persistance.
 * Si une opération plus récente a débuté, l'écriture obsolète est ignorée et retourne false.
 */
export async function saveSession(
  token: string,
  user: UserProfile,
  explicitSeq?: number
): Promise<boolean> {
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

  const seq = explicitSeq !== undefined ? explicitSeq : allocateSessionMutationTicket();
  if (explicitSeq !== undefined && explicitSeq > sessionMutationSeq) {
    sessionMutationSeq = explicitSeq;
  }

  // Si une mutation de session plus récente a déjà débuté, rejeter immédiatement
  if (seq < sessionMutationSeq && explicitSeq !== undefined) {
    return false;
  }

  const serialized = JSON.stringify(sessionData);
  let saved = false;

  const runTask = async () => {
    // Vérification avant écriture dans la file sérialisée
    if (seq < sessionMutationSeq && explicitSeq !== undefined) {
      saved = false;
      return;
    }

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

    // Mise à jour de l'état mémoire UNIQUEMENT si toujours la version la plus récente
    if (seq >= sessionMutationSeq) {
      memorySession = sessionData;
      saved = true;
    }
  };

  const currentWrite = sessionWriteQueue.then(runTask, runTask);
  sessionWriteQueue = currentWrite.then(() => {}, () => {});
  await currentWrite;
  return saved;
}

/**
 * Supprime la session locale et l'état en mémoire avec coordination latest-wins.
 * Retourne false si la suppression a été ignorée car obsolète ou en cas d'échec de suppression persistante.
 */
export async function clearSession(explicitSeq?: number): Promise<boolean> {
  const seq = explicitSeq !== undefined ? explicitSeq : allocateSessionMutationTicket();
  if (explicitSeq !== undefined && explicitSeq > sessionMutationSeq) {
    sessionMutationSeq = explicitSeq;
  }

  if (seq < sessionMutationSeq && explicitSeq !== undefined) {
    return false;
  }

  let cleared = false;

  const runTask = async () => {
    if (seq < sessionMutationSeq && explicitSeq !== undefined) {
      cleared = false;
      return;
    }

    // 1. Suppression critique et stricte de SESSION_KEY (ne pas avaler l'erreur)
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined' || !localStorage) {
        throw new Error('Stockage persistant indisponible: localStorage non disponible.');
      }
      localStorage.removeItem(SESSION_KEY);
    } else {
      if (!SecureStore || typeof SecureStore.deleteItemAsync !== 'function') {
        throw new Error('Stockage persistant indisponible: SecureStore non disponible.');
      }
      await SecureStore.deleteItemAsync(SESSION_KEY);
    }

    // 2. Nettoyage best-effort des clés secondaires
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined' && localStorage) {
        for (const key of LEGACY_STORAGE_KEYS) {
          try {
            localStorage.removeItem(key);
          } catch {}
        }
      }
    } else if (SecureStore) {
      for (const key of LEGACY_STORAGE_KEYS) {
        try {
          await SecureStore.deleteItemAsync(key);
        } catch {}
      }
    }

    // 3. Mise à jour de memorySession UNIQUEMENT après succès de la persistance canonique
    if (seq >= sessionMutationSeq) {
      memorySession = null;
      cleared = true;
    }
  };

  const currentClear = sessionWriteQueue.then(runTask, runTask);
  sessionWriteQueue = currentClear.then(() => {}, () => {});

  try {
    await currentClear;
    return cleared;
  } catch (err) {
    // Échec critique lors de la suppression de SESSION_KEY :
    // memorySession n'a pas été écrasé pour éviter la divergence, et on retourne false
    return false;
  }
}

/**
 * Supprime atomiquement la session uniquement si le token actif correspond au token attendu
 * ET qu'aucune mutation de session plus récente n'a débuté (expectedTicket >= sessionMutationSeq).
 * La comparaison et l'effacement ont lieu dans la même opération sérialisée sans fenêtre de course.
 */
export async function clearSessionIfTokenMatches(
  expectedToken: string,
  expectedTicket?: number
): Promise<boolean> {
  let cleared = false;

  const runTask = async () => {
    // 1. Si un ticket a été alloué après cette requête, ignorer immédiatement l'invalidation obsolète
    if (expectedTicket !== undefined && expectedTicket < sessionMutationSeq) {
      cleared = false;
      return;
    }

    // 2. Lire le token actuel dans la tâche sérialisée
    const currentToken = memorySession?.token ?? (await readStoredSession())?.token;
    if (currentToken !== expectedToken) {
      cleared = false;
      return;
    }

    // Revérifier après lecture de session
    if (expectedTicket !== undefined && expectedTicket < sessionMutationSeq) {
      cleared = false;
      return;
    }

    // 3. Suppression critique et stricte de SESSION_KEY
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined' || !localStorage) {
        throw new Error('Stockage persistant indisponible: localStorage non disponible.');
      }
      localStorage.removeItem(SESSION_KEY);
    } else {
      if (!SecureStore || typeof SecureStore.deleteItemAsync !== 'function') {
        throw new Error('Stockage persistant indisponible: SecureStore non disponible.');
      }
      await SecureStore.deleteItemAsync(SESSION_KEY);
    }

    // 4. Nettoyage best-effort des clés secondaires
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined' && localStorage) {
        for (const key of LEGACY_STORAGE_KEYS) {
          try {
            localStorage.removeItem(key);
          } catch {}
        }
      }
    } else if (SecureStore) {
      for (const key of LEGACY_STORAGE_KEYS) {
        try {
          await SecureStore.deleteItemAsync(key);
        } catch {}
      }
    }

    // 5. Allouer une séquence et effacer la session en mémoire UNIQUEMENT après succès persistant
    allocateSessionMutationTicket();
    memorySession = null;
    cleared = true;
  };

  const currentClear = sessionWriteQueue.then(runTask, runTask);
  sessionWriteQueue = currentClear.then(() => {}, () => {});

  try {
    await currentClear;
    return cleared;
  } catch (err) {
    return false;
  }
}

// Aliases pour rétrocompatibilité
export const clearToken = clearSession;
export const clearRole = clearSession;

export async function request<T>(path: string, method: HttpMethod = 'GET', body?: unknown): Promise<T> {
  const token = await readToken();
  const requestTicket = getSessionMutationSeq();
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

    // Ne jamais déclencher d’invalidation globale sur 401 pour les routes d’authentification publique :
    // /auth/login, /auth/verify-otp, /auth/resend-otp, /auth/register
    // Un échec de tentative de connexion ne doit jamais déconnecter une session existante.
    const isPublicAuthEndpoint = /^\/?auth\/(login|verify-otp|resend-otp|register)(\/|\?|$)/.test(path);

    // Sur 401 sur route protégée :
    // Invalider la session UNIQUEMENT si le token utilisé par cette requête est toujours le token de la session courante
    // ET qu'aucune mutation de session plus récente n'a commencé.
    if (response.status === 401 && token && !isPublicAuthEndpoint) {
      const cleared = await clearSessionIfTokenMatches(token, requestTicket);
      if (cleared && unauthorizedHandler) {
        unauthorizedHandler(token, requestTicket);
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

  // Login : téléphone + PIN, rôle facultatif (mutation de session gérée par la coordination latest-wins)
  async login(phone: string, pin: string, role?: 'buyer' | 'seller'): Promise<SessionResponse> {
    return request<SessionResponse>('/auth/login', 'POST', { phone, pin, role });
  },

  // Verify OTP : rôle obligatoire (mutation de session gérée par la coordination latest-wins)
  async verifyOtp(phone: string, code: string, role: 'buyer' | 'seller'): Promise<SessionResponse> {
    return request<SessionResponse>('/auth/verify-otp', 'POST', { phone, code, role });
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
    return request<{ user: UserProfile }>('/auth/me', 'GET');
  },

  async logout(): Promise<{ message: string }> {
    try {
      return await request<{ message: string }>('/auth/logout', 'POST');
    } catch {
      return { message: 'Déconnexion locale effectuée.' };
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
  createOrder: (
    type: OrderType,
    items: { productId: string; quantity: number }[],
    clientRequestId?: string
  ) =>
    request<{ orders: unknown[]; idempotentReplay?: boolean }>('/buyer/orders', 'POST', {
      type,
      items,
      ...(clientRequestId ? { clientRequestId } : {}),
    }),
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
