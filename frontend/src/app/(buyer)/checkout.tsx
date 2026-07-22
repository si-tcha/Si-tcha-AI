import { Dimensions, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';
import { CartItemRecord, dbService, OrderType } from '@/services/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

const ORDER_TYPES: { type: OrderType; label: string; hint: string }[] = [
  { type: 'commande_ferme', label: 'Commande ferme', hint: 'Engagement d\'achat confirmé' },
  { type: 'achat_direct', label: 'Achat direct', hint: 'Prise immédiate sur stock dispo' },
  { type: 'reservation', label: 'Bon de réservation', hint: 'Sécurise une récolte future' },
];

export default function BuyerCheckoutScreen() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItemRecord[]>([]);
  const [selectedType, setSelectedType] = useState<OrderType>('reservation');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = async () => {
      await dbService.initDatabase();
      setCart(await dbService.getCart());
    };
    load();
  }, []);

  const handleConfirm = async () => {
    if (!cart.length) {
      alert('Panier vide.');
      return;
    }
    setBusy(true);
    try {
      await dbService.createOrderFromCart(selectedType);
      alert('Commande enregistrée localement.');
      router.replace('/(buyer)/orders');
    } catch (err) {
      console.warn(err);
      alert('Impossible de créer la commande.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.outer}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f3ecd8" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Feather name="arrow-left" size={22} color="#101e0f" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Finaliser</Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Panier</Text>
          <View style={styles.listCard}>
            {cart.length === 0 ? (
              <View style={styles.listItem}>
                <Text style={styles.meta}>Aucun article.</Text>
              </View>
            ) : (
              cart.map((item) => (
                <View key={item.id} style={styles.listItem}>
                  <View>
                    <Text style={styles.itemTitle}>{item.name}</Text>
                    <Text style={styles.meta}>{item.quantity} × {item.price} FCFA/{item.unit}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          <Text style={styles.sectionTitle}>Type d'opération</Text>
          {ORDER_TYPES.map((opt) => (
            <TouchableOpacity
              key={opt.type}
              style={[styles.typeCard, selectedType === opt.type && styles.typeCardActive]}
              onPress={() => setSelectedType(opt.type)}
            >
              <Text style={[styles.typeLabel, selectedType === opt.type && styles.typeLabelActive]}>
                {opt.label}
              </Text>
              <Text style={[styles.meta, selectedType === opt.type && { color: '#e6dfcc' }]}>
                {opt.hint}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.confirmBtn, (!cart.length || busy) && styles.confirmDisabled]}
            onPress={handleConfirm}
            disabled={!cart.length || busy}
          >
            <Text style={styles.confirmText}>
              {busy ? 'Enregistrement…' : 'Confirmer'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: isWeb ? '#e6dfcc' : '#f3ecd8', alignItems: 'center' },
  container: { width: CONTAINER_WIDTH, height: '100%', backgroundColor: '#f3ecd8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#e6dfcc',
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#101e0f' },
  scroll: { padding: Spacing.four, gap: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#101e0f', marginTop: 6 },
  listCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    overflow: 'hidden',
  },
  listItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3ecd8',
  },
  itemTitle: { fontSize: 14, fontWeight: '700', color: '#101e0f' },
  meta: { fontSize: 12, color: '#5a6258', marginTop: 2 },
  typeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    padding: 14,
    gap: 4,
  },
  typeCardActive: { backgroundColor: '#101e0f', borderColor: '#101e0f' },
  typeLabel: { fontSize: 14, fontWeight: '800', color: '#101e0f' },
  typeLabelActive: { color: '#f3ecd8' },
  confirmBtn: {
    marginTop: 12,
    backgroundColor: '#d97834',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmDisabled: { opacity: 0.5 },
  confirmText: { color: '#f3ecd8', fontWeight: '800', fontSize: 15 },
});
