import { Dimensions, FlatList, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { dbService, ProductOffer } from '@/services/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CATEGORIES = ['Tous', 'Légumes', 'Céréales', 'Tubercules', 'Fruits', 'Légumineuses'];
const BASSINS = ['Tous', 'Ouest', 'Centre', 'Nord', 'Littoral'];
const MATURITES = ['Tous', 'Mature', 'En maturation', 'Précoce', 'Séché'];

const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;
const CARD_WIDTH = (Math.min(SCREEN_WIDTH, CONTAINER_WIDTH) - 48) / 2;

export default function BuyerHomeScreen() {
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [selectedBassin, setSelectedBassin] = useState('Tous');
  const [selectedMaturite, setSelectedMaturite] = useState('Tous');
  const [searchQuery, setSearchQuery] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const [products, setProducts] = useState<ProductOffer[]>([]);
  const router = useRouter();

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
      setCartCount(await dbService.getCartCount());
    } catch (err) {
      console.warn('Erreur ajout panier:', err);
      alert('Impossible d\'ajouter au panier.');
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
          <TouchableOpacity onPress={() => handleAddToCart(item)} style={styles.addButton}>
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
        <StatusBar barStyle="dark-content" backgroundColor="#f3ecd8" />

        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greetingText}>Bonjour,</Text>
            <Text style={styles.mainActionText}>Que cherchez-vous ?</Text>
          </View>

          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/(buyer)/checkout')}>
              <Feather name="shopping-bag" size={20} color="#101e0f" />
              {cartCount > 0 && (
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>{cartCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/(buyer)/alerts')}>
              <Feather name="bell" size={20} color="#101e0f" />
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

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navPills}>
          <TouchableOpacity style={styles.navPill} onPress={() => router.push('/(buyer)/gics')}>
            <Feather name="shield" size={14} color="#f3ecd8" />
            <Text style={styles.navPillText}>GIC</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navPill} onPress={() => router.push('/(buyer)/orders')}>
            <Feather name="file-text" size={14} color="#f3ecd8" />
            <Text style={styles.navPillText}>Commandes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.navPill, styles.navPillAccent]} onPress={() => router.push('/(buyer)/checkout')}>
            <Feather name="check-circle" size={14} color="#f3ecd8" />
            <Text style={styles.navPillText}>Réserver</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Feather name="search" size={18} color="#5a6258" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher des produits..."
              placeholderTextColor="#9ca49a"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        <View style={styles.categoriesSection}>
          {renderFilterRow(CATEGORIES, selectedCategory, setSelectedCategory)}
        </View>
        <View style={styles.categoriesSection}>
          {renderFilterRow(BASSINS, selectedBassin, setSelectedBassin)}
        </View>
        <View style={styles.categoriesSection}>
          {renderFilterRow(MATURITES, selectedMaturite, setSelectedMaturite)}
        </View>

        <View style={styles.productsSection}>
          <View style={styles.productsHeader}>
            <Text style={styles.productsTitle}>Tous les produits</Text>
            <Text style={styles.productsCount}>{filteredProducts.length} articles</Text>
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
                <Feather name="search" size={40} color="#5a6258" style={styles.emptyIcon} />
                <Text style={styles.emptyText}>Aucun produit ne correspond à votre recherche.</Text>
              </View>
            }
          />
        </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  headerText: { gap: 2 },
  greetingText: { fontSize: 14, color: '#5a6258', fontWeight: '600' },
  mainActionText: { fontSize: 20, fontWeight: '800', color: '#101e0f' },
  headerIcons: { flexDirection: 'row', gap: 12 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e6dfcc',
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
  badgeText: { color: '#f3ecd8', fontSize: 9, fontWeight: '700' },
  navPills: { paddingHorizontal: Spacing.four, gap: 8, marginBottom: Spacing.two },
  navPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#101e0f',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  navPillAccent: { backgroundColor: '#d97834' },
  navPillText: { color: '#f3ecd8', fontSize: 12, fontWeight: '700' },
  searchSection: { paddingHorizontal: Spacing.four, marginBottom: Spacing.two },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    paddingHorizontal: Spacing.three,
    height: 50,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#101e0f', fontWeight: '500' },
  categoriesSection: { marginBottom: Spacing.two },
  categoriesScroll: { paddingHorizontal: Spacing.four, gap: 8 },
  categoryPill: {
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e6dfcc',
  },
  categoryPillSelected: { backgroundColor: '#101e0f', borderColor: '#101e0f' },
  categoryText: { fontSize: 12, fontWeight: '600', color: '#5a6258' },
  categoryTextSelected: { color: '#f3ecd8' },
  productsSection: { flex: 1, paddingHorizontal: Spacing.four },
  productsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  productsTitle: { fontSize: 16, fontWeight: '800', color: '#101e0f' },
  productsCount: { fontSize: 12, fontWeight: '600', color: '#5a6258' },
  productsGrid: { paddingBottom: Spacing.four },
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
  productEmoji: { fontSize: 42 },
  categoryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#e6dfcc80',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  categoryBadgeText: { fontSize: 9, fontWeight: '700', color: '#101e0f' },
  productInfo: { padding: Spacing.three, gap: 3 },
  productName: { fontSize: 13, fontWeight: '700', color: '#101e0f' },
  productGic: { fontSize: 11, color: '#5a6258', fontWeight: '500' },
  productMeta: { fontSize: 10, color: '#889e87', fontWeight: '600' },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  productPrice: { fontSize: 12, fontWeight: '800', color: '#d97834' },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#101e0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: { paddingVertical: 60, alignItems: 'center', gap: 12 },
  emptyIcon: { opacity: 0.3 },
  emptyText: {
    fontSize: 13,
    color: '#5a6258',
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
  },
});
