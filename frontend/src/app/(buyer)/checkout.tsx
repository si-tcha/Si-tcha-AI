import { Dimensions, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView } from 'react-native';
import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';
import { CartItemRecord, dbService, OrderType } from '@/services/database';
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
  const { cart, addToCart: addProductToCart, clearCart, refreshCart } = useCart();
  const [selectedType, setSelectedType] = useState<OrderType>('reservation');
  const [paymentMethod, setPaymentMethod] = useState<'momo' | 'om' | 'cash'>('momo');
  const [phoneNumber, setPhoneNumber] = useState('677000000');
  const [busy, setBusy] = useState(false);

  // Rafraîchissement automatique du panier à chaque prise de focus de l'écran
  useFocusEffect(
    useCallback(() => {
      refreshCart();
    }, [refreshCart])
  );

  const handleIncrement = async (productId: string) => {
    const item = cart.find(i => i.productId === productId);
    if (item) {
      await addProductToCart({
        productId: item.productId,
        name: item.name,
        price: item.price,
        unit: item.unit,
      });
    }
  };

  const handleClearCart = async () => {
    await clearCart();
    showToast({ message: 'Panier vidé.', type: 'info' });
  };

  const totalAmount = cart.reduce((sum, item) => sum + (parseFloat(item.price || '0') * item.quantity), 0);

  const handleConfirm = async () => {
    if (!cart.length) {
      showToast({ message: 'Votre panier est vide.', type: 'warning' });
      return;
    }
    if (!phoneNumber.trim() || phoneNumber.length < 8) {
      showToast({ message: 'Veuillez saisir un numéro de téléphone valide.', type: 'warning' });
      return;
    }
    setBusy(true);
    try {
      await dbService.createOrderFromCart(selectedType);
      await refreshCart();
      showToast({ message: 'Commande et paiement enregistrés avec succès !', type: 'success' });
      router.replace('/(buyer)/orders');
    } catch (err) {
      console.warn(err);
      showToast({ message: 'Impossible de valider la commande.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.outerContainer} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#101e0f" />
        
        {/* Header Unifié Hauteur Fixe 56px */}
        <View style={styles.header}>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Mon Panier & Paiement MoMo</Text>
            <Text style={styles.headerSubtitle}>MTN MoMo, Orange Money & Espèces GIC</Text>
          </View>

          <View style={styles.headerIcons}>
            {cart.length > 0 && (
              <TouchableOpacity style={styles.iconButton} onPress={handleClearCart}>
                <Feather name="trash-2" size={16} color="#d97834" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Panier list */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Articles du panier ({cart.length})</Text>
            {cart.length > 0 && (
              <TouchableOpacity onPress={handleClearCart}>
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
                <TouchableOpacity style={styles.browseBtn} onPress={() => router.replace('/(buyer)/home')}>
                  <Text style={styles.browseBtnText}>Explorer le Marché</Text>
                </TouchableOpacity>
              </View>
            ) : (
              cart.map((item) => (
                <View key={item.id} style={styles.listItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{item.name}</Text>
                    <Text style={styles.meta}>{item.quantity} {item.unit} × {item.price} FCFA/{item.unit}</Text>
                  </View>
                  <View style={styles.quantityControlRow}>
                    <TouchableOpacity style={styles.qtyPlusBtn} onPress={() => handleIncrement(item.productId)}>
                      <Feather name="plus" size={14} color="#f3ecd8" />
                    </TouchableOpacity>
                    <Text style={styles.itemTotal}>{(parseFloat(item.price || '0') * item.quantity).toLocaleString()} FCFA</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {cart.length > 0 && (
            <View style={styles.totalSummaryCard}>
              <Text style={styles.totalSummaryLabel}>Total de la commande</Text>
              <Text style={styles.totalSummaryValue}>{totalAmount.toLocaleString()} FCFA</Text>
            </View>
          )}

          {/* Operation type */}
          {cart.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Type de transaction</Text>
              {ORDER_TYPES.map((opt) => (
                <TouchableOpacity
                  key={opt.type}
                  style={[styles.typeCard, selectedType === opt.type && styles.typeCardActive]}
                  onPress={() => setSelectedType(opt.type)}
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

              {/* Payment Method selector */}
              <Text style={styles.sectionTitle}>Mode de paiement Mobile Money</Text>
              <View style={styles.paymentMethodRow}>
                <TouchableOpacity 
                  style={[styles.paymentBtn, paymentMethod === 'momo' && styles.paymentBtnActive]}
                  onPress={() => setPaymentMethod('momo')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.paymentEmoji}>💛</Text>
                  <Text style={[styles.paymentText, paymentMethod === 'momo' && styles.paymentTextActive]}>MTN MoMo</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.paymentBtn, paymentMethod === 'om' && styles.paymentBtnActive]}
                  onPress={() => setPaymentMethod('om')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.paymentEmoji}>🧡</Text>
                  <Text style={[styles.paymentText, paymentMethod === 'om' && styles.paymentTextActive]}>Orange Money</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.paymentBtn, paymentMethod === 'cash' && styles.paymentBtnActive]}
                  onPress={() => setPaymentMethod('cash')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.paymentEmoji}>💵</Text>
                  <Text style={[styles.paymentText, paymentMethod === 'cash' && styles.paymentTextActive]}>Espèces GIC</Text>
                </TouchableOpacity>
              </View>

              {/* Mobile phone number input */}
              <View style={styles.phoneSection}>
                <Text style={styles.inputLabel}>Numéro de téléphone pour la transaction</Text>
                <View style={styles.phoneInputRow}>
                  <Text style={styles.countryCode}>+237</Text>
                  <TextInput 
                    style={styles.phoneInput}
                    keyboardType="phone-pad"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    placeholder="6XX XXX XXX"
                    placeholderTextColor="#9ca49a"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.confirmBtn, (!cart.length || busy) && styles.confirmDisabled]}
                onPress={handleConfirm}
                disabled={!cart.length || busy}
                activeOpacity={0.85}
              >
                <Feather name="lock" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.confirmText}>
                  {busy ? 'Traitement en cours…' : `Valider et Payer (${totalAmount.toLocaleString()} FCFA)`}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
        </KeyboardAvoidingView>

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
  scroll: { padding: Spacing.four, gap: 10, paddingBottom: 90 },
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
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3ecd8',
  },
  itemTitle: { fontSize: 14, fontWeight: '800', color: '#101e0f' },
  meta: { fontSize: 11, color: '#5a6258', marginTop: 2, fontWeight: '600' },
  quantityControlRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyPlusBtn: { width: 26, height: 26, borderRadius: 8, backgroundColor: '#101e0f', alignItems: 'center', justifyContent: 'center' },
  itemTotal: { fontSize: 14, fontWeight: '900', color: '#d97834' },
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
  paymentMethodRow: { flexDirection: 'row', gap: 8 },
  paymentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6dfcc',
    borderRadius: 14,
    paddingVertical: 10,
  },
  paymentBtnActive: { borderColor: '#d97834', backgroundColor: '#fff7ed' },
  paymentEmoji: { fontSize: 20 },
  paymentText: { fontSize: 11, fontWeight: '700', color: '#5a6258' },
  paymentTextActive: { color: '#d97834', fontWeight: '800' },
  phoneSection: { marginTop: 4, gap: 6 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#101e0f' },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e6dfcc',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
  },
  countryCode: { fontSize: 14, fontWeight: '800', color: '#d97834', marginRight: 8 },
  phoneInput: { flex: 1, fontSize: 15, fontWeight: '700', color: '#101e0f' },
  confirmBtn: {
    marginTop: 10,
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
