import { Dimensions, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, Linking } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { dbService, B2BOffer } from '@/services/database';
import { BottomNavBar } from '@/components/ui/bottom-nav-bar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export default function BuyerB2BScreen() {
  const router = useRouter();
  const [offers, setOffers] = useState<B2BOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'rent' | 'barter'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadOffers();
  }, []);

  const loadOffers = async () => {
    try {
      setIsLoading(true);
      const data = await dbService.getB2BOffers();
      setOffers(data);
    } catch (err) {
      console.warn('Erreur de chargement des offres B2B', err);
    } finally {
      setIsLoading(false);
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
        <StatusBar barStyle="light-content" backgroundColor="#101e0f" />

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color="#f3ecd8" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Marché B2B (Location & Troc)</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
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

          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'all' && styles.tabItemActive]}
              onPress={() => setActiveTab('all')}
            >
              <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>Toutes</Text>
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
              <Text style={[styles.tabText, activeTab === 'barter' && styles.tabTextActive]}>🔄 Troc</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>Matériel & Terres Agricoles</Text>
            <Text style={styles.heroSub}>Louez ou échangez directement avec les GIC</Text>
          </View>

          {isLoading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Chargement des annonces...</Text>
            </View>
          ) : filteredOffers.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="inbox" size={32} color="#889e87" />
              <Text style={styles.emptyStateText}>Aucune offre B2B disponible actuellement.</Text>
            </View>
          ) : (
            filteredOffers.map(offer => (
              <View key={offer.id} style={styles.offerCard}>
                <View style={styles.offerHeader}>
                  <View style={[styles.typeBadge, offer.type === 'rent' ? styles.typeBadgeRent : styles.typeBadgeBarter]}>
                    <Text style={[styles.typeText, offer.type === 'rent' ? styles.typeTextRent : styles.typeTextBarter]}>
                      {offer.type === 'rent' ? 'LOCATION' : 'TROC'}
                    </Text>
                  </View>
                  <Text style={styles.offerCategory}>{offer.category}</Text>
                </View>

                <Text style={styles.offerTitle}>{offer.title}</Text>

                <View style={styles.offerDetails}>
                  <View style={styles.offerRow}>
                    <Feather name="map-pin" size={14} color="#5a6258" />
                    <Text style={styles.offerText}>{offer.location}</Text>
                  </View>
                  <View style={styles.offerRow}>
                    <Feather name="user" size={14} color="#5a6258" />
                    <Text style={styles.offerText}>{offer.gicName}</Text>
                  </View>
                </View>

                <View style={styles.offerDivider} />

                <View style={styles.offerFooter}>
                  <View style={styles.priceContainer}>
                    <Text style={styles.priceLabel}>{offer.type === 'rent' ? 'Prix demandé :' : 'Contrepartie :'}</Text>
                    <Text style={styles.priceVal}>{offer.priceOrExchange}</Text>
                  </View>
                  <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL('tel:' + offer.contact)}>
                    <Feather name="phone" size={16} color="#ffffff" />
                    <Text style={styles.contactText}>Contacter</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
        <BottomNavBar role="buyer" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#101e0f', justifyContent: 'center', alignItems: 'center' },
  container: { width: CONTAINER_WIDTH, height: '100%', backgroundColor: '#f3ecd8' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.four, backgroundColor: '#101e0f', borderBottomWidth: 1, borderBottomColor: '#1d331b' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#f3ecd8' },
  headerRight: { width: 40 },
  scrollContainer: { padding: Spacing.four, gap: Spacing.four },
  heroCard: { backgroundColor: '#d97834', borderRadius: 20, padding: Spacing.five, alignItems: 'center', gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  heroTitle: { fontSize: 20, fontWeight: '900', color: '#ffffff', textAlign: 'center' },
  heroSub: { fontSize: 13, color: '#ffedd5', fontWeight: '600', textAlign: 'center' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 12 },
  emptyStateText: { fontSize: 13, color: '#5a6258', fontWeight: '600' },
  offerCard: { backgroundColor: '#ffffff', borderRadius: 18, padding: Spacing.four, borderWidth: 1, borderColor: '#e6dfcc', gap: 10 },
  offerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeBadgeRent: { backgroundColor: '#e0e7ff', borderWidth: 1, borderColor: '#c7d2fe' },
  typeBadgeBarter: { backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#bbf7d0' },
  typeText: { fontSize: 10, fontWeight: '800' },
  typeTextRent: { color: '#4338ca' },
  typeTextBarter: { color: '#15803d' },
  offerCategory: { fontSize: 11, color: '#889e87', fontWeight: '700', textTransform: 'uppercase' },
  offerTitle: { fontSize: 16, fontWeight: '900', color: '#101e0f' },
  offerDetails: { gap: 6, marginTop: 4 },
  offerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  offerText: { fontSize: 13, color: '#5a6258', fontWeight: '600' },
  offerDivider: { height: 1, backgroundColor: '#e6dfcc', marginVertical: 4 },
  offerFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 },
  priceContainer: { flex: 1, paddingRight: 10 },
  priceLabel: { fontSize: 10, color: '#889e87', fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  priceVal: { fontSize: 14, fontWeight: '800', color: '#101e0f' },
  contactBtn: { backgroundColor: '#101e0f', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  contactText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: '#e6dfcc' },
  searchInput: { flex: 1, height: 46, fontSize: 14, color: '#101e0f' },
  tabBar: { flexDirection: 'row', gap: 6 },
  tabItem: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#ffffff', alignItems: 'center', borderWidth: 1, borderColor: '#e6dfcc' },
  tabItemActive: { backgroundColor: '#101e0f', borderColor: '#101e0f' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#5a6258' },
  tabTextActive: { color: '#f3ecd8', fontWeight: '800' }
});
