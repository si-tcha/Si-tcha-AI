import { Dimensions, FlatList, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { dbService, ProductOffer } from '@/services/database';
import { BottomNavBar } from '@/components/ui/bottom-nav-bar';
import { useToast } from '@/components/ui/toast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CATEGORIES = ['Tous', 'Légumes', 'Céréales', 'Tubercules', 'Fruits', 'Légumineuses'];
const BASSINS = ['Tous', 'Ouest', 'Centre', 'Nord', 'Littoral'];
const MATURITES = ['Tous', 'Mature', 'En maturation', 'Précoce', 'Séché'];

const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;
const CARD_WIDTH = (Math.min(SCREEN_WIDTH, CONTAINER_WIDTH) - 44) / 2;

export default function BuyerHomeScreen() {
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [selectedBassin, setSelectedBassin] = useState('Tous');
  const [selectedMaturite, setSelectedMaturite] = useState('Tous');
  const [searchQuery, setSearchQuery] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const [products, setProducts] = useState<ProductOffer[]>([]);
  const router = useRouter();
  const { showToast } = useToast();

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        try {
          await dbService.initDatabase();
          const [offers, count, matches] = await Promise.all([
            dbService.getProducts(),
            dbService.getCartCount(),
            dbService.getMatchingAlertCount(),
          ]);
          setProducts(offers);
          setCartCount(count);
          setAlertCount(matches);
        } catch (err) {
          console.warn('Erreur chargement acheteur:', err);
        }
      };
      load();
    }, [])
  );

  const handleLogout = () => {
    router.replace('/(auth)/welcome');
  };

  const handleAddToCart = async (product: ProductOffer) => {
    try {
      await dbService.addToCart({
        productId: product.id,
        name: product.name,
        price: product.price,
        unit: product.unit,
      });
      const newCount = await dbService.getCartCount();
      setCartCount(newCount);
      showToast({ message: `${product.name} ajouté au panier !`, type: 'success' });
    } catch (err) {
      console.warn('Erreur ajout panier:', err);
      showToast({ message: 'Impossible d\'ajouter au panier.', type: 'error' });
    }
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

  const renderProductItem = ({ item }: { item: ProductOffer }) => (
    <View style={styles.productCard}>
      <View style={styles.productImageContainer}>
        <Text style={styles.productEmoji}>{item.emoji}</Text>
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
    </View>
  );

  const renderFilterRow = (
    options: string[],
    selected: string,
    onSelect: (v: string) => void
  ) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
      {options.map((opt) => {
        const isSelected = selected === opt;
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => onSelect(opt)}
            style={[styles.categoryPill, isSelected ? styles.categoryPillSelected : null]}
          >
            <Text style={[styles.categoryText, isSelected ? styles.categoryTextSelected : null]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.outerContainer}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#101e0f" />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greetingText}>Marche Direct Cameroun</Text>
            <Text style={styles.mainActionText}>Récoltes Fraîches & GIC</Text>
          </View>

          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/(buyer)/checkout')}>
              <Feather name="shopping-bag" size={20} color="#f3ecd8" />
              {cartCount > 0 && (
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>{cartCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/(buyer)/alerts')}>
              <Feather name="bell" size={20} color="#f3ecd8" />
              {alertCount > 0 && (
                <View style={[styles.badgeContainer, { backgroundColor: '#d97834' }]}>
                  <Text style={styles.badgeText}>{alertCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleLogout} style={styles.iconButton}>
              <Feather name="log-out" size={18} color="#d97834" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
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
        </View>

        {/* Filters */}
        <View style={styles.categoriesSection}>
          {renderFilterRow(CATEGORIES, selectedCategory, setSelectedCategory)}
        </View>
        <View style={styles.categoriesSection}>
          {renderFilterRow(BASSINS, selectedBassin, setSelectedBassin)}
        </View>
        <View style={styles.categoriesSection}>
          {renderFilterRow(MATURITES, selectedMaturite, setSelectedMaturite)}
        </View>

        {/* Product Grid */}
        <View style={styles.productsSection}>
          <View style={styles.productsHeader}>
            <Text style={styles.productsTitle}>Offres Certifiées GIC</Text>
            <Text style={styles.productsCount}>{filteredProducts.length} récoltes répertoriées</Text>
          </View>

          <FlatList
            data={filteredProducts}
            renderItem={renderProductItem}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.productsGrid}
            columnWrapperStyle={styles.productsColumnWrapper}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Feather name="search" size={40} color="#889e87" style={styles.emptyIcon} />
                <Text style={styles.emptyText}>Aucun produit disponible pour ces critères de recherche.</Text>
              </View>
            }
          />
        </View>

        {/* Floating Cart bar if items exist */}
        {cartCount > 0 && (
          <TouchableOpacity 
            style={styles.floatingCartBar} 
            onPress={() => router.push('/(buyer)/checkout')}
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

        <BottomNavBar role="buyer" cartCount={cartCount} alertCount={alertCount} />
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
  headerText: { gap: 2 },
  greetingText: { fontSize: 11, color: '#889e87', fontWeight: '700', textTransform: 'uppercase' },
  mainActionText: { fontSize: 18, fontWeight: '800', color: '#f3ecd8' },
  headerIcons: { flexDirection: 'row', gap: 10 },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#1d331b',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badgeContainer: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#101e0f',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#f3ecd8', fontSize: 9, fontWeight: '800' },
  searchSection: { paddingHorizontal: Spacing.four, marginTop: Spacing.two, marginBottom: Spacing.two },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e6dfcc',
    paddingHorizontal: Spacing.three,
    height: 48,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#101e0f', fontWeight: '500' },
  categoriesSection: { marginBottom: 6 },
  categoriesScroll: { paddingHorizontal: Spacing.four, gap: 8 },
  categoryPill: {
    backgroundColor: '#ffffff',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e6dfcc',
  },
  categoryPillSelected: { backgroundColor: '#101e0f', borderColor: '#101e0f' },
  categoryText: { fontSize: 12, fontWeight: '700', color: '#5a6258' },
  categoryTextSelected: { color: '#f3ecd8' },
  productsSection: { flex: 1, paddingHorizontal: Spacing.four, marginTop: 4 },
  productsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  productsTitle: { fontSize: 15, fontWeight: '800', color: '#101e0f' },
  productsCount: { fontSize: 11, fontWeight: '600', color: '#5a6258' },
  productsGrid: { paddingBottom: 80 },
  productsColumnWrapper: { justifyContent: 'space-between', marginBottom: Spacing.three },
  productCard: {
    width: CARD_WIDTH,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    overflow: 'hidden',
  },
  productImageContainer: {
    height: 100,
    backgroundColor: '#f9f6ef',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  productEmoji: { fontSize: 44 },
  categoryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#101e0f90',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  categoryBadgeText: { fontSize: 9, fontWeight: '800', color: '#f3ecd8' },
  productInfo: { padding: Spacing.three, gap: 3 },
  productName: { fontSize: 13, fontWeight: '800', color: '#101e0f' },
  productGic: { fontSize: 11, color: '#5a6258', fontWeight: '600' },
  productMeta: { fontSize: 10, color: '#889e87', fontWeight: '600' },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  productPrice: { fontSize: 12, fontWeight: '800', color: '#d97834' },
  addButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#101e0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: { paddingVertical: 60, alignItems: 'center', gap: 12 },
  emptyIcon: { opacity: 0.4 },
  emptyText: {
    fontSize: 13,
    color: '#5a6258',
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
  },
  floatingCartBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 76 : 68,
    left: 16,
    right: 16,
    backgroundColor: '#d97834',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#d97834',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  floatingCartLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  floatingCartBadge: { backgroundColor: '#ffffff', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  floatingCartBadgeText: { color: '#d97834', fontSize: 12, fontWeight: '900' },
  floatingCartText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  floatingCartAction: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
});
