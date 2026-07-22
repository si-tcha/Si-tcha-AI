import { Dimensions, FlatList, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import React, { useEffect, useState } from 'react';


import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { dbService } from '@/services/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Product {
  id: string;
  name: string;
  category: string;
  gic: string;
  price: string;
  unit: string;
  emoji: string;
}

const PRODUCTS: Product[] = [
  { id: '1', name: 'Tomates fraîches', category: 'Légumes', gic: 'GIC Champs Verts', price: '500', unit: 'kg', emoji: '🍅' },
  { id: '2', name: 'Maïs jaune', category: 'Céréales', gic: 'GIC Agro-Vallée', price: '350', unit: 'kg', emoji: '🌽' },
  { id: '3', name: 'Manioc frais', category: 'Tubercules', gic: 'GIC Récoltes du Nord', price: '200', unit: 'kg', emoji: '🥔' },
  { id: '4', name: 'Régimes de Plantains', category: 'Fruits', gic: 'GIC Producteurs Centre', price: '800', unit: 'régime', emoji: '🍌' },
  { id: '5', name: 'Poivrons rouges', category: 'Légumes', gic: 'GIC Terres Fertiles', price: '600', unit: 'kg', emoji: '🫑' },
  { id: '6', name: 'Arachides séchées', category: 'Légumineuses', gic: 'GIC Fermes CEMAC', price: '700', unit: 'kg', emoji: '🥜' }
];

const CATEGORIES = ["Tous", "Légumes", "Céréales", "Tubercules", "Fruits", "Légumineuses"];



const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export default function BuyerHomeScreen() {
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [searchQuery, setSearchQuery] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const loadCart = async () => {
      try {
        await dbService.initDatabase();
        const count = await dbService.getCartCount();
        setCartCount(count);
      } catch (err) {
        console.warn('Erreur chargement panier:', err);
      }
    };

    loadCart();
  }, []);

  const handleLogout = () => {
    // Simule une déconnexion vers l'écran de bienvenue
    router.replace('/(auth)/welcome');
  };

  const handleAddToCart = async (product: Product) => {
    try {
      await dbService.addToCart({
        productId: product.id,
        name: product.name,
        price: product.price,
        unit: product.unit,
      });
      const count = await dbService.getCartCount();
      setCartCount(count);
    } catch (err) {
      console.warn('Erreur ajout panier:', err);
      alert('Impossible d\'ajouter au panier.');
    }
  };

  const filteredProducts = PRODUCTS.filter(product => {
    const matchesCategory = selectedCategory === 'Tous' || product.category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          product.gic.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const renderProductItem = ({ item }: { item: Product }) => {
    return (
      <View style={styles.productCard}>
        {/* Visual Badge representant le produit */}
        <View style={styles.productImageContainer}>
          <Text style={styles.productEmoji}>{item.emoji}</Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{item.category}</Text>
          </View>
        </View>

        {/* Détails du produit */}
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.productGic} numberOfLines={1}>{item.gic}</Text>
          
          <View style={styles.priceRow}>
            <Text style={styles.productPrice}>{item.price} FCFA/{item.unit}</Text>
            <TouchableOpacity 
              onPress={() => handleAddToCart(item)}
              style={styles.addButton}
            >
              <Feather name="plus" size={16} color="#f3ecd8" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.outerContainer}>
      <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f3ecd8" />

      {/* Barre d'en-tête (Top Bar) */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.greetingText}>Bonjour,</Text>
          <Text style={styles.mainActionText}>Que cherchez-vous ?</Text>
        </View>
        
        <View style={styles.headerIcons}>
          {/* Panier */}
          <TouchableOpacity style={styles.iconButton}>
            <Feather name="shopping-bag" size={20} color="#101e0f" />
            {cartCount > 0 && (
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Notifications */}
          <TouchableOpacity style={styles.iconButton}>
            <Feather name="bell" size={20} color="#101e0f" />
            <View style={[styles.badgeContainer, { backgroundColor: '#d97834' }]}>
              <Text style={styles.badgeText}>1</Text>
            </View>
          </TouchableOpacity>

          {/* Déconnexion */}
          <TouchableOpacity onPress={handleLogout} style={styles.iconButton}>
            <Feather name="log-out" size={18} color="#d97834" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Barre de Recherche */}
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

      {/* Filtres de Catégories horizontaux */}
      <View style={styles.categoriesSection}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          {CATEGORIES.map((cat, index) => {
            const isSelected = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={index}
                onPress={() => setSelectedCategory(cat)}
                style={[
                  styles.categoryPill,
                  isSelected ? styles.categoryPillSelected : null
                ]}
              >
                <Text style={[
                  styles.categoryText,
                  isSelected ? styles.categoryTextSelected : null
                ]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Grille de produits */}
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
  },
  headerText: {
    gap: 2,
  },
  greetingText: {
    fontSize: 14,
    color: '#5a6258',
    fontWeight: '600',
  },
  mainActionText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#101e0f',
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 12,
  },
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
  badgeText: {
    color: '#f3ecd8',
    fontSize: 9,
    fontWeight: '700',
  },
  searchSection: {
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.three,
  },
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
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#101e0f',
    fontWeight: '500',
  },
  categoriesSection: {
    marginBottom: Spacing.three,
  },
  categoriesScroll: {
    paddingHorizontal: Spacing.four,
    gap: 8,
  },
  categoryPill: {
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e6dfcc',
  },
  categoryPillSelected: {
    backgroundColor: '#101e0f',
    borderColor: '#101e0f',
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5a6258',
  },
  categoryTextSelected: {
    color: '#f3ecd8',
  },
  productsSection: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  productsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  productsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#101e0f',
  },
  productsCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5a6258',
  },
  productsGrid: {
    paddingBottom: Spacing.four,
  },
  productsColumnWrapper: {
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  productCard: {
    width: (SCREEN_WIDTH - 48) / 2,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    overflow: 'hidden',
    shadowColor: '#101e0f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  productImageContainer: {
    height: 110,
    backgroundColor: '#f9f6ef',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  productEmoji: {
    fontSize: 48,
  },
  categoryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#e6dfcc80',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#101e0f',
  },
  productInfo: {
    padding: Spacing.three,
    gap: 4,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#101e0f',
  },
  productGic: {
    fontSize: 11,
    color: '#5a6258',
    fontWeight: '500',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  productPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: '#d97834', // Orange price tag
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#101e0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  emptyIcon: {
    opacity: 0.3,
  },
  emptyText: {
    fontSize: 13,
    color: '#5a6258',
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
  }
});
