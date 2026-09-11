/** Types et seeds partagés — offline mock MVP Lots A+B */

export interface HarvestRecord {
  id: string;
  product: string;
  volume: number;
  date: string;
  synced?: boolean;
  updatedAt?: string;
  authorRole?: 'leader' | 'member';
}

export interface ExpenseRecord {
  id: string;
  label: string;
  amount: number;
  category: string;
  synced?: boolean;
  updatedAt?: string;
  authorRole?: 'leader' | 'member';
}

export interface CartItemRecord {
  id: string;
  productId: string;
  name: string;
  price: string;
  unit: string;
  quantity: number;
  buyerId?: string;
  synced?: boolean;
}

export interface GicProfile {
  id: string;
  name: string;
  identifiantREF: string;
  bassin: string;
  statutLegalisation: string;
  activitesPrincipales: string;
  leaderName: string;
  reglementInterieur: string;
  surfaceHa: number;
  updatedAt: string;
  authorRole: 'leader' | 'member';
}

export interface GicMember {
  id: string;
  name: string;
  phone: string;
  isLeader: boolean;
  updatedAt: string;
}

export interface GicNeed {
  id: string;
  category: string;
  description: string;
  updatedAt: string;
  authorRole: 'leader' | 'member';
}

export interface WeatherRecord {
  id: string;
  bassin: string;
  temperature: number;
  pluviometrie: number;
  humidity?: number;
  description?: string;
  date: string;
  icon?: string;
}

export interface MarketPriceRecord {
  id: string;
  product: string;
  bassin: string;
  prixMoyen: number;
  rentabilite: number;
  date: string;
}

export interface PhytoAlertRecord {
  id: string;
  bassin: string;
  ravageurMaladie: string;
  protocoleUrgence: string;
  dateEmission: string;
}

export interface AgriProgramRecord {
  id: string;
  nom: string;
  description: string;
  criteresEligibilite: string;
  dateLimite: string;
}

export interface ProductOffer {
  id: string;
  name: string;
  category: string;
  gicId: string;
  gicName: string;
  gicRef: string;
  price: string;
  unit: string;
  emoji: string;
  imageUrl?: string;
  bassin: string;
  maturite: string;
  volumeDisponible: number;
  dateDispo: string;
}

export interface ConfidentialGic {
  id: string;
  name: string;
  identifiantREF: string;
  emoji: string;
  logoUrl?: string;
  bassin: string;
  needs?: GicNeed[];
}

export type OrderType = 'commande_ferme' | 'achat_direct' | 'reservation';
export type OrderStatus = 'en_attente' | 'confirmee' | 'livree' | 'annulee';

export interface OrderRecord {
  id: string;
  type: OrderType;
  status: OrderStatus;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  price: string;
  gicName: string;
  createdAt: string;
  buyerId?: string;
  gicId?: string;
  synced?: boolean;
}

export interface AlertPreferences {
  productNames: string[];
  bassins: string[];
}

export interface SyncResult {
  mergedCount: number;
  conflictsResolvedByLeader: number;
  lastSyncAt: string;
  summary: string;
}

export const STORAGE_KEYS = {
  HARVESTS: 'sitcha_harvests_db',
  EXPENSES: 'sitcha_expenses_db',
  CART: 'sitcha_cart_db',
  GIC_PROFILE: 'sitcha_gic_profile',
  GIC_MEMBERS: 'sitcha_gic_members',
  GIC_NEEDS: 'sitcha_gic_needs',
  WEATHER: 'sitcha_weather',
  MARKET: 'sitcha_market',
  PHYTO: 'sitcha_phyto',
  PROGRAMS: 'sitcha_programs',
  PRODUCTS: 'sitcha_products',
  GICS_PUBLIC: 'sitcha_gics_public',
  ORDERS: 'sitcha_orders',
  ALERT_PREFS: 'sitcha_alert_prefs',
  SYNC_PEER: 'sitcha_sync_peer_mock',
  LAST_SYNC: 'sitcha_last_sync',
  LOCAL_ROLE: 'sitcha_local_role',
  AGRONOMIST_QUESTIONS: 'sitcha_agronomist_questions',
  B2B_OFFERS: 'sitcha_b2b_offers',
  PARCELS: 'sitcha_parcels',
  PREFINANCING: 'sitcha_prefinancing',
  TRUST_RATINGS: 'sitcha_trust_ratings',
  CART_CLIENT_REQUEST_ID: 'sitcha_cart_client_request_id',
} as const;

export function getBuyerCartKey(buyerId?: string | null): string {
  if (!buyerId || typeof buyerId !== 'string' || !buyerId.trim()) {
    throw new Error('Un buyerId actif valide est obligatoire pour accéder au panier privé.');
  }
  return `sitcha_buyer_cart_${buyerId.trim()}`;
}

export function getBuyerOrdersKey(buyerId?: string | null): string {
  if (!buyerId || typeof buyerId !== 'string' || !buyerId.trim()) {
    throw new Error('Un buyerId actif valide est obligatoire pour accéder aux commandes privées.');
  }
  return `sitcha_buyer_orders_${buyerId.trim()}`;
}

