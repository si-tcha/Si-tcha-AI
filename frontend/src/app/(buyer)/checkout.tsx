import {
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';
import { dbService, OrderType, ProductOffer } from '@/services/database';
import { isNetworkError } from '@/services/api';
import { useCart } from '@/services/cart-store';
import { BottomNavBar } from '@/components/ui/bottom-nav-bar';
import { useToast } from '@/components/ui/toast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

const ORDER_TYPES: { type: OrderType; label: string; hint: string }[] = [
  { type: 'commande_ferme', label: 'Commande ferme', hint: 'Engagement d\'achat confirmé' },
  { type: 'achat_direct', label: 'Achat direct', hint: 'Prise immédiate sur stock disponible' },
  { type: 'reservation', label: 'Bon de réservation', hint: 'Sécurise la récolte future' },
];

export default function BuyerCheckoutScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const {
    cart,
    totalAmount,
    incrementCartItem,
    decrementCartItem,
    removeFromCart,
    clearCart,
    refreshCart,
  } = useCart();
  const [selectedType, setSelectedType] = useState<OrderType>('commande_ferme');
  const [products, setProducts] = useState<ProductOffer[]>([]);
  const [busy, setBusy] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      const items = await dbService.getProducts();
      setProducts(items);
    } catch {
      // Ignorer si échec
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshCart();
      loadProducts();
    }, [refreshCart, loadProducts])
  );

  const handleIncrement = async (productId: string) => {
    const product = products.find((p) => p.id === productId);
    const maxStock = product?.volumeDisponible;
    try {
      await incrementCartItem(productId, maxStock);
    } catch (err: any) {
      showToast({
        message: err?.message || 'Stock maximal atteint pour ce produit.',
        type: 'warning',
      });
    }
  };

  const handleDecrement = async (productId: string) => {
    try {
      await decrementCartItem(productId);
    } catch {
      showToast({ message: 'Erreur lors de la modification de quantité.', type: 'error' });
    }
  };

  const handleRemove = async (productId: string) => {
    try {
      await removeFromCart(productId);
      showToast({ message: 'Article retiré du panier.', type: 'info' });
    } catch {
      showToast({ message: 'Erreur lors du retrait de l\'article.', type: 'error' });
    }
  };

  const handleClearCart = async () => {
    await clearCart();
    showToast({ message: 'Panier vidé.', type: 'info' });
  };

  const handleConfirm = async () => {
    if (!cart.length || busy) return;

    setBusy(true);
    try {
      await dbService.createOrderFromCart(selectedType);
      await refreshCart();
      showToast({
        message: 'Commande enregistrée auprès du GIC ! Le règlement s\'effectuera en espèces lors de la livraison.',
        type: 'success',
      });
      router.replace('/(buyer)/orders');
    } catch (err: any) {
      console.warn('Erreur validation commande:', err);
      let errorMsg = 'Impossible de valider la commande. Votre panier a été conservé.';
      if (isNetworkError(err)) {
        errorMsg = 'Connexion réseau impossible. Votre panier reste intact, vous pouvez retenter dès le retour de la connexion.';
      } else if (err?.status === 409) {
        errorMsg =
          err.payload?.message ||
          err.message ||
          'Stock insuffisant ou conflit d\'idempotence. Votre panier a été conservé.';
      } else if (err?.status === 401) {
        errorMsg = 'Session expirée. Veuillez vous reconnecter pour valider votre commande.';
      } else if (err?.message) {
        errorMsg = err.message;
      }
      showToast({ message: errorMsg, type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.outerContainer} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#101e0f" />

        {/* Header Fixe 56px */}
        <View style={styles.header}>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Mon Panier & Commande</Text>
            <Text style={styles.headerSubtitle}>Règlement en espèces à la livraison</Text>
          </View>

          <View style={styles.headerIcons}>
            {cart.length > 0 && (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={handleClearCart}
                accessibilityLabel="Vider le panier"
                disabled={busy}
              >
                <Feather name="trash-2" size={16} color="#d97834" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Section Liste Panier */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Articles du panier ({cart.length})</Text>
            {cart.length > 0 && (
              <TouchableOpacity onPress={handleClearCart} disabled={busy}>
                <Text style={styles.clearCartText}>Vider tout</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.listCard}>
            {cart.length === 0 ? (
              <View style={styles.emptyItem}>
                <Feather name="shopping-cart" size={40} color="#889e87" />
                <Text style={styles.emptyTitle}>Votre panier est actuellement vide.</Text>
                <Text style={styles.emptySub}>Ajoutez des récoltes fraîches depuis le marché direct.</Text>
                <TouchableOpacity
                  style={styles.browseBtn}
                  onPress={() => router.replace('/(buyer)/home')}
                >
                  <Text style={styles.browseBtnText}>Explorer le Marché</Text>
                </TouchableOpacity>
              </View>
            ) : (
              cart.map((item) => {
                const product = products.find((p) => p.id === item.productId);
                const maxStock = product?.volumeDisponible;
                const isAtMaxStock = maxStock !== undefined && item.quantity >= maxStock;

                return (
                  <View key={item.id} style={styles.listItem}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.itemTitle}>{item.name}</Text>
                      <Text style={styles.meta}>
                        {item.price} FCFA / {item.unit}
                        {maxStock !== undefined ? ` · Dispo: ${maxStock} ${item.unit}` : ''}
                      </Text>
                    </View>

                    <View style={styles.quantityControlRow}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => handleDecrement(item.productId)}
                        disabled={busy}
                        accessibilityLabel="Diminuer la quantité"
                      >
                        <Feather name={item.quantity === 1 ? 'trash' : 'minus'} size={14} color="#f3ecd8" />
                      </TouchableOpacity>

                      <Text style={styles.qtyText}>{item.quantity}</Text>

                      <TouchableOpacity
                        style={[styles.qtyBtn, isAtMaxStock && styles.qtyBtnDisabled]}
                        onPress={() => handleIncrement(item.productId)}
                        disabled={busy || isAtMaxStock}
                        accessibilityLabel="Augmenter la quantité"
                      >
                        <Feather name="plus" size={14} color={isAtMaxStock ? '#889e87' : '#f3ecd8'} />
                      </TouchableOpacity>

                      <View style={styles.itemTotalContainer}>
                        <Text style={styles.itemTotal}>
                          {(parseFloat(item.price || '0') * item.quantity).toLocaleString()} FCFA
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => handleRemove(item.productId)}
                        disabled={busy}
                        accessibilityLabel="Supprimer l'article"
                      >
                        <Feather name="x" size={16} color="#d97834" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {cart.length > 0 && (
            <>
              {/* Total Résumé */}
              <View style={styles.totalSummaryCard}>
                <Text style={styles.totalSummaryLabel}>Total de la commande</Text>
                <Text style={styles.totalSummaryValue}>{totalAmount.toLocaleString()} FCFA</Text>
              </View>

              {/* Type de transaction */}
              <Text style={styles.sectionTitle}>Type d'engagement d'achat</Text>
              {ORDER_TYPES.map((opt) => (
                <TouchableOpacity
                  key={opt.type}
                  style={[styles.typeCard, selectedType === opt.type && styles.typeCardActive]}
                  onPress={() => setSelectedType(opt.type)}
                  disabled={busy}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.typeLabel, selectedType === opt.type && styles.typeLabelActive]}>
                    {opt.label}
                  </Text>
                  <Text style={[styles.meta, selectedType === opt.type && { color: '#889e87' }]}>
                    {opt.hint}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Modalité de règlement : Espèces uniquement */}
              <Text style={styles.sectionTitle}>Modalité de règlement</Text>
              <View style={styles.cashNoticeCard}>
                <View style={styles.cashNoticeHeader}>
                  <View style={styles.cashNoticeBadge}>
                    <Feather name="dollar-sign" size={16} color="#15803d" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cashNoticeTitle}>Paiement en espèces à la remise/livraison</Text>
                    <Text style={styles.cashNoticeSubtitle}>Aucun paiement en ligne requis</Text>
                  </View>
                </View>
                <Text style={styles.cashNoticeBody}>
                  Le règlement de cette commande s'effectue intégralement en espèces lors de la remise physique
                  des produits par le transporteur ou auprès du magasinier du GIC. Vous recevrez un bordereau
                  de commande QR pour vérifier vos récoltes à la livraison (le QR code sert au retrait physique et ne constitue pas une preuve de paiement).
                </Text>
              </View>

              {/* Bouton de confirmation */}
              <TouchableOpacity
                style={[styles.confirmBtn, (!cart.length || busy) && styles.confirmDisabled]}
                onPress={handleConfirm}
                disabled={!cart.length || busy}
                activeOpacity={0.85}
              >
                <Feather
                  name={busy ? 'loader' : 'check-circle'}
                  size={18}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.confirmText}>
                  {busy ? 'Transmission en cours…' : `Valider la commande (${totalAmount.toLocaleString()} FCFA)`}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>

        <BottomNavBar role="buyer" cartCount={cart.length} />
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
  },
  scroll: { padding: Spacing.four, gap: 12, paddingBottom: 90 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#101e0f' },
  clearCartText: { fontSize: 11, fontWeight: '800', color: '#d97834', textDecorationLine: 'underline' },
  listCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    overflow: 'hidden',
  },
  emptyItem: { padding: 40, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: '#101e0f' },
  emptySub: { fontSize: 12, color: '#5a6258', textAlign: 'center' },
  browseBtn: { backgroundColor: '#101e0f', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginTop: 6 },
  browseBtnText: { color: '#f3ecd8', fontWeight: '800', fontSize: 12 },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3ecd8',
  },
  itemTitle: { fontSize: 14, fontWeight: '800', color: '#101e0f' },
  meta: { fontSize: 11, color: '#5a6258', marginTop: 2, fontWeight: '600' },
  quantityControlRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#101e0f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnDisabled: {
    backgroundColor: '#cfd8ce',
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#101e0f',
    minWidth: 20,
    textAlign: 'center',
  },
  itemTotalContainer: {
    minWidth: 70,
    alignItems: 'flex-end',
    marginLeft: 4,
  },
  itemTotal: { fontSize: 13, fontWeight: '900', color: '#d97834' },
  removeBtn: {
    padding: 4,
    marginLeft: 2,
  },
  totalSummaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#101e0f',
    padding: 14,
    borderRadius: 16,
  },
  totalSummaryLabel: { color: '#889e87', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  totalSummaryValue: { color: '#f3ecd8', fontSize: 18, fontWeight: '900' },
  typeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    padding: 14,
    gap: 2,
  },
  typeCardActive: { backgroundColor: '#101e0f', borderColor: '#101e0f' },
  typeLabel: { fontSize: 14, fontWeight: '800', color: '#101e0f' },
  typeLabelActive: { color: '#f3ecd8' },
  cashNoticeCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#bbf7d0',
    padding: 14,
    gap: 8,
  },
  cashNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cashNoticeBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashNoticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803d',
  },
  cashNoticeSubtitle: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '600',
  },
  cashNoticeBody: {
    fontSize: 11,
    color: '#166534',
    lineHeight: 16,
  },
  confirmBtn: {
    marginTop: 6,
    marginBottom: 20,
    backgroundColor: '#d97834',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#d97834',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  confirmDisabled: { opacity: 0.5 },
  confirmText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
});
