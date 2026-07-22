export type UserRole = 'seller' | 'buyer';
export type GicUserRole = 'leader' | 'member';

export interface UserAccount {
  id: string;
  role: UserRole;
  name: string;
  phone: string;
  token: string;
  createdAt: string;
  buyerId?: string;
  gicId?: string;
  gicRole?: GicUserRole;
  status: 'active' | 'pending';
}

export interface BuyerProfile {
  id: string;
  companyName: string;
  phone: string;
  regNumber: string;
  address?: string;
  alertPreferences: AlertPreferences;
  createdAt: string;
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
  logoUrl?: string;
  updatedAt: string;
}

export interface GicMember {
  id: string;
  gicId: string;
  name: string;
  phone: string;
  isLeader: boolean;
  updatedAt: string;
}

export interface GicNeed {
  id: string;
  gicId: string;
  category: string;
  description: string;
  updatedAt: string;
  authorRole: GicUserRole;
}

export interface HarvestRecord {
  id: string;
  gicId: string;
  product: string;
  volume: number;
  date: string;
  synced: boolean;
  updatedAt: string;
  authorRole: GicUserRole;
}

export interface ExpenseRecord {
  id: string;
  gicId: string;
  label: string;
  amount: number;
  category: string;
  synced: boolean;
  updatedAt: string;
  authorRole: GicUserRole;
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
  bassin: string;
  maturite: string;
  volumeDisponible: number;
  dateDispo: string;
  quantiteEstimee?: number;
  updatedAt: string;
}

export type OrderType = 'commande_ferme' | 'achat_direct' | 'reservation';
export type OrderStatus = 'en_attente' | 'confirmee' | 'livree' | 'annulee';

export interface OrderRecord {
  id: string;
  buyerId: string;
  type: OrderType;
  status: OrderStatus;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  price: string;
  gicId: string;
  gicName: string;
  createdAt: string;
}

export interface AlertPreferences {
  productNames: string[];
  bassins: string[];
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

export interface AppData {
  users: UserAccount[];
  buyers: BuyerProfile[];
  gics: GicProfile[];
  members: GicMember[];
  needs: GicNeed[];
  harvests: HarvestRecord[];
  expenses: ExpenseRecord[];
  products: ProductOffer[];
  orders: OrderRecord[];
  weather: WeatherRecord[];
  market: MarketPriceRecord[];
  phytoAlerts: PhytoAlertRecord[];
  programs: AgriProgramRecord[];
}
