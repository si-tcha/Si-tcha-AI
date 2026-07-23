import { Dimensions, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';
import { CartItemRecord, dbService, OrderType } from '@/services/database';
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
  const [cart, setCart] = useState<CartItemRecord[]>([]);
  const [selectedType, setSelectedType] = useState<OrderType>('reservation');
  const [paymentMethod, setPaymentMethod] = useState<'momo' | 'om' | 'cash'>('momo');
  const [phoneNumber, setPhoneNumber] = useState('677000000');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = async () => {
      await dbService.initDatabase();
      setCart(await dbService.getCart());
    };
    load();
  }, []);

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
    <SafeAreaView style={styles.outer}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#101e0f" />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Feather name="arrow-left" size={20} color="#f3ecd8" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Panier & Paiement MoMo</Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Panier list */}
          <Text style={styles.sectionTitle}>Articles du panier ({cart.length})</Text>
          <View style={styles.listCard}>
            {cart.length === 0 ? (
              <View style={styles.emptyItem}>
                <Feather name="shopping-cart" size={32} color="#889e87" />
                <Text style={styles.meta}>Aucun article dans le panier.</Text>
              </View>
            ) : (
              cart.map((item) => (
                <View key={item.id} style={styles.listItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{item.name}</Text>
                    <Text style={styles.meta}>{item.quantity} {item.unit} × {item.price} FCFA/{item.unit}</Text>
                  </View>
                  <Text style={styles.itemTotal}>{(parseFloat(item.price || '0') * item.quantity).toLocaleString()} FCFA</Text>
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
        </ScrollView>

        <BottomNavBar role="buyer" cartCount={cart.length} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#101e0f', alignItems: 'center' },
  container: { width: CONTAINER_WIDTH, height: '100%', backgroundColor: '#f3ecd8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    backgroundColor: '#101e0f',
    borderBottomWidth: 1,
    borderBottomColor: '#1d331b',
  },
  iconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#1d331b', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#f3ecd8' },
  scroll: { padding: Spacing.four, gap: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#101e0f', marginTop: 4 },
  listCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    overflow: 'hidden',
  },
  emptyItem: { padding: 30, alignItems: 'center', gap: 8 },
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
