import { AppData } from '../domain/types';

const now = '2026-07-22T08:00:00.000Z';

export const seedData: AppData = {
  users: [
    {
      id: 'user-leader-1',
      role: 'seller',
      name: 'Jean Fotso',
      phone: '+237690000001',
      token: 'dev-seller-token',
      createdAt: now,
      gicId: 'gic-1',
      gicRole: 'leader',
      status: 'active',
    },
    {
      id: 'user-buyer-1',
      role: 'buyer',
      name: 'Distributions Nkomo SARL',
      phone: '+237690000010',
      token: 'dev-buyer-token',
      createdAt: now,
      buyerId: 'buyer-1',
      status: 'active',
    },
  ],
  buyers: [
    {
      id: 'buyer-1',
      companyName: 'Distributions Nkomo SARL',
      phone: '+237690000010',
      regNumber: 'RC/YAO/2024/B/00123',
      alertPreferences: { productNames: [], bassins: [] },
      createdAt: now,
    },
  ],
  gics: [
    {
      id: 'gic-1',
      name: 'GIC Agro-Vallée Bafoussam',
      identifiantREF: 'GIC-OUEST-2024-014',
      bassin: 'Ouest',
      statutLegalisation: 'Légalisé',
      activitesPrincipales: 'Maraîchage, tubercules',
      leaderName: 'Jean Fotso',
      reglementInterieur: 'Assemblées mensuelles. Décisions à majorité. Leader tranche les conflits de données.',
      surfaceHa: 12,
      updatedAt: now,
    },
    {
      id: 'gic-2',
      name: 'GIC Champs Verts',
      identifiantREF: 'GIC-CEN-011',
      bassin: 'Centre',
      statutLegalisation: 'Légalisé',
      activitesPrincipales: 'Légumes frais',
      leaderName: 'Aline Mballa',
      reglementInterieur: 'Validation collective des ventes.',
      surfaceHa: 8,
      updatedAt: now,
    },
  ],
  members: [
    { id: 'm1', gicId: 'gic-1', name: 'Jean Fotso', phone: '+237690000001', isLeader: true, updatedAt: now },
    { id: 'm2', gicId: 'gic-1', name: 'Marie Nguemo', phone: '+237690000002', isLeader: false, updatedAt: now },
    { id: 'm3', gicId: 'gic-1', name: 'Paul Tchoumi', phone: '+237690000003', isLeader: false, updatedAt: now },
  ],
  needs: [],
  harvests: [
    { id: 'h1', gicId: 'gic-1', product: 'Pommes de terre', volume: 1200, date: '12 Juillet 2026', synced: true, updatedAt: now, authorRole: 'leader' },
    { id: 'h2', gicId: 'gic-1', product: 'Tomates', volume: 800, date: '18 Juillet 2026', synced: true, updatedAt: now, authorRole: 'leader' },
  ],
  expenses: [
    { id: 'e1', gicId: 'gic-1', label: 'Fertilisants NPK', amount: 150000, category: 'Intrants', synced: true, updatedAt: now, authorRole: 'leader' },
    { id: 'e2', gicId: 'gic-1', label: 'Transport récolte', amount: 45000, category: 'Transport', synced: true, updatedAt: now, authorRole: 'member' },
    { id: 'e3', gicId: 'gic-1', label: "Main d'œuvre semis", amount: 80000, category: "Main d'œuvre", synced: true, updatedAt: now, authorRole: 'leader' },
  ],
  products: [
    { id: 'p1', name: 'Pommes de terre', category: 'Tubercules', gicId: 'gic-1', gicName: 'GIC Agro-Vallée Bafoussam', gicRef: 'GIC-OUEST-2024-014', price: '350', unit: 'kg', emoji: '🥔', bassin: 'Ouest', maturite: 'En maturation', volumeDisponible: 5000, dateDispo: '2026-08-10', quantiteEstimee: 5800, updatedAt: now },
    { id: 'p2', name: 'Tomates fraîches', category: 'Légumes', gicId: 'gic-2', gicName: 'GIC Champs Verts', gicRef: 'GIC-CEN-011', price: '500', unit: 'kg', emoji: '🍅', bassin: 'Centre', maturite: 'Mature', volumeDisponible: 2400, dateDispo: '2026-07-25', quantiteEstimee: 2600, updatedAt: now },
  ],
  orders: [],
  weather: [
    { id: 'w1', bassin: 'Ouest', temperature: 24.5, pluviometrie: 12, date: '2026-07-21' },
    { id: 'w2', bassin: 'Centre', temperature: 26.1, pluviometrie: 6, date: '2026-07-21' },
  ],
  market: [
    { id: 'mk1', product: 'Pommes de terre', bassin: 'Ouest', prixMoyen: 350, rentabilite: 22, date: '2026-07-01' },
    { id: 'mk2', product: 'Pommes de terre', bassin: 'Ouest', prixMoyen: 310, rentabilite: 18, date: '2025-07-01' },
    { id: 'mk3', product: 'Tomates', bassin: 'Centre', prixMoyen: 500, rentabilite: 20, date: '2026-07-01' },
  ],
  phytoAlerts: [
    {
      id: 'pa1',
      bassin: 'Ouest',
      ravageurMaladie: 'Mildiou de la pomme de terre',
      protocoleUrgence: 'Retirer les feuilles atteintes, réduire l’humidité, appliquer un fongicide cuivre homologué.',
      dateEmission: '2026-07-19',
    },
  ],
  programs: [
    {
      id: 'pr1',
      nom: 'Crédit Campagne MINADER',
      description: 'Prêt saisonnier à taux bonifié',
      criteresEligibilite: "GIC légalisé, deux ans d'activité",
      dateLimite: '2026-09-30',
    },
  ],
};
