import { Platform } from 'react-native';
let SecureStore: any;
if (Platform.OS !== 'web') {
  SecureStore = require('expo-secure-store');
}
import { AlertPreferences, OrderType } from './database.shared';

type HttpMethod = 'GET' | 'POST' | 'PUT';

export interface UserProfile {
  id: string;
  role: 'seller' | 'buyer';
  name: string;
  phone: string;
  status: 'active' | 'pending';
  buyerId?: string;
  gicId?: string;
  gicRole?: 'leader' | 'member';
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

// En production, utilise l'URL Render. En dev, utilise l'IP locale.
const PROD_API_URL = 'https://si-tcha-ai-mobile.onrender.com/api';

const devApiUrl = Platform.select({
  android: 'http://172.20.10.3:4000/api',
  ios: 'http://localhost:4000/api',
  default: 'http://localhost:4000/api',
});

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? PROD_API_URL;
const TOKEN_KEY = 'sitcha_api_token';

let memoryToken: string | null = null;

async function readToken(): Promise<string | null> {
  if (memoryToken) return memoryToken;
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      memoryToken = localStorage.getItem(TOKEN_KEY);
    }
  } else {
    try {
      memoryToken = await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {}
  }
  return memoryToken;
}

export async function readRole(): Promise<'buyer' | 'seller' | null> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('sitcha_user_role') as any;
    }
  } else {
    try {
      return (await SecureStore.getItemAsync('sitcha_user_role')) as any;
    } catch {}
  }
  return null;
}

async function saveRole(role: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sitcha_user_role', role);
    }
  } else {
    try {
      await SecureStore.setItemAsync('sitcha_user_role', role);
    } catch {}
  }
}

async function saveToken(token: string): Promise<void> {
  memoryToken = token;
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token);
    }
  } else {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch {}
  }
}

export async function clearToken(): Promise<void> {
  memoryToken = null;
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
    }
  } else {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {}
  }
}

export async function clearRole(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('sitcha_user_role');
    }
  } else {
    try {
      await SecureStore.deleteItemAsync('sitcha_user_role');
    } catch {}
  }
}

async function request<T>(path: string, method: HttpMethod = 'GET', body?: unknown): Promise<T> {
  const token = await readToken();
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message ?? 'Erreur API SI-TCHA.');
  }
  return payload as T;
}

export const apiClient = {
  // Login : téléphone + PIN, le backend auto-détecte le rôle
  async login(phone: string, pin: string, role?: 'buyer' | 'seller') {
    const session = await request<SessionResponse>('/auth/login', 'POST', { phone, pin, role });
    if (session.token) {
      await saveToken(session.token);
      if (session.user?.role) await saveRole(session.user.role);
    }
    return session;
  },

  async verifyOtp(phone: string, code: string, role?: 'buyer' | 'seller') {
    const session = await request<SessionResponse>('/auth/verify-otp', 'POST', { phone, code, role });
    if (session.token) {
      await saveToken(session.token);
      if (session.user?.role) await saveRole(session.user.role);
    }
    return session;
  },

  async registerBuyer(input: { companyName: string; phone: string; pin: string; address?: string }) {
    const session = await request<SessionResponse>('/auth/register/buyer', 'POST', input);
    if (session.token) {
      await saveToken(session.token);
      await saveRole('buyer');
    }
    return session;
  },

  async registerSeller(input: { fullName: string; phone: string; pin: string; gicName: string }) {
    const session = await request<SessionResponse>('/auth/register/seller', 'POST', input);
    if (session.token) {
      await saveToken(session.token);
      await saveRole('seller');
    }
    return session;
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
  createOrder: (type: OrderType, items: Array<{ productId: string; quantity: number }>) =>
    request<{ orders: unknown[] }>('/buyer/orders', 'POST', { type, items }),
  getOrders: (page = 1, limit = 20) => request<{ orders: unknown[]; meta: PaginationMeta }>(`/buyer/orders?page=${page}&limit=${limit}`),
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
