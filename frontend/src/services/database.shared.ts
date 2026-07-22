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
} as const;

export const DEFAULT_HARVESTS: HarvestRecord[] = [
  { id: '1', product: 'Pommes de terre', volume: 1200, date: '12 Juillet 2026', synced: true, updatedAt: '2026-07-12T10:00:00.000Z', authorRole: 'leader' },
  { id: '2', product: 'Tomates', volume: 800, date: '18 Juillet 2026', synced: true, updatedAt: '2026-07-18T10:00:00.000Z', authorRole: 'leader' },
];

export const DEFAULT_EXPENSES: ExpenseRecord[] = [
  { id: '1', label: 'Fertilisants NPK', amount: 150000, category: 'Intrants', synced: true, updatedAt: '2026-07-10T10:00:00.000Z', authorRole: 'leader' },
  { id: '2', label: 'Transport récolte', amount: 45000, category: 'Transport', synced: true, updatedAt: '2026-07-11T10:00:00.000Z', authorRole: 'member' },
  { id: '3', label: 'Main d\'œuvre semis', amount: 80000, category: 'Main d\'œuvre', synced: true, updatedAt: '2026-07-09T10:00:00.000Z', authorRole: 'leader' },
];

export const DEFAULT_CART: CartItemRecord[] = [];

export const DEFAULT_GIC_PROFILE: GicProfile = {
  id: 'gic-1',
  name: 'GIC Agro-Vallée Bafoussam',
  identifiantREF: 'GIC-OUEST-2024-014',
  bassin: 'Ouest',
  statutLegalisation: 'Légalisé',
  activitesPrincipales: 'Maraîchage, tubercules',
  leaderName: 'Jean Fotso',
  reglementInterieur: 'Assemblées mensuelles. Décisions à majorité. Leader tranche les conflits de données.',
  surfaceHa: 12,
  updatedAt: '2026-07-20T08:00:00.000Z',
  authorRole: 'leader',
};

export const DEFAULT_GIC_MEMBERS: GicMember[] = [
  { id: 'm1', name: 'Jean Fotso', phone: '+237 690 00 00 01', isLeader: true, updatedAt: '2026-07-01T08:00:00.000Z' },
  { id: 'm2', name: 'Marie Nguemo', phone: '+237 690 00 00 02', isLeader: false, updatedAt: '2026-07-01T08:00:00.000Z' },
  { id: 'm3', name: 'Paul Tchoumi', phone: '+237 690 00 00 03', isLeader: false, updatedAt: '2026-07-01T08:00:00.000Z' },
];

export const DEFAULT_GIC_NEEDS: GicNeed[] = [
  { id: 'n1', category: 'Intrants', description: 'NPK 20 sacs manquants pour saison', updatedAt: '2026-07-15T08:00:00.000Z', authorRole: 'leader' },
  { id: 'n2', category: 'Financement', description: 'Crédit campagne 2M FCFA', updatedAt: '2026-07-16T08:00:00.000Z', authorRole: 'leader' },
];

export const DEFAULT_WEATHER: WeatherRecord[] = [
  { id: 'w1', bassin: 'Ouest', temperature: 24.5, pluviometrie: 12, date: '2026-07-21' },
  { id: 'w2', bassin: 'Ouest', temperature: 23.1, pluviometrie: 8, date: '2026-07-20' },
  { id: 'w3', bassin: 'Littoral', temperature: 28.2, pluviometrie: 3, date: '2026-07-21' },
];

export const DEFAULT_MARKET: MarketPriceRecord[] = [
  { id: 'mk1', product: 'Tomates', bassin: 'Ouest', prixMoyen: 480, rentabilite: 18, date: '2026-07-01' },
  { id: 'mk2', product: 'Pommes de terre', bassin: 'Ouest', prixMoyen: 350, rentabilite: 22, date: '2026-07-01' },
  { id: 'mk3', product: 'Maïs', bassin: 'Nord', prixMoyen: 320, rentabilite: 15, date: '2025-07-01' },
  { id: 'mk4', product: 'Tomates', bassin: 'Ouest', prixMoyen: 420, rentabilite: 14, date: '2024-07-01' },
];

export const DEFAULT_PHYTO: PhytoAlertRecord[] = [
  {
    id: 'p1',
    bassin: 'Ouest',
    ravageurMaladie: 'Mildiou de la tomate',
    protocoleUrgence: 'Retirer feuilles atteintes, fongicide cuivre, espacer irrigations.',
    dateEmission: '2026-07-19',
  },
];

export const DEFAULT_PROGRAMS: AgriProgramRecord[] = [
  {
    id: 'pr1',
    nom: 'Crédit Campagne MINADER',
    description: 'Prêt saisonnier taux bonifié',
    criteresEligibilite: 'GIC légalisé, 2 ans d\'activité',
    dateLimite: '2026-09-30',
  },
  {
    id: 'pr2',
    nom: 'Subvention Intrants Ouest',
    description: 'Aide engrais NPK 30%',
    criteresEligibilite: 'Bassin Ouest, surface > 5 ha',
    dateLimite: '2026-08-15',
  },
];

