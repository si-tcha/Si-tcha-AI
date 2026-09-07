import { Platform } from 'react-native';
let SecureStore: any;
if (Platform.OS !== 'web') {
  try {
    SecureStore = require('expo-secure-store');
  } catch {
    // SecureStore non disponible (ex: environnement node/vitest)
  }
}
import { AlertPreferences, OrderType } from './database.shared';

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
    return 'http://10.0.2.2:5000/api';
  }
  return 'http://localhost:5000/api';
}

const TOKEN_KEY = 'sitcha_api_token';
const ROLE_KEY = 'sitcha_user_role';
const USER_KEY = 'sitcha_user_profile';

let memoryToken: string | null = null;
let memoryRole: CanonicalRole | null = null;
let memoryUser: UserProfile | null = null;

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

export async function readToken(): Promise<string | null> {
  if (memoryToken) return memoryToken;
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      memoryToken = localStorage.getItem(TOKEN_KEY);
    }
  } else if (SecureStore) {
    try {
      memoryToken = await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {}
  }
  return memoryToken;
}

export async function readRole(): Promise<CanonicalRole | null> {
  if (memoryRole) return memoryRole;
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      memoryRole = localStorage.getItem(ROLE_KEY) as CanonicalRole | null;
    }
  } else if (SecureStore) {
    try {
      memoryRole = (await SecureStore.getItemAsync(ROLE_KEY)) as CanonicalRole | null;
    } catch {}
  }
  return memoryRole;
}

export async function readStoredUser(): Promise<UserProfile | null> {
  if (memoryUser) return memoryUser;
  let raw: string | null = null;
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      raw = localStorage.getItem(USER_KEY);
    }
  } else if (SecureStore) {
    try {
      raw = await SecureStore.getItemAsync(USER_KEY);
    } catch {}
  }
  if (raw) {
    try {
      memoryUser = JSON.parse(raw);
      return memoryUser;
    } catch {}
  }
  return null;
}

export async function saveSession(token: string, user: UserProfile): Promise<void> {
  memoryToken = token;
  memoryRole = user.role;
  memoryUser = user;

  const rawUser = JSON.stringify(user);
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(ROLE_KEY, user.role);
      localStorage.setItem(USER_KEY, rawUser);
    }
  } else if (SecureStore) {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await SecureStore.setItemAsync(ROLE_KEY, user.role);
      await SecureStore.setItemAsync(USER_KEY, rawUser);
    } catch (e) {
      console.warn('Erreur SecureStore saveSession:', e);
    }
  }
}

export async function clearSession(): Promise<void> {
  memoryToken = null;
  memoryRole = null;
  memoryUser = null;

  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(ROLE_KEY);
      localStorage.removeItem(USER_KEY);
    }
  } else if (SecureStore) {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(ROLE_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
    } catch (e) {
      console.warn('Erreur SecureStore clearSession:', e);
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
  // Login : téléphone + PIN, le rôle peut être précisé
  async login(phone: string, pin: string, role?: 'buyer' | 'seller'): Promise<SessionResponse> {
    const session = await request<SessionResponse>('/auth/login', 'POST', { phone, pin, role });
    if (session.token && session.user) {
      await saveSession(session.token, session.user);
    }
    return session;
  },

  async verifyOtp(phone: string, code: string, role?: 'buyer' | 'seller'): Promise<SessionResponse> {
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
      memoryUser = res.user;
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
  createOrder: (type: OrderType, items: Array<{ productId: string; quantity: number }>) =>
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
