import { Dimensions, FlatList, Image, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { dbService, ProductOffer, DEFAULT_PRODUCTS } from '@/services/database';
import { useCart } from '@/services/cart-store';
import { BottomNavBar } from '@/components/ui/bottom-nav-bar';
import { useToast } from '@/components/ui/toast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CATEGORIES = ['Tous', 'Légumes', 'Céréales', 'Tubercules', 'Fruits', 'Légumineuses'];
const BASSINS = ['Tous', 'Ouest', 'Centre', 'Nord', 'Littoral'];
const MATURITES = ['Tous', 'Mature', 'En maturation', 'Précoce', 'Séché'];

const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

let cachedProducts: ProductOffer[] = DEFAULT_PRODUCTS;
let cachedAlertCount = 0;

export default function BuyerHomeScreen() {
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [selectedBassin, setSelectedBassin] = useState('Tous');
  const [selectedMaturite, setSelectedMaturite] = useState('Tous');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductOffer | null>(null);

  const { cartCount, addToCart: addProductToCart } = useCart();
  const [alertCount, setAlertCount] = useState(cachedAlertCount);
  const [products, setProducts] = useState<ProductOffer[]>(cachedProducts);

  const router = useRouter();
  const { showToast } = useToast();
  const { signOut } = useAuth();

  useEffect(() => {
    const init = async () => {
      await dbService.initDatabase();
      const offers = await dbService.getProducts();
      cachedProducts = offers;
      setProducts(offers);
    };
    init();
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const silentSync = async () => {
        try {
          await dbService.initDatabase();
          await dbService.syncRemoteData().catch(() => {});
          const [offers, matches] = await Promise.all([
            dbService.getProducts(),
            dbService.getMatchingAlertCount(),
          ]);
          if (!isMounted) return;
          cachedProducts = offers;
          cachedAlertCount = matches;

          setAlertCount(matches);
          setProducts(offers);
        } catch (err) {
          console.warn('Erreur synchro silencieuse acheteur:', err);
        }
      };
      silentSync();
      return () => { isMounted = false; };
    }, [])
  );

  const handleLogout = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  const handleAddToCart = async (product: ProductOffer) => {
    try {
      await addProductToCart(
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          unit: product.unit,
        },
        product.volumeDisponible
      );
      showToast({ message: `🛒 ${product.name} ajouté au panier !`, type: 'success' });
    } catch (err: any) {
      console.warn('Erreur ajout panier:', err);
      showToast({ message: err?.message || 'Impossible d\'ajouter au panier.', type: 'error' });
    }
  };

  const activeFiltersCount =
    (selectedBassin !== 'Tous' ? 1 : 0) + (selectedMaturite !== 'Tous' ? 1 : 0);

  const resetFilters = () => {
    setSelectedCategory('Tous');
    setSelectedBassin('Tous');
    setSelectedMaturite('Tous');
    setSearchQuery('');
  };

  const filteredProducts = products.filter((product) => {
    const matchesCategory = selectedCategory === 'Tous' || product.category === selectedCategory;
    const matchesBassin = selectedBassin === 'Tous' || product.bassin === selectedBassin;
    const matchesMaturite = selectedMaturite === 'Tous' || product.maturite === selectedMaturite;
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.gicName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesBassin && matchesMaturite && matchesSearch;
  });

  const similarProducts = selectedProduct
    ? products.filter(
        (p) => p.id !== selectedProduct.id && (p.bassin === selectedProduct.bassin || p.category === selectedProduct.category)
      )
    : [];

  const renderProductItem = ({ item }: { item: ProductOffer }) => (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => setSelectedProduct(item)}
      activeOpacity={0.85}
    >
      <View style={styles.productImageContainer}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Text style={styles.productEmoji}>{item.emoji}</Text>
        )}
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>{item.maturite}</Text>
        </View>
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.productGic} numberOfLines={1}>{item.gicName} · {item.bassin}</Text>
        <Text style={styles.productMeta}>{item.volumeDisponible} {item.unit} · {item.dateDispo}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.productPrice}>{item.price} FCFA/{item.unit}</Text>
          <TouchableOpacity onPress={() => handleAddToCart(item)} style={styles.addButton} activeOpacity={0.8}>
            <Feather name="plus" size={16} color="#f3ecd8" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.outerContainer} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#101e0f" />

        {/* Header Unifié Hauteur Fixe 56px */}
        <View style={styles.header}>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Marché Direct Cameroun</Text>
            <Text style={styles.headerSubtitle}>Récoltes Fraîches & GIC Certifiés</Text>
          </View>

          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.replace('/(buyer)/checkout')}>
              <Feather name="shopping-bag" size={18} color="#f3ecd8" />
              {cartCount > 0 && (
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>{cartCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconButton} onPress={() => router.replace('/(buyer)/alerts')}>
              <Feather name="bell" size={18} color="#f3ecd8" />
              {alertCount > 0 && (
                <View style={[styles.badgeContainer, { backgroundColor: '#d97834' }]}>
                  <Text style={styles.badgeText}>{alertCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconButton} onPress={handleLogout}>
              <Feather name="log-out" size={18} color="#f3ecd8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar + Compact Filter Trigger Button */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Feather name="search" size={18} color="#889e87" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher tomates, maïs, GIC..."
              placeholderTextColor="#9ca49a"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Feather name="x" size={16} color="#5a6258" />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.filterTriggerBtn, activeFiltersCount > 0 && styles.filterTriggerBtnActive]}
            onPress={() => setShowFilterModal(true)}
            activeOpacity={0.8}
          >
            <Feather name="sliders" size={18} color={activeFiltersCount > 0 ? '#f3ecd8' : '#101e0f'} />
            {activeFiltersCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Barre de Catégories */}
        <View style={styles.categoriesSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
            {CATEGORIES.map((opt) => {
              const isSelected = selectedCategory === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  onPress={() => setSelectedCategory(opt)}
                  style={[styles.categoryPill, isSelected ? styles.categoryPillSelected : null]}
                >
                  <Text style={[styles.categoryText, isSelected ? styles.categoryTextSelected : null]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Puces de filtres actifs */}
        {activeFiltersCount > 0 && (
          <View style={styles.activeFilterChipsRow}>
            {selectedBassin !== 'Tous' && (
              <TouchableOpacity style={styles.activeChip} onPress={() => setSelectedBassin('Tous')}>
                <Text style={styles.activeChipText}>Bassin: {selectedBassin} ✕</Text>
              </TouchableOpacity>
            )}
            {selectedMaturite !== 'Tous' && (
              <TouchableOpacity style={styles.activeChip} onPress={() => setSelectedMaturite('Tous')}>
                <Text style={styles.activeChipText}>Maturité: {selectedMaturite} ✕</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={resetFilters} style={{ marginLeft: 4 }}>
              <Text style={styles.resetText}>Réinitialiser tout</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* B2B Marketplace Link */}
        <TouchableOpacity style={styles.b2bPromoCard} onPress={() => router.push('/(buyer)/b2b')} activeOpacity={0.9}>
          <View style={styles.b2bPromoLeft}>
            <Feather name="truck" size={24} color="#d97834" />
            <View>
              <Text style={styles.b2bPromoTitle}>Marché B2B</Text>
              <Text style={styles.b2bPromoSub}>Location de matériel & Terres</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color="#101e0f" />
        </TouchableOpacity>

        {/* Product Grid ultra-optimisée */}
        <View style={styles.productsSection}>
          <View style={styles.productsHeader}>
            <Text style={styles.productsTitle}>Offres Certifiées GIC</Text>
            <Text style={styles.productsCount}>{filteredProducts.length} récolte(s)</Text>
          </View>

          <FlatList
            data={filteredProducts}
            renderItem={renderProductItem}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.productsGrid}
            columnWrapperStyle={styles.productsColumnWrapper}
            showsVerticalScrollIndicator={false}
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Feather name="search" size={40} color="#889e87" style={styles.emptyIcon} />
                <Text style={styles.emptyText}>Aucun produit disponible pour ces critères.</Text>
                <TouchableOpacity onPress={resetFilters} style={styles.resetBtnEmpty}>
                  <Text style={styles.resetBtnEmptyText}>Réinitialiser les filtres</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </View>

        {/* Floating Cart bar */}
        {cartCount > 0 && (
          <TouchableOpacity
            style={styles.floatingCartBar}
            onPress={() => router.replace('/(buyer)/checkout')}
            activeOpacity={0.9}
          >
            <View style={styles.floatingCartLeft}>
              <View style={styles.floatingCartBadge}>
                <Text style={styles.floatingCartBadgeText}>{cartCount}</Text>
              </View>
              <Text style={styles.floatingCartText}>Voir mon panier</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.floatingCartAction}>Payer MoMo / OM</Text>
              <Feather name="arrow-right" size={16} color="#ffffff" />
            </View>
          </TouchableOpacity>
        )}

        {/* MODAL FICHE PRODUIT DÉTAILLÉE */}
        <Modal visible={!!selectedProduct} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '90%' }]}>
              {selectedProduct && (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Détails de la Récolte</Text>
                    <TouchableOpacity onPress={() => setSelectedProduct(null)}>
                      <Feather name="x" size={24} color="#101e0f" />
                    </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
                    {/* Bannière Visuelle Produit */}
                    <View style={styles.detailHeroBox}>
                      {selectedProduct.imageUrl ? (
                        <Image source={{ uri: selectedProduct.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      ) : (
                        <Text style={styles.detailHeroEmoji}>{selectedProduct.emoji}</Text>
                      )}
                      <View style={styles.detailBadgesRow}>
                        <View style={styles.detailTagGreen}>
                          <Text style={styles.detailTagGreenText}>✓ {selectedProduct.maturite}</Text>
                        </View>
                        <View style={styles.detailTagOrange}>
                          <Text style={styles.detailTagOrangeText}>📍 Bassin {selectedProduct.bassin}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Informations Principales */}
                    <View style={{ gap: 4 }}>
                      <Text style={styles.detailName}>{selectedProduct.name}</Text>
                      <Text style={styles.detailGicName}>fourni par {selectedProduct.gicName}</Text>
                      <Text style={styles.detailRef}>Réf. Homologuée: {selectedProduct.gicRef ?? 'GIC-CERT-2026'}</Text>
                    </View>

                    {/* Grille de métriques */}
                    <View style={styles.detailMetricsGrid}>
                      <View style={styles.detailMetricCard}>
                        <Feather name="box" size={18} color="#d97834" />
                        <Text style={styles.detailMetricValue}>{selectedProduct.volumeDisponible} {selectedProduct.unit}</Text>
                        <Text style={styles.detailMetricLabel}>Volume disponible</Text>
                      </View>

                      <View style={styles.detailMetricCard}>
                        <Feather name="calendar" size={18} color="#15803d" />
                        <Text style={styles.detailMetricValue}>{selectedProduct.dateDispo}</Text>
                        <Text style={styles.detailMetricLabel}>Disponibilité</Text>
                      </View>

                      <View style={styles.detailMetricCard}>
                        <Feather name="pie-chart" size={18} color="#101e0f" />
                        <Text style={styles.detailMetricValue}>{selectedProduct.volumeDisponible} {selectedProduct.unit}</Text>
                        <Text style={styles.detailMetricLabel}>Récolte estimée</Text>
                      </View>
                    </View>

                    {/* Encadré Prix */}
                    <View style={styles.detailPriceCard}>
                      <Text style={styles.detailPriceLabel}>Prix Direct Producteur :</Text>
                      <Text style={styles.detailPriceValue}>{selectedProduct.price} FCFA / {selectedProduct.unit}</Text>
                    </View>

                    {/* Section Produits Similaires */}
                    {similarProducts.length > 0 && (
                      <View style={{ marginTop: 8, gap: 8 }}>
                        <Text style={styles.filterSectionTitle}>Récoltes similaires & même bassin ({similarProducts.length})</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                          {similarProducts.map((sim) => (
                            <TouchableOpacity
                              key={sim.id}
                              style={styles.similarCard}
                              onPress={() => setSelectedProduct(sim)}
                              activeOpacity={0.8}
                            >
                              <Text style={{ fontSize: 28 }}>{sim.emoji}</Text>
                              <Text style={styles.similarName} numberOfLines={1}>{sim.name}</Text>
                              <Text style={styles.similarPrice}>{sim.price} FCFA/{sim.unit}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </ScrollView>

                  {/* Actions d'achat au bas de la modale */}
                  <View style={styles.modalFooter}>
                    <TouchableOpacity
                      onPress={async () => {
                        await handleAddToCart(selectedProduct);
                      }}
                      style={styles.modalAddCartBtn}
                    >
                      <Feather name="shopping-cart" size={18} color="#f3ecd8" />
                      <Text style={styles.modalAddCartText}>Ajouter au panier</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={async () => {
                        await handleAddToCart(selectedProduct);
                        setSelectedProduct(null);
                        router.replace('/(buyer)/checkout');
                      }}
                      style={styles.modalBuyNowBtn}
                    >
                      <Text style={styles.modalBuyNowText}>Acheter / MoMo</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Modal de Filtres Avancés */}
        <Modal visible={showFilterModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filtres Avancés</Text>
                <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                  <Feather name="x" size={22} color="#101e0f" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
                <View style={{ gap: 8 }}>
                  <Text style={styles.filterSectionTitle}>Bassin de Production</Text>
                  <View style={styles.filterPillGrid}>
                    {BASSINS.map((bassin) => (
                      <TouchableOpacity
                        key={bassin}
                        style={[styles.modalPill, selectedBassin === bassin && styles.modalPillActive]}
                        onPress={() => setSelectedBassin(bassin)}
                      >
                        <Text style={[styles.modalPillText, selectedBassin === bassin && styles.modalPillTextActive]}>
                          {bassin}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={{ gap: 8 }}>
                  <Text style={styles.filterSectionTitle}>Stade de Maturité</Text>
                  <View style={styles.filterPillGrid}>
                    {MATURITES.map((mat) => (
                      <TouchableOpacity
                        key={mat}
                        style={[styles.modalPill, selectedMaturite === mat && styles.modalPillActive]}
                        onPress={() => setSelectedMaturite(mat)}
                      >
                        <Text style={[styles.modalPillText, selectedMaturite === mat && styles.modalPillTextActive]}>
                          {mat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity onPress={resetFilters} style={styles.modalResetBtn}>
                  <Text style={styles.modalResetText}>Réinitialiser</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setShowFilterModal(false)} style={styles.modalApplyBtn}>
                  <Text style={styles.modalApplyText}>Appliquer ({filteredProducts.length})</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <BottomNavBar role="buyer" cartCount={cartCount} alertCount={alertCount} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#101e0f', alignItems: 'center' },
  container: { flex: 1, width: CONTAINER_WIDTH, backgroundColor: '#f3ecd8' },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    backgroundColor: '#101e0f',
    borderBottomWidth: 1,
    borderBottomColor: '#1d331b',
  },
  headerTitleGroup: { gap: 1 },
  headerTitle: { fontSize: 15, fontWeight: '900', color: '#f3ecd8' },
  headerSubtitle: { fontSize: 10, fontWeight: '600', color: '#889e87' },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#1d331b',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeContainer: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#15803d',
    minWidth: 15,
    height: 15,
    borderRadius: 7.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  badgeText: { color: '#ffffff', fontSize: 9, fontWeight: '900' },
  searchSection: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6dfcc',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '600', color: '#101e0f' },
  filterTriggerBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6dfcc',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterTriggerBtnActive: {
    backgroundColor: '#101e0f',
    borderColor: '#101e0f',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#d97834',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { color: '#ffffff', fontSize: 9, fontWeight: '900' },
  categoriesSection: { paddingTop: 10, paddingBottom: 4 },
  categoriesScroll: { paddingHorizontal: Spacing.four, gap: 6 },
  categoryPill: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6dfcc',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  categoryPillSelected: { backgroundColor: '#101e0f', borderColor: '#101e0f' },
  categoryText: { fontSize: 12, fontWeight: '700', color: '#5a6258' },
  categoryTextSelected: { color: '#f3ecd8' },
  activeFilterChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.four,
    gap: 6,
    marginTop: 4,
  },
  activeChip: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#d97834',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  activeChipText: { fontSize: 10, fontWeight: '800', color: '#d97834' },
  resetText: { fontSize: 10, fontWeight: '700', color: '#889e87', textDecorationLine: 'underline' },
  b2bPromoCard: {
    marginHorizontal: Spacing.four,
    marginTop: 10,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#ffedd5',
    borderRadius: 16,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  b2bPromoLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  b2bPromoTitle: { fontSize: 14, fontWeight: '900', color: '#101e0f' },
  b2bPromoSub: { fontSize: 11, fontWeight: '600', color: '#5a6258' },
  productsSection: { flex: 1, paddingHorizontal: Spacing.four, paddingTop: 10 },
  productsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  productsTitle: { fontSize: 14, fontWeight: '800', color: '#101e0f' },
  productsCount: { fontSize: 11, fontWeight: '600', color: '#5a6258' },
  productsGrid: { paddingBottom: 90 },
  productsColumnWrapper: { justifyContent: 'space-between', marginBottom: 12 },
  productCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    overflow: 'hidden',
  },
  productImageContainer: {
    height: 90,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  productEmoji: { fontSize: 44 },
  categoryBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(16, 30, 15, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  categoryBadgeText: { color: '#f3ecd8', fontSize: 9, fontWeight: '800' },
  productInfo: { padding: 10, gap: 3 },
  productName: { fontSize: 13, fontWeight: '800', color: '#101e0f' },
  productGic: { fontSize: 10, color: '#5a6258', fontWeight: '600' },
  productMeta: { fontSize: 10, color: '#889e87', fontWeight: '500' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  productPrice: { fontSize: 12, fontWeight: '900', color: '#d97834' },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#101e0f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: { padding: 40, alignItems: 'center', gap: 10 },
  emptyIcon: { opacity: 0.5 },
  emptyText: { fontSize: 12, color: '#5a6258', textAlign: 'center', lineHeight: 18 },
  resetBtnEmpty: {
    marginTop: 6,
    backgroundColor: '#101e0f',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  resetBtnEmptyText: { color: '#f3ecd8', fontSize: 11, fontWeight: '800' },
  floatingCartBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 76 : 68,
    left: 16,
    right: 16,
    backgroundColor: '#d97834',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#d97834',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  floatingCartLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  floatingCartBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingCartBadgeText: { color: '#d97834', fontSize: 11, fontWeight: '900' },
  floatingCartText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  floatingCartAction: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#f3ecd8',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: Spacing.four,
    maxHeight: '70%',
    gap: 14,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#101e0f' },
  filterSectionTitle: { fontSize: 12, fontWeight: '800', color: '#101e0f', textTransform: 'uppercase' },
  filterPillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modalPill: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6dfcc',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalPillActive: { backgroundColor: '#101e0f', borderColor: '#101e0f' },
  modalPillText: { fontSize: 12, fontWeight: '700', color: '#5a6258' },
  modalPillTextActive: { color: '#f3ecd8' },
  modalFooter: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalResetBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6dfcc',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalResetText: { fontSize: 13, fontWeight: '700', color: '#5a6258' },
  modalApplyBtn: {
    flex: 2,
    backgroundColor: '#d97834',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalApplyText: { fontSize: 13, fontWeight: '900', color: '#ffffff' },

  /* STYLES FICHE PRODUIT DÉTAILLÉE */
  detailHeroBox: {
    height: 140,
    backgroundColor: '#fff7ed',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  detailHeroEmoji: { fontSize: 70 },
  detailBadgesRow: { position: 'absolute', bottom: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between' },
  detailTagGreen: { backgroundColor: '#101e0f', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  detailTagGreenText: { color: '#f3ecd8', fontSize: 10, fontWeight: '800' },
  detailTagOrange: { backgroundColor: '#d97834', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  detailTagOrangeText: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  detailName: { fontSize: 20, fontWeight: '900', color: '#101e0f' },
  detailGicName: { fontSize: 13, fontWeight: '700', color: '#5a6258' },
  detailRef: { fontSize: 11, fontWeight: '600', color: '#889e87' },
  detailMetricsGrid: { flexDirection: 'row', gap: 8, marginTop: 4 },
  detailMetricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    alignItems: 'center',
    gap: 2,
  },
  detailMetricValue: { fontSize: 12, fontWeight: '900', color: '#101e0f', marginTop: 2 },
  detailMetricLabel: { fontSize: 9, color: '#5a6258', fontWeight: '600', textAlign: 'center' },
  detailPriceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#101e0f',
    padding: 14,
    borderRadius: 16,
    marginTop: 4,
  },
  detailPriceLabel: { color: '#889e87', fontSize: 12, fontWeight: '800' },
  detailPriceValue: { color: '#f3ecd8', fontSize: 17, fontWeight: '900' },
  similarCard: {
    width: 110,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    alignItems: 'center',
    gap: 2,
  },
  similarName: { fontSize: 11, fontWeight: '800', color: '#101e0f' },
  similarPrice: { fontSize: 10, fontWeight: '900', color: '#d97834' },
  modalAddCartBtn: {
    flex: 1,
    backgroundColor: '#101e0f',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  modalAddCartText: { color: '#f3ecd8', fontSize: 13, fontWeight: '800' },
  modalBuyNowBtn: {
    flex: 1,
    backgroundColor: '#d97834',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBuyNowText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
});
