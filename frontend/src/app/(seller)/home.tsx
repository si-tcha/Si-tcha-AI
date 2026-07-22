import { Dimensions, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import React, { useEffect, useState } from 'react';


import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { dbService, ExpenseRecord, HarvestRecord, GicProfile } from '@/services/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export default function SellerHomeScreen() {
  const router = useRouter();
  
  // États pour les récoltes et dépenses (persistés via dbService)
  const [harvests, setHarvests] = useState<HarvestRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [profile, setProfile] = useState<GicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
  }, []);

  const handleLogout = () => {
    router.replace('/(auth)/welcome');
  };

  // Calculs financiers dynamiques
  const totalVolume = harvests.reduce((acc, curr) => acc + curr.volume, 0);
  const totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  
  // Coût de revient moyen par kg = Dépenses totales / Volume total
  const costPricePerKg = totalVolume > 0 ? Math.round(totalExpenses / totalVolume) : 0;
  const surfaceHa = profile?.surfaceHa ?? 0;
  const costPricePerHa = surfaceHa > 0 ? Math.round(totalExpenses / surfaceHa) : 0;

  const handleAddHarvest = async () => {
    if (!formProduct.trim() || !formVolume.trim()) {
      alert('Veuillez remplir tous les champs.');
      return;
    }
    try {
      const newHarvest = await dbService.addHarvest(formProduct.trim(), parseFloat(formVolume));
      setHarvests(prev => [newHarvest, ...prev]);
      setFormProduct('');
      setFormVolume('');
      setHarvestModalVisible(false);
    } catch (err) {
      console.warn('Erreur sauvegarde récolte:', err);
      alert('Impossible d\'enregistrer la récolte.');
    }
  };

  const handleAddExpense = async () => {
    if (!formExpenseLabel.trim() || !formExpenseAmount.trim()) {
      alert('Veuillez remplir tous les champs.');
      return;
    }
    try {
      const newExpense = await dbService.addExpense(
        formExpenseLabel.trim(),
        parseFloat(formExpenseAmount),
        formExpenseCategory
      );
      setExpenses(prev => [newExpense, ...prev]);
      setFormExpenseLabel('');
      setFormExpenseAmount('');
      setExpenseModalVisible(false);
    } catch (err) {
      console.warn('Erreur sauvegarde dépense:', err);
      alert('Impossible d\'enregistrer la dépense.');
    }
  };

  return (
    <SafeAreaView style={styles.outerContainer}>
      <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f3ecd8" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.gicInfo}>
          <View style={styles.avatarBg}>
            <Feather name="shield" size={20} color="#f3ecd8" />
          </View>
          <View>
            <Text style={styles.gicName}>{profile?.name ?? 'GIC Agro-Vallée Bafoussam'}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>Leader GIC</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Feather name="log-out" size={20} color="#d97834" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navPills}>
          <TouchableOpacity style={styles.navPill} onPress={() => router.push('/(seller)/profile')}>
            <Feather name="home" size={14} color="#f3ecd8" />
            <Text style={styles.navPillText}>Profil GIC</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navPill} onPress={() => router.push('/(seller)/terrain')}>
            <Feather name="cloud" size={14} color="#f3ecd8" />
            <Text style={styles.navPillText}>Terrain</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.navPill, styles.navPillAccent]} onPress={() => router.push('/(seller)/sync')}>
            <Feather name="refresh-cw" size={14} color="#f3ecd8" />
            <Text style={styles.navPillText}>Sync</Text>
          </TouchableOpacity>
        </ScrollView>
        
        {/* Widget Calculateur du Coût de Revient (Rigueur Financière) */}
        <View style={styles.calculatorCard}>
          <Text style={styles.calcHeader}>Calculateur de Coût de Revient</Text>
          
          <View style={styles.calcMetricsRow}>
            <View style={styles.calcMetricCol}>
              <Text style={styles.calcMetricLabel}>Dépenses totales</Text>
              <Text style={styles.calcMetricVal}>{totalExpenses.toLocaleString()} FCFA</Text>
            </View>
            <View style={styles.calcDivider} />
            <View style={styles.calcMetricCol}>
              <Text style={styles.calcMetricLabel}>Volume total</Text>
              <Text style={styles.calcMetricVal}>{totalVolume.toLocaleString()} kg</Text>
            </View>
          </View>

          <View style={styles.calcResultContainer}>
            <Text style={styles.calcResultLabel}>Coût de revient réel estimé</Text>
            <Text style={styles.calcResultValue}>{costPricePerKg} FCFA / kg</Text>
            {surfaceHa > 0 ? (
              <Text style={styles.calcResultHa}>{costPricePerHa.toLocaleString()} FCFA / ha · {surfaceHa} ha</Text>
            ) : null}
          </View>

          <View style={styles.calcFormulaNote}>
            <Feather name="activity" size={14} color="#14532d" />
            <Text style={styles.calcFormulaText}>
              Formule : Total Dépenses ÷ Total Récoltes en kg{surfaceHa > 0 ? ' (et / ha).' : '.'}
            </Text>
          </View>
        </View>

        {/* Boutons d'actions rapides de saisie */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity 
            onPress={() => setHarvestModalVisible(true)} 
            style={[styles.actionBtn, { backgroundColor: '#101e0f' }]}
          >
            <Feather name="plus-circle" size={16} color="#f3ecd8" />
            <Text style={styles.actionBtnText}>Récolte</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setExpenseModalVisible(true)} 
            style={[styles.actionBtn, { backgroundColor: '#d97834' }]}
          >
            <Feather name="dollar-sign" size={16} color="#f3ecd8" />
            <Text style={styles.actionBtnText}>Dépense</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => router.push('/(seller)/agronomist')} 
            style={[styles.actionBtn, { backgroundColor: '#14532d' }]}
          >
            <Feather name="message-square" size={16} color="#f3ecd8" />
            <Text style={styles.actionBtnText}>Agronome</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => router.push('/(seller)/b2b-trade')} 
            style={[styles.actionBtn, { backgroundColor: '#854d0e' }]}
          >
            <Feather name="truck" size={16} color="#f3ecd8" />
            <Text style={styles.actionBtnText}>B2B Trade</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => router.push('/(seller)/growth-log')} 
            style={[styles.actionBtn, { backgroundColor: '#166534' }]}
          >
            <Feather name="trending-up" size={16} color="#f3ecd8" />
            <Text style={styles.actionBtnText}>Croissance & Alertes</Text>
          </TouchableOpacity>
        </View>

        {/* Liste des Récoltes Récentes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Récoltes Enregistrées</Text>
            <Feather name="archive" size={18} color="#101e0f" />
          </View>
          <View style={styles.listCard}>
            {isLoading ? (
              <View style={styles.listItem}>
                <Text style={styles.itemSub}>Chargement des récoltes...</Text>
              </View>
            ) : harvests.length === 0 ? (
              <View style={styles.listItem}>
                <Text style={styles.itemSub}>Aucune récolte enregistrée.</Text>
              </View>
            ) : (
              harvests.map(h => (
                <View key={h.id} style={styles.listItem}>
                  <View style={styles.itemMain}>
                    <View style={[styles.itemIconBg, { backgroundColor: '#889e8720' }]}>
                      <Feather name="box" size={16} color="#889e87" />
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
            <Text style={styles.sectionTitle}>Charges & Dépenses</Text>
            <Feather name="credit-card" size={18} color="#101e0f" />
          </View>
          <View style={styles.listCard}>
            {isLoading ? (
              <View style={styles.listItem}>
                <Text style={styles.itemSub}>Chargement des dépenses...</Text>
              </View>
            ) : expenses.length === 0 ? (
              <View style={styles.listItem}>
                <Text style={styles.itemSub}>Aucune dépense enregistrée.</Text>
              </View>
            ) : (
              expenses.map(e => (
                <View key={e.id} style={styles.listItem}>
                  <View style={styles.itemMain}>
                    <View style={[styles.itemIconBg, { backgroundColor: '#d9783420' }]}>
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

              <TouchableOpacity onPress={handleAddHarvest} style={styles.modalSubmitBtn}>
                <Text style={styles.modalSubmitText}>Enregistrer la récolte</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODALE SAISIE DEPENSE */}
      <Modal visible={expenseModalVisible} animationType="slide" transparent>
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
                  {['Intrants', 'Transport', 'Main d\'œuvre', 'Matériel'].map(cat => {
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

              <TouchableOpacity onPress={handleAddExpense} style={[styles.modalSubmitBtn, { backgroundColor: '#d97834' }]}>
                <Text style={styles.modalSubmitText}>Enregistrer la dépense</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: isWeb ? '#e6dfcc' : '#f3ecd8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: CONTAINER_WIDTH,
    height: '100%',
    backgroundColor: '#f3ecd8',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: isWeb ? '#101e0f' : 'transparent',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: isWeb ? 10 : 0,
  },
  containerOld: {
    flex: 1,
    backgroundColor: '#f3ecd8', // Cream
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#e6dfcc',
  },
  gicInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#101e0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gicName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#101e0f',
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#889e8730',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginTop: 2,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#101e0f',
  },
  logoutBtn: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.four,
  },
  calculatorCard: {
    backgroundColor: '#f0fdf4', // Soft green background
    borderWidth: 1.5,
    borderColor: '#889e87',
    borderRadius: 24,
    padding: Spacing.four,
    gap: Spacing.three,
    shadowColor: '#101e0f',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  calcHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: '#101e0f',
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
    fontSize: 16,
    fontWeight: '800',
    color: '#101e0f',
  },
  calcDivider: {
    width: 1,
    height: 35,
    backgroundColor: '#889e87',
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
    fontSize: 11,
    color: '#889e87',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  calcResultValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#f3ecd8', // Cream text
  },
  calcResultHa: {
    fontSize: 12,
    fontWeight: '600',
    color: '#889e87',
    marginTop: 4,
  },
  navPills: {
    gap: 8,
    paddingBottom: 2,
  },
  navPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#101e0f',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  navPillAccent: {
    backgroundColor: '#d97834',
  },
  navPillText: {
    color: '#f3ecd8',
    fontSize: 12,
    fontWeight: '700',
  },
  calcFormulaNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
  },
  calcFormulaText: {
    fontSize: 11,
    color: '#14532d',
    fontWeight: '600',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionBtn: {
    minWidth: '47%',
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#101e0f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  actionBtnText: {
    color: '#f3ecd8',
    fontSize: 14,
    fontWeight: '700',
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
    backgroundColor: '#101e0f60',
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