export const DEFAULT_PRODUCTS: ProductOffer[] = [
  { id: '1', name: 'Tomates fraîches', category: 'Légumes', gicId: 'gic-2', gicName: 'GIC Champs Verts', gicRef: 'GIC-CEN-011', price: '500', unit: 'kg', emoji: '🍅', bassin: 'Centre', maturite: 'Mature', volumeDisponible: 2400, dateDispo: '2026-07-25' },
  { id: '2', name: 'Maïs jaune', category: 'Céréales', gicId: 'gic-1', gicName: 'GIC Agro-Vallée', gicRef: 'GIC-OUEST-2024-014', price: '350', unit: 'kg', emoji: '🌽', bassin: 'Ouest', maturite: 'En maturation', volumeDisponible: 5000, dateDispo: '2026-08-10' },
  { id: '3', name: 'Manioc frais', category: 'Tubercules', gicId: 'gic-3', gicName: 'GIC Récoltes du Nord', gicRef: 'GIC-NORD-008', price: '200', unit: 'kg', emoji: '🥔', bassin: 'Nord', maturite: 'Mature', volumeDisponible: 3200, dateDispo: '2026-07-28' },
  { id: '4', name: 'Régimes de Plantains', category: 'Fruits', gicId: 'gic-4', gicName: 'GIC Producteurs Centre', gicRef: 'GIC-CEN-022', price: '800', unit: 'régime', emoji: '🍌', bassin: 'Centre', maturite: 'Précoce', volumeDisponible: 450, dateDispo: '2026-08-05' },
  { id: '5', name: 'Poivrons rouges', category: 'Légumes', gicId: 'gic-5', gicName: 'GIC Terres Fertiles', gicRef: 'GIC-OUEST-031', price: '600', unit: 'kg', emoji: '🫑', bassin: 'Ouest', maturite: 'Mature', volumeDisponible: 900, dateDispo: '2026-07-22' },
  { id: '6', name: 'Arachides séchées', category: 'Légumineuses', gicId: 'gic-6', gicName: 'GIC Fermes CEMAC', gicRef: 'GIC-LIT-019', price: '700', unit: 'kg', emoji: '🥜', bassin: 'Littoral', maturite: 'Séché', volumeDisponible: 1800, dateDispo: '2026-07-30' },
];

export const DEFAULT_GICS_PUBLIC: ConfidentialGic[] = [
  { id: 'gic-1', name: 'GIC Agro-Vallée', identifiantREF: 'GIC-OUEST-2024-014', emoji: '🌿', bassin: 'Ouest' },
  { id: 'gic-2', name: 'GIC Champs Verts', identifiantREF: 'GIC-CEN-011', emoji: '🥬', bassin: 'Centre' },
  { id: 'gic-3', name: 'GIC Récoltes du Nord', identifiantREF: 'GIC-NORD-008', emoji: '🌾', bassin: 'Nord' },
  { id: 'gic-4', name: 'GIC Producteurs Centre', identifiantREF: 'GIC-CEN-022', emoji: '🍌', bassin: 'Centre' },
  { id: 'gic-5', name: 'GIC Terres Fertiles', identifiantREF: 'GIC-OUEST-031', emoji: '🪴', bassin: 'Ouest' },
  { id: 'gic-6', name: 'GIC Fermes CEMAC', identifiantREF: 'GIC-LIT-019', emoji: '🥜', bassin: 'Littoral' },
];

export const DEFAULT_ALERT_PREFS: AlertPreferences = {
  productNames: [],
  bassins: [],
};

/** Peer mock pour sync Xender : version membre plus récente sur une dépense (conflit) */
export const DEFAULT_SYNC_PEER = {
  expenses: [
    { id: '2', label: 'Transport récolte (membre)', amount: 50000, category: 'Transport', synced: false, updatedAt: '2026-07-21T18:00:00.000Z', authorRole: 'member' as const },
    { id: 'peer-new', label: 'Location motopompe', amount: 25000, category: 'Matériel', synced: false, updatedAt: '2026-07-21T19:00:00.000Z', authorRole: 'member' as const },
  ] as ExpenseRecord[],
  harvests: [
    { id: 'peer-h1', product: 'Haricots verts', volume: 300, date: 'Aujourd\'hui', synced: false, updatedAt: '2026-07-21T17:00:00.000Z', authorRole: 'member' as const },
  ] as HarvestRecord[],
  needs: [
    { id: 'peer-n1', category: 'Matériel', description: 'Besoin pulvérisateur (saisie membre)', updatedAt: '2026-07-21T16:00:00.000Z', authorRole: 'member' as const },
  ] as GicNeed[],
};

export function nowIso() {
  return new Date().toISOString();
}
