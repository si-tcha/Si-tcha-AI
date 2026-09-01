import { Platform } from 'react-native';
import { AlertPreferences, OrderType } from './database.shared';

type HttpMethod = 'GET' | 'POST' | 'PUT';

interface SessionResponse {
  token: string;
  user: {
    id: string;
    role: 'seller' | 'buyer';
    name: string;
    phone: string;
    status: 'active' | 'pending';
    buyerId?: string;
    gicId?: string;
    gicRole?: 'leader' | 'member';
  };
}

const defaultApiUrl = Platform.select({
  android: 'http://172.20.10.3:4000/api',
  ios: 'http://localhost:4000/api',
  default: 'http://localhost:4000/api',
});

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? defaultApiUrl;
const TOKEN_KEY = 'sitcha_api_token';

let memoryToken: string | null = null;

function readToken() {
  if (memoryToken) return memoryToken;
  if (typeof localStorage !== 'undefined') {
    memoryToken = localStorage.getItem(TOKEN_KEY);
  }
  return memoryToken;
}

function saveToken(token: string) {
  memoryToken = token;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

async function request<T>(path: string, method: HttpMethod = 'GET', body?: unknown): Promise<T> {
  const token = readToken();
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
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
  async login(phone: string, role?: 'seller' | 'buyer') {
    const session = await request<SessionResponse>('/auth/login', 'POST', { phone, role });
    saveToken(session.token);
    return session;
  },

  async registerBuyer(input: { companyName: string; phone: string; regNumber: string }) {
    const session = await request<SessionResponse>('/auth/register/buyer', 'POST', input);
    saveToken(session.token);
    return session;
  },

  async registerSeller(input: { fullName: string; phone: string; gicName: string }) {
    const session = await request<SessionResponse>('/auth/register/seller', 'POST', input);
    saveToken(session.token);
    return session;
  },

  getProducts: () => request<{ products: unknown[] }>('/catalog/products'),
  getPublicGics: () => request<{ gics: unknown[] }>('/gics/public'),
  getTerrain: () => request<{ weather: unknown[]; market: unknown[]; phytoAlerts: unknown[]; programs: unknown[] }>('/terrain'),
  getGicProfile: () => request<{ profile: unknown; members: unknown[]; needs: unknown[] }>('/gic/profile'),
  getHarvests: () => request<{ harvests: unknown[] }>('/gic/harvests'),
  addHarvest: (product: string, volume: number) => request<{ harvest: unknown }>('/gic/harvests', 'POST', { product, volume }),
  getExpenses: () => request<{ expenses: unknown[] }>('/gic/expenses'),
  addExpense: (label: string, amount: number, category: string) =>
    request<{ expense: unknown }>('/gic/expenses', 'POST', { label, amount, category }),
  createOrder: (type: OrderType, items: Array<{ productId: string; quantity: number }>) =>
    request<{ orders: unknown[] }>('/buyer/orders', 'POST', { type, items }),
  getOrders: () => request<{ orders: unknown[] }>('/buyer/orders'),
  getAlertPreferences: () => request<{ preferences: AlertPreferences }>('/buyer/alert-preferences'),
  saveAlertPreferences: (preferences: AlertPreferences) =>
    request<{ preferences: AlertPreferences }>('/buyer/alert-preferences', 'PUT', preferences),
};
