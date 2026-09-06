import { Dimensions, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { dbService, ExpenseRecord, HarvestRecord, GicProfile } from '@/services/database';
import { BottomNavBar } from '@/components/ui/bottom-nav-bar';
import { useToast } from '@/components/ui/toast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export default function SellerHomeScreen() {
  const router = useRouter();
  const { showToast } = useToast();

  // États pour les récoltes et dépenses (persistés via dbService)
  const [harvests, setHarvests] = useState<HarvestRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [profile, setProfile] = useState<GicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  // États des modales de saisie
  const [harvestModalVisible, setHarvestModalVisible] = useState(false);
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);

  // Formulaires récolte
  const [formProduct, setFormProduct] = useState('');
  const [formVolume, setFormVolume] = useState('');

  // Formulaires dépense
  const [formExpenseLabel, setFormExpenseLabel] = useState('');
  const [formExpenseAmount, setFormExpenseAmount] = useState('');
  const [formExpenseCategory, setFormExpenseCategory] = useState('Intrants');

  useEffect(() => {
    const loadLocalData = async () => {
      try {
        await dbService.initDatabase();
        const [storedHarvests, storedExpenses, gicProfile] = await Promise.all([
          dbService.getHarvests(),
          dbService.getExpenses(),
          dbService.getGicProfile(),
        ]);
        setHarvests(storedHarvests);
        setExpenses(storedExpenses);
        setProfile(gicProfile);
      } catch (err) {
        console.warn('Erreur chargement données vendeur:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadLocalData();

    // Check online status periodically
    const checkStatus = async () => {
      try {
        const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api';
        const res = await fetch(baseUrl.replace('/api', '/api/health'), { method: 'GET' });
        setIsOnline(res.ok);
      } catch {
        setIsOnline(false);
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 15000); // Check every 15s
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    router.replace('/(auth)/welcome');
  };

  // Calculs financiers dynamiques
  const totalVolume = harvests.reduce((acc, curr) => acc + curr.volume, 0);
  const totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  // Coût de revient moyen par kg = Dépenses totales / Volume total
  const costPricePerKg = totalVolume > 0 ? Math.round(totalExpenses / totalVolume) : 0;
  const surfaceHa = profile?.surfaceHa ?? 2.5;
  const costPricePerHa = surfaceHa > 0 ? Math.round(totalExpenses / surfaceHa) : 0;

  // Estimation du prix moyen de vente sur le marché
  const marketPricePerKg = 450; // FCFA/kg (moyenne régionale)
  const estimatedRevenue = totalVolume * marketPricePerKg;
  const estimatedProfit = estimatedRevenue - totalExpenses;
  const marginPercent = estimatedRevenue > 0 ? Math.round((estimatedProfit / estimatedRevenue) * 100) : 0;

  // Répartition par catégorie de dépenses
  const expenseCategories = ['Intrants', 'Transport', "Main d'œuvre", 'Matériel'];
  const getCategoryTotal = (cat: string) =>
    expenses.filter(e => e.category === cat).reduce((sum, e) => sum + e.amount, 0);

  const handleAddHarvest = async () => {
    if (!formProduct.trim() || !formVolume.trim()) {
      showToast({ message: 'Veuillez remplir tous les champs.', type: 'warning' });
      return;
    }
    try {
      const vol = parseFloat(formVolume);
      if (isNaN(vol) || vol <= 0) {
        showToast({ message: 'Veuillez saisir un volume valide.', type: 'warning' });
        return;
      }
      const newHarvest = await dbService.addHarvest(formProduct.trim(), vol);
      setHarvests(prev => [newHarvest, ...prev]);
      setFormProduct('');
      setFormVolume('');
      setHarvestModalVisible(false);
      showToast({ message: `Récolte de ${vol} kg enregistrée en local !`, type: 'success' });
    } catch (err) {
      console.warn('Erreur sauvegarde récolte:', err);
      showToast({ message: "Impossible d'enregistrer la récolte.", type: 'error' });
    }
  };

  const handleAddExpense = async () => {
    if (!formExpenseLabel.trim() || !formExpenseAmount.trim()) {
      showToast({ message: 'Veuillez remplir tous les champs.', type: 'warning' });
      return;
    }
    try {
      const amount = parseFloat(formExpenseAmount);
      if (isNaN(amount) || amount <= 0) {
        showToast({ message: 'Veuillez saisir un montant valide.', type: 'warning' });
        return;
      }
      const newExpense = await dbService.addExpense(
        formExpenseLabel.trim(),
        amount,
        formExpenseCategory
      );
      setExpenses(prev => [newExpense, ...prev]);
      setFormExpenseLabel('');
      setFormExpenseAmount('');
      setExpenseModalVisible(false);
      showToast({ message: `Dépense de ${amount.toLocaleString()} FCFA ajoutée !`, type: 'success' });
    } catch (err) {
      console.warn('Erreur sauvegarde dépense:', err);
      showToast({ message: "Impossible d'enregistrer la dépense.", type: 'error' });
    }
  };

  return (
    <SafeAreaView style={styles.outerContainer}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#101e0f" />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.gicInfo}>
            <View style={styles.avatarBg}>
              <Feather name="shield" size={20} color="#d97834" />
            </View>
            <View>
              <Text style={styles.gicName}>{profile?.name ?? 'GIC Agro-Vallée Bafoussam'}</Text>
              <View style={styles.statusBadgeRow}>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>Leader GIC</Text>
                </View>
                <View style={styles.offlineBadge}>
                  <View style={[styles.greenPulse, { backgroundColor: isOnline ? '#22c55e' : '#ef4444' }]} />
                  <Text style={styles.offlineBadgeText}>{isOnline ? 'En Ligne' : 'Hors-ligne'}</Text>
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Feather name="log-out" size={18} color="#d97834" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>


          {/* Widget Calculateur du Coût de Revient (Rigueur Financière) */}
          <View style={styles.calculatorCard}>
            <View style={styles.calcHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 8 }}>
                <Feather name="pie-chart" size={18} color="#101e0f" />
                <Text style={[styles.calcHeader, { flexShrink: 1 }]} numberOfLines={1}>Calculateur de Coût</Text>
              </View>
              <Text style={styles.calcSubHeader}>Bilan</Text>
            </View>

            <View style={styles.calcMetricsRow}>
              <View style={styles.calcMetricCol}>
                <Text style={styles.calcMetricLabel}>Total Dépenses</Text>
                <Text style={styles.calcMetricVal}>{totalExpenses.toLocaleString()} FCFA</Text>
              </View>
              <View style={styles.calcDivider} />
              <View style={styles.calcMetricCol}>
                <Text style={styles.calcMetricLabel}>Total Récoltes</Text>
                <Text style={styles.calcMetricVal}>{totalVolume.toLocaleString()} kg</Text>
              </View>
            </View>

            <View style={styles.calcResultContainer}>
              <Text style={styles.calcResultLabel}>Coût de revient réel estimé</Text>
              <Text style={styles.calcResultValue}>{costPricePerKg} FCFA / kg</Text>
              {surfaceHa > 0 ? (
                <Text style={styles.calcResultHa}>{costPricePerHa.toLocaleString()} FCFA / hectare · {surfaceHa} ha exploités</Text>
              ) : null}
            </View>

            {/* Marge bénéficiaire estimée vs Prix du Marché */}
            <View style={styles.marginCard}>
              <View style={styles.marginRow}>
                <View>
                  <Text style={styles.marginLabel}>Prix Moyen du Marché</Text>
                  <Text style={styles.marginVal}>{marketPricePerKg} FCFA/kg</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.marginLabel}>Marge Est. / kg</Text>
                  <Text style={[styles.marginVal, { color: marginPercent >= 0 ? '#15803d' : '#b91c1c' }]}>
                    +{Math.max(0, marketPricePerKg - costPricePerKg)} FCFA ({marginPercent}%)
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.calcFormulaNote}>
              <Feather name="check-circle" size={14} color="#15803d" />
              <Text style={styles.calcFormulaText}>
                Formule : Total Dépenses ÷ Total Récoltes en kg.
              </Text>
            </View>
          </View>

          {/* Boutons d'actions rapides de saisie */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              onPress={() => setHarvestModalVisible(true)}
              style={[styles.actionBtn, { backgroundColor: '#101e0f' }]}
              activeOpacity={0.8}
            >
              <Feather name="plus-circle" size={18} color="#d97834" />
              <Text style={styles.actionBtnText}>+ Récolte</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setExpenseModalVisible(true)}
              style={[styles.actionBtn, { backgroundColor: '#d97834' }]}
              activeOpacity={0.8}
            >
              <Feather name="dollar-sign" size={18} color="#ffffff" />
              <Text style={[styles.actionBtnText, { color: '#ffffff' }]}>+ Dépense</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => router.push('/(seller)/prefinancing')}
            style={[styles.actionBtn, { backgroundColor: '#1a3018', marginTop: 10, alignSelf: 'center', width: '100%', paddingVertical: 12 }]}
            activeOpacity={0.8}
          >
            <Feather name="inbox" size={18} color="#d97834" />
            <Text style={[styles.actionBtnText, { color: '#f3ecd8' }]}>Voir les Offres de Préfinancement</Text>
          </TouchableOpacity>

          {/* Répartition des Dépenses par Catégorie */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Répartition des Charges</Text>
              <Feather name="bar-chart-2" size={18} color="#101e0f" />
            </View>
            <View style={styles.breakdownCard}>
              {expenseCategories.map(cat => {
                const catTotal = getCategoryTotal(cat);
                const catPercent = totalExpenses > 0 ? Math.round((catTotal / totalExpenses) * 100) : 0;
                return (
                  <View key={cat} style={styles.catProgressItem}>
                    <View style={styles.catProgressHeader}>
                      <Text style={styles.catProgressLabel}>{cat}</Text>
                      <Text style={styles.catProgressVal}>{catTotal.toLocaleString()} FCFA ({catPercent}%)</Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View style={[styles.progressBarFill, { width: `${catPercent}%` }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Liste des Récoltes Récentes */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Récoltes Enregistrées ({harvests.length})</Text>
              <Feather name="archive" size={18} color="#101e0f" />
            </View>
            <View style={styles.listCard}>
              {isLoading ? (
                <View style={styles.listItem}>
                  <Text style={styles.itemSub}>Chargement des récoltes...</Text>
                </View>
              ) : harvests.length === 0 ? (
                <View style={styles.emptyStateItem}>
                  <Feather name="box" size={28} color="#889e87" />
                  <Text style={styles.itemSub}>Aucune récolte enregistrée pour le moment.</Text>
                </View>
              ) : (
                harvests.map(h => (
                  <View key={h.id} style={styles.listItem}>
                    <View style={styles.itemMain}>
                      <View style={[styles.itemIconBg, { backgroundColor: '#101e0f15' }]}>
                        <Feather name="package" size={16} color="#101e0f" />
                      </View>
                      <View>
                        <Text style={styles.itemTitle}>{h.product}</Text>
                        <Text style={styles.itemSub}>{h.date}</Text>
                      </View>
                    </View>
                    <Text style={styles.itemValue}>{h.volume} kg</Text>
                  </View>
                ))
              )}
            </View>
          </View>

          {/* Liste des Charges Financières Récentes */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Charges & Dépenses ({expenses.length})</Text>
              <Feather name="credit-card" size={18} color="#101e0f" />
            </View>
            <View style={styles.listCard}>
              {isLoading ? (
                <View style={styles.listItem}>
                  <Text style={styles.itemSub}>Chargement des dépenses...</Text>
                </View>
              ) : expenses.length === 0 ? (
                <View style={styles.emptyStateItem}>
                  <Feather name="dollar-sign" size={28} color="#d97834" />
                  <Text style={styles.itemSub}>Aucune dépense enregistrée pour le moment.</Text>
                </View>
              ) : (
                expenses.map(e => (
                  <View key={e.id} style={styles.listItem}>
                    <View style={styles.itemMain}>
                      <View style={[styles.itemIconBg, { backgroundColor: '#d9783415' }]}>
                        <Feather name="tag" size={16} color="#d97834" />
                      </View>
                      <View>
                        <Text style={styles.itemTitle}>{e.label}</Text>
                        <Text style={styles.itemSub}>{e.category}</Text>
                      </View>
                    </View>
                    <Text style={[styles.itemValue, { color: '#d97834' }]}>{e.amount.toLocaleString()} FCFA</Text>
                  </View>
                ))
              )}
            </View>
          </View>

        </ScrollView>

        {/* MODALE SAISIE RECOLTE */}
        <Modal visible={harvestModalVisible} animationType="slide" transparent>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nouvelle Récolte</Text>
                <TouchableOpacity onPress={() => setHarvestModalVisible(false)}>
                  <Feather name="x" size={24} color="#101e0f" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalForm}>
                <View style={styles.fieldWrapper}>
                  <Text style={styles.label}>Nom du produit</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ex: Pommes de terre, Maïs..."
                    placeholderTextColor="#9ca49a"
                    value={formProduct}
                    onChangeText={setFormProduct}
                  />
                </View>

                <View style={styles.fieldWrapper}>
                  <Text style={styles.label}>Quantité (kg)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ex: 500"
                    placeholderTextColor="#9ca49a"
                    keyboardType="numeric"
                    value={formVolume}
                    onChangeText={setFormVolume}
                  />
                </View>

                <TouchableOpacity onPress={handleAddHarvest} style={styles.modalSubmitBtn} activeOpacity={0.85}>
                  <Text style={styles.modalSubmitText}>Enregistrer la récolte</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* MODALE SAISIE DEPENSE */}
        <Modal visible={expenseModalVisible} animationType="slide" transparent>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nouvelle Dépense</Text>
                <TouchableOpacity onPress={() => setExpenseModalVisible(false)}>
                  <Feather name="x" size={24} color="#101e0f" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalForm}>
                <View style={styles.fieldWrapper}>
                  <Text style={styles.label}>Libellé de la dépense</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ex: Engrais NPK, Achat sacs..."
                    placeholderTextColor="#9ca49a"
                    value={formExpenseLabel}
                    onChangeText={setFormExpenseLabel}
                  />
                </View>

                <View style={styles.fieldWrapper}>
                  <Text style={styles.label}>Montant (FCFA)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ex: 15000"
                    placeholderTextColor="#9ca49a"
                    keyboardType="numeric"
                    value={formExpenseAmount}
                    onChangeText={setFormExpenseAmount}
                  />
                </View>

                <View style={styles.fieldWrapper}>
                  <Text style={styles.label}>Catégorie</Text>
                  <View style={styles.categoryPillsRow}>
                    {['Intrants', 'Transport', "Main d'œuvre", 'Matériel'].map(cat => {
                      const isSelected = formExpenseCategory === cat;
                      return (
                        <TouchableOpacity
                          key={cat}
                          onPress={() => setFormExpenseCategory(cat)}
                          style={[styles.catPill, isSelected ? styles.catPillSelected : null]}
                        >
                          <Text style={[styles.catPillText, isSelected ? styles.catPillTextSelected : null]}>{cat}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <TouchableOpacity onPress={handleAddExpense} style={[styles.modalSubmitBtn, { backgroundColor: '#d97834' }]} activeOpacity={0.85}>
                  <Text style={styles.modalSubmitText}>Enregistrer la dépense</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Bottom Navigation Bar */}
        <BottomNavBar role="seller" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#101e0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: CONTAINER_WIDTH,
    height: '100%',
    backgroundColor: '#f3ecd8',
    position: 'relative',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    backgroundColor: '#101e0f',
    borderBottomWidth: 1,
    borderBottomColor: '#1d331b',
  },
  gicInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1d331b',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d9783440',
  },
  gicName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#f3ecd8',
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  roleBadge: {
    backgroundColor: '#d9783420',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#d97834',
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1d331b',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  greenPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  offlineBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#889e87',
  },
  logoutBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#1d331b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.four,
  },
  quickNavRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  navChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#101e0f',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  navChipAccent: {
    backgroundColor: '#d97834',
  },
  navChipText: {
    color: '#f3ecd8',
    fontSize: 11,
    fontWeight: '700',
  },
  calculatorCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#889e87',
    borderRadius: 22,
    padding: Spacing.four,
    gap: Spacing.three,
    shadowColor: '#101e0f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  calcHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calcHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: '#101e0f',
  },
  calcSubHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#d97834',
    textTransform: 'uppercase',
  },
  calcMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: Spacing.one,
  },
  calcMetricCol: {
    flex: 1,
    gap: 2,
  },
  calcMetricLabel: {
    fontSize: 11,
    color: '#5a6258',
    fontWeight: '600',
  },
  calcMetricVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#101e0f',
  },
  calcDivider: {
    width: 1,
    height: 35,
    backgroundColor: '#e6dfcc',
    marginHorizontal: Spacing.two,
  },
  calcResultContainer: {
    backgroundColor: '#101e0f',
    borderRadius: 16,
    padding: Spacing.three,
    alignItems: 'center',
    gap: 2,
  },
  calcResultLabel: {
    fontSize: 10,
    color: '#889e87',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  calcResultValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#f3ecd8',
  },
  calcResultHa: {
    fontSize: 11,
    fontWeight: '600',
    color: '#d97834',
    marginTop: 2,
  },
  marginCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 14,
    padding: Spacing.three,
  },
  marginRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  marginLabel: {
    fontSize: 10,
    color: '#15803d',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  marginVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#101e0f',
    marginTop: 2,
  },
  calcFormulaNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
  },
  calcFormulaText: {
    fontSize: 11,
    color: '#15803d',
    fontWeight: '600',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#101e0f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  actionBtnText: {
    color: '#f3ecd8',
    fontSize: 14,
    fontWeight: '800',
  },
  section: {
    gap: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#101e0f',
  },
  breakdownCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    padding: Spacing.three,
    gap: 12,
  },
  catProgressItem: {
    gap: 4,
  },
  catProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  catProgressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#101e0f',
  },
  catProgressVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5a6258',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#e6dfcc',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#d97834',
    borderRadius: 4,
  },
  listCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#f3ecd8',
  },
  emptyStateItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  itemMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#101e0f',
  },
  itemSub: {
    fontSize: 11,
    color: '#5a6258',
    fontWeight: '600',
  },
  itemValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#101e0f',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#101e0f70',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#f3ecd8',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: Spacing.four,
    paddingBottom: Spacing.five,
    borderWidth: 2,
    borderColor: '#e6dfcc',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#101e0f',
  },
  modalForm: {
    gap: Spacing.three,
  },
  fieldWrapper: {
    gap: Spacing.two,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#101e0f',
    paddingLeft: 4,
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e6dfcc',
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    height: 52,
    fontSize: 15,
    color: '#101e0f',
    fontWeight: '500',
  },
  categoryPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catPill: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6dfcc',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 15,
  },
  catPillSelected: {
    backgroundColor: '#d97834',
    borderColor: '#d97834',
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5a6258',
  },
  catPillTextSelected: {
    color: '#f3ecd8',
  },
  modalSubmitBtn: {
    backgroundColor: '#101e0f',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: Spacing.two,
    shadowColor: '#101e0f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  modalSubmitText: {
    color: '#f3ecd8',
    fontWeight: '700',
    fontSize: 15,
  }
});
