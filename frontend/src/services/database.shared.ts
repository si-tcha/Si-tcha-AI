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
  date: string;
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
} as const;

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

export const DEFAULT_PRODUCTS: ProductOffer[] = [
  {
    id: 'p1',
    name: 'Tomates fraîches',
    category: 'Légumes',
    gicId: 'g1',
    gicName: 'GIC Champs Verts',
    gicRef: 'GIC-CEN-011',
    price: '480',
    unit: 'kg',
    emoji: '🍅',
    imageUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop',
    bassin: 'Centre',
    maturite: 'Mature',
    volumeDisponible: 2400,
    dateDispo: '2026-07-25',
  },
  {
    id: 'p2',
    name: 'Maïs jaune',
    category: 'Céréales',
    gicId: 'g2',
    gicName: 'GIC Agro-Vallée Bafoussam',
    gicRef: 'GIC-OUEST-2024-014',
    price: '350',
    unit: 'kg',
    emoji: '🌽',
    imageUrl: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=600&auto=format&fit=crop',
    bassin: 'Ouest',
    maturite: 'En maturation',
    volumeDisponible: 5000,
    dateDispo: '2026-08-10',
  },
  {
    id: 'p3',
    name: 'Manioc frais',
    category: 'Tubercules',
    gicId: 'g3',
    gicName: 'GIC Récoltes du Nord',
    gicRef: 'GIC-NORD-008',
    price: '200',
    unit: 'kg',
    emoji: '🥔',
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&auto=format&fit=crop',
    bassin: 'Nord',
    maturite: 'Mature',
    volumeDisponible: 3200,
    dateDispo: '2026-07-28',
  },
  {
    id: 'p4',
    name: 'Régimes de Plantains',
    category: 'Fruits',
    gicId: 'g4',
    gicName: 'GIC Producteurs Centre',
    gicRef: 'GIC-CEN-022',
    price: '1500',
    unit: 'régime',
    emoji: '🍌',
    imageUrl: 'https://images.unsplash.com/photo-1528825871115-3581a5387919?w=600&auto=format&fit=crop',
    bassin: 'Centre',
    maturite: 'Précoce',
    volumeDisponible: 450,
    dateDispo: '2026-08-05',
  },
  {
    id: 'p5',
    name: 'Ananas',
    category: 'Fruits',
    gicId: 'g2',
    gicName: 'GIC Agro-Vallée Bafoussam',
    gicRef: 'GIC-OUEST-2024-014',
    price: '600',
    unit: 'kg',
    emoji: '🍍',
    imageUrl: 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=600&auto=format&fit=crop',
    bassin: 'Ouest',
    maturite: 'Mature',
    volumeDisponible: 1200,
    dateDispo: '2026-07-26',
  },
];

export const DEFAULT_GICS_PUBLIC: ConfidentialGic[] = [
  {
    id: 'g1',
    name: 'GIC Champs Verts',
    identifiantREF: 'GIC-CEN-011',
    emoji: '🌿',
    logoUrl: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=200',
    bassin: 'Centre',
  },
  {
    id: 'g2',
    name: 'GIC Agro-Vallée Bafoussam',
    identifiantREF: 'GIC-OUEST-2024-014',
    emoji: '🌿',
    logoUrl: 'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?w=200',
    bassin: 'Ouest',
  },
  {
    id: 'g3',
    name: 'GIC Récoltes du Nord',
    identifiantREF: 'GIC-NORD-008',
    emoji: '🌿',
    logoUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=200',
    bassin: 'Nord',
  },
  {
    id: 'g4',
    name: 'GIC Producteurs Centre',
    identifiantREF: 'GIC-CEN-022',
    emoji: '🌿',
    logoUrl: 'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=200',
    bassin: 'Centre',
  },
];

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
