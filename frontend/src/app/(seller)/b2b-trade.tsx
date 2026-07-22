import { Dimensions, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { B2BOffer, dbService } from '@/services/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

const BASSINS = ['Ouest', 'Centre', 'Nord', 'Littoral', 'Sud-Ouest'];

export default function B2bTradeScreen() {
  const router = useRouter();
  const [offers, setOffers] = useState<B2BOffer[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'rent' | 'barter'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<'rent' | 'barter'>('rent');
  const [formCategory, setFormCategory] = useState('Matériel Irrigation');
  const [formPriceOrExchange, setFormPriceOrExchange] = useState('');
  const [formGicName, setFormGicName] = useState('Mon GIC Local');
  const [formLocation, setFormLocation] = useState('Bafoussam (Ouest)');
  const [formContact, setFormContact] = useState('+237 699 00 00 00');

  useEffect(() => {
    loadOffers();
  }, []);

  const loadOffers = async () => {
    try {
      await dbService.initDatabase();
      const list = await dbService.getB2BOffers();
      setOffers(list);
    } catch (err) {
      console.warn('Erreur chargement offres B2B:', err);
    }
  };

  const handleCreateOffer = async () => {
    if (!formTitle.trim() || !formPriceOrExchange.trim()) {
      alert('Veuillez remplir le titre et le tarif/échange.');
      return;
    }
    try {
      const newOffer = await dbService.addB2BOffer(
        formTitle.trim(),
        formType,
        formCategory,
        formPriceOrExchange.trim(),
        formGicName.trim(),
        formLocation.trim(),
        formContact.trim()
      );
      setOffers(prev => [newOffer, ...prev]);
      setFormTitle('');
      setFormPriceOrExchange('');
      setModalVisible(false);
    } catch (err) {
      alert('Erreur lors de la création de l\'offre.');
    }
  };

  const filteredOffers = offers.filter((item) => {
    const matchesTab = activeTab === 'all' || item.type === activeTab;
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <SafeAreaView style={styles.outerContainer}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f3ecd8" />

        {/* En-tête */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color="#101e0f" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>Commerce B2B & Matériel</Text>
            <Text style={styles.headerSubtitle}>Location d'équipements & Troc d'intrants</Text>
          </View>
          <TouchableOpacity style={styles.addNavButton} onPress={() => setModalVisible(true)}>
            <Feather name="plus" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Barre de recherche */}
          <View style={styles.searchContainer}>
            <Feather name="search" size={18} color="#889e87" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher motopompe, tracteur, engrais..."
              placeholderTextColor="#889e87"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Onglets Filtrage */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'all' && styles.tabItemActive]}
              onPress={() => setActiveTab('all')}
            >
              <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>Toutes les offres</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'rent' && styles.tabItemActive]}
              onPress={() => setActiveTab('rent')}
            >
              <Text style={[styles.tabText, activeTab === 'rent' && styles.tabTextActive]}>🚜 Locations</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'barter' && styles.tabItemActive]}
              onPress={() => setActiveTab('barter')}
            >
              <Text style={[styles.tabText, activeTab === 'barter' && styles.tabTextActive]}>🔄 Troc & Échanges</Text>
            </TouchableOpacity>
          </View>

          {/* Bouton Publier */}
          <TouchableOpacity style={styles.actionButton} onPress={() => setModalVisible(true)}>
            <Feather name="plus-circle" size={18} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.actionButtonText}>Publier du matériel ou une offre de troc</Text>
          </TouchableOpacity>

          {/* Liste des offres */}
          <Text style={styles.sectionTitle}>Offres disponibles ({filteredOffers.length})</Text>

          {filteredOffers.map((offer) => (
            <View key={offer.id} style={styles.offerCard}>
              <View style={styles.offerHeader}>
                <View style={[styles.typeBadge, offer.type === 'rent' ? styles.rentBadge : styles.barterBadge]}>
                  <Text style={[styles.typeBadgeText, offer.type === 'rent' ? styles.rentText : styles.barterText]}>
                    {offer.type === 'rent' ? '🚜 Location' : '🔄 Troc'}
                  </Text>
                </View>
                <Text style={styles.categoryText}>{offer.category}</Text>
              </View>

              <Text style={styles.offerTitle}>{offer.title}</Text>
              
              <View style={styles.priceContainer}>
                <Feather name="tag" size={16} color="#d97834" style={{ marginRight: 6 }} />
                <Text style={styles.priceText}>{offer.priceOrExchange}</Text>
              </View>

              <View style={styles.locationRow}>
                <Feather name="map-pin" size={14} color="#889e87" style={{ marginRight: 4 }} />
                <Text style={styles.locationText}>{offer.gicName} • {offer.location}</Text>
              </View>

              <TouchableOpacity style={styles.contactButton} onPress={() => alert(`Contact GIC: ${offer.contact}`)}>
                <Feather name="phone-call" size={16} color="#101e0f" style={{ marginRight: 6 }} />
                <Text style={styles.contactButtonText}>Contacter le GIC ({offer.contact})</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        {/* Modale de publication B2B */}
        <Modal visible={modalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Publier une offre B2B</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Feather name="x" size={24} color="#101e0f" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.inputLabel}>Type d'offre</Text>
                <View style={styles.typeSelector}>
                  <TouchableOpacity
                    style={[styles.typeOption, formType === 'rent' && styles.typeOptionActive]}
                    onPress={() => setFormType('rent')}
                  >
                    <Text style={[styles.typeOptionText, formType === 'rent' && styles.typeOptionTextActive]}>🚜 Location Matériel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeOption, formType === 'barter' && styles.typeOptionActive]}
                    onPress={() => setFormType('barter')}
                  >
                    <Text style={[styles.typeOptionText, formType === 'barter' && styles.typeOptionTextActive]}>🔄 Troc & Échange</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Titre de l'équipement ou de l'offre</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="ex: Location Motopompe 5.5 HP / Troc 5 sacs Engrais"
                  placeholderTextColor="#889e87"
                  value={formTitle}
                  onChangeText={setFormTitle}
                />

                <Text style={styles.inputLabel}>Tarif ou Condition d'échange</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="ex: 5 000 FCFA / jour  OU  Contre 10 sacs Maïs"
                  placeholderTextColor="#889e87"
                  value={formPriceOrExchange}
                  onChangeText={setFormPriceOrExchange}
                />

                <Text style={styles.inputLabel}>Nom du GIC ou Planteur</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Nom de votre GIC"
                  placeholderTextColor="#889e87"
                  value={formGicName}
                  onChangeText={setFormGicName}
                />

                <Text style={styles.inputLabel}>Téléphone de contact</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="+237 6XX XX XX XX"
                  placeholderTextColor="#889e87"
                  keyboardType="phone-pad"
                  value={formContact}
                  onChangeText={setFormContact}
                />

                <TouchableOpacity style={styles.modalSubmitButton} onPress={handleCreateOffer}>
                  <Text style={styles.modalSubmitText}>Publier l'offre B2B</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#101e0f', alignItems: 'center' },
  container: { flex: 1, width: CONTAINER_WIDTH, backgroundColor: '#f3ecd8' },
  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.three, backgroundColor: '#f3ecd8', borderBottomWidth: 1, borderBottomColor: '#e0d8c3' },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#101e0f' },
  headerSubtitle: { fontSize: 12, color: '#889e87' },
  addNavButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#d97834', alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: Spacing.three },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e0d8c3', marginBottom: Spacing.three },
  searchInput: { flex: 1, height: 44, fontSize: 14, color: '#101e0f' },
  tabBar: { flexDirection: 'row', marginBottom: Spacing.three, gap: 6 },
  tabItem: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#ffffff', alignItems: 'center', borderWidth: 1, borderColor: '#e0d8c3' },
  tabItemActive: { backgroundColor: '#101e0f', borderColor: '#101e0f' },
  tabText: { fontSize: 11, fontWeight: '600', color: '#101e0f' },
  tabTextActive: { color: '#ffffff', fontWeight: '700' },
  actionButton: { flexDirection: 'row', backgroundColor: '#d97834', padding: Spacing.three, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.four },
  actionButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#101e0f', marginBottom: Spacing.three },
  offerCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: Spacing.three, marginBottom: Spacing.three, borderWidth: 1, borderColor: '#e0d8c3' },
  offerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  rentBadge: { backgroundColor: '#e6f4ea' },
  barterBadge: { backgroundColor: '#feefe3' },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },
  rentText: { color: '#137333' },
  barterText: { color: '#d97834' },
  categoryText: { fontSize: 12, color: '#889e87' },
  offerTitle: { fontSize: 16, fontWeight: '700', color: '#101e0f', marginBottom: 8 },
  priceContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  priceText: { fontSize: 15, fontWeight: '700', color: '#d97834' },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  locationText: { fontSize: 12, color: '#889e87' },
  contactButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3ecd8', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e0d8c3' },
  contactButtonText: { fontSize: 13, fontWeight: '700', color: '#101e0f' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#f3ecd8', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.four, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.three },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#101e0f' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#101e0f', marginTop: 10, marginBottom: 6 },
  typeSelector: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  typeOption: { flex: 1, padding: 10, borderRadius: 10, backgroundColor: '#ffffff', alignItems: 'center', borderWidth: 1, borderColor: '#e0d8c3' },
  typeOptionActive: { backgroundColor: '#101e0f', borderColor: '#101e0f' },
  typeOptionText: { fontSize: 12, color: '#101e0f' },
  typeOptionTextActive: { color: '#ffffff', fontWeight: '700' },
  textInput: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e0d8c3', borderRadius: 10, padding: 12, fontSize: 14, color: '#101e0f' },
  modalSubmitButton: { backgroundColor: '#d97834', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 20, marginBottom: 20 },
  modalSubmitText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
});