export function getBuyerClientRequestIdKey(buyerId?: string | null): string {
  if (!buyerId || typeof buyerId !== 'string' || !buyerId.trim()) {
    throw new Error('Un buyerId actif valide est obligatoire pour accéder à la clé d\'idempotence.');
  }
  return `sitcha_cart_client_request_id_${buyerId.trim()}`;
}

export function getBuyerAlertPrefsKey(buyerId?: string | null): string {
  if (!buyerId || typeof buyerId !== 'string' || !buyerId.trim()) {
    throw new Error('Un buyerId actif valide est obligatoire pour accéder aux préférences d\'alertes.');
  }
  return `sitcha_alert_prefs_${buyerId.trim()}`;
}

export const DEFAULT_HARVESTS: HarvestRecord[] = [];

export const DEFAULT_EXPENSES: ExpenseRecord[] = [];

export const DEFAULT_CART: CartItemRecord[] = [];

export const DEFAULT_GIC_PROFILE: GicProfile = {
  id: 'gic-1',
  name: 'GIC Agro-Vallée Bafoussam',
  identifiantREF: 'GIC-OUEST-2024-014',
  bassin: 'Ouest',
  statutLegalisation: 'Légalisé',
  activitesPrincipales: 'Maraîchage, maïs et tubercules',
  leaderName: 'Paul Nguema (Leader GIC)',
  reglementInterieur: 'Gestion communautaire des stocks et vente groupée des récoltes certifiées MINADER.',
  surfaceHa: 12.5,
  updatedAt: new Date().toISOString(),
  authorRole: 'leader',
};

export const DEFAULT_GIC_MEMBERS: GicMember[] = [
  { id: 'm1', name: 'Paul Nguema', phone: '+237 690 00 00 01', isLeader: true, updatedAt: new Date().toISOString() },
  { id: 'm2', name: 'Jeanne Kamga', phone: '+237 699 12 34 56', isLeader: false, updatedAt: new Date().toISOString() },
  { id: 'm3', name: 'Michel Fotso', phone: '+237 677 88 99 00', isLeader: false, updatedAt: new Date().toISOString() },
];

export const DEFAULT_GIC_NEEDS: GicNeed[] = [];

export const DEFAULT_WEATHER: WeatherRecord[] = [];

export const DEFAULT_MARKET: MarketPriceRecord[] = [];

export const DEFAULT_PHYTO: PhytoAlertRecord[] = [];

export const DEFAULT_PROGRAMS: AgriProgramRecord[] = [];

export const DEFAULT_PRODUCTS: ProductOffer[] = [];

export const DEFAULT_GICS_PUBLIC: ConfidentialGic[] = [];

export const DEFAULT_ALERT_PREFS: AlertPreferences = {
  productNames: [],
  bassins: [],
};

/** Peer mock pour sync Xender : initialisé vide */
export const DEFAULT_SYNC_PEER = {
  expenses: [] as ExpenseRecord[],
  harvests: [] as HarvestRecord[],
  needs: [] as GicNeed[],
};

export interface AgronomistQuestion {
  id: string;
  crop: string;
  category: string;
  question: string;
  photoUrl?: string;
  status: 'en_attente' | 'repondu';
  answer?: string;
  createdAt: string;
  synced: boolean;
}

export interface B2BOffer {
  id: string;
  title: string;
  type: 'rent' | 'barter';
  category: string;
  priceOrExchange: string;
  gicName: string;
  location: string;
  contact: string;
  createdAt: string;
}

export const DEFAULT_AGRONOMIST_QUESTIONS: AgronomistQuestion[] = [];

export const DEFAULT_B2B_OFFERS: B2BOffer[] = [];

export interface ParcelGrowthRecord {
  id: string;
  parcelName: string;
  crop: string;
  sowingDate: string;
  stage: 'Semis' | 'Levée' | 'Floraison' | 'Maturation' | 'Prêt à récolter';
  estimatedHarvestDate: string;
  estimatedVolumeKg: number;
  actualHarvestVolumeKg?: number;
  updatedAt: string;
}

export interface PrefinancingDeal {
  id: string;
  gicName: string;
  buyerName: string;
  amountFcfa: number;
  inputDescription: string;
  reservedProduct: string;
  reservedVolumeKg: number;
  status: 'propose' | 'accepte' | 'livre';
  createdAt: string;
}

export interface TrustRating {
  id: string;
  targetId: string;
  targetType: 'gic' | 'buyer';
  rating: number; // 1 to 5
  comment: string;
  authorName: string;
  createdAt: string;
}

export const DEFAULT_PARCELS: ParcelGrowthRecord[] = [];

export const DEFAULT_PREFINANCING: PrefinancingDeal[] = [];

export const DEFAULT_TRUST_RATINGS: TrustRating[] = [];

export function nowIso() {
  return new Date().toISOString();
}
