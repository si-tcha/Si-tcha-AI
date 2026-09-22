import { Dimensions, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { dbService } from '@/services/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export default function SellerOrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      await dbService.initDatabase();
      const allOrders = await dbService.getOrders();
      setOrders(allOrders);
    } catch (err) {
      console.warn('Erreur de chargement des commandes GIC', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    try {
      await dbService.updateOrderStatus(orderId, 'confirmee');
      await loadOrders();
    } catch (err) {
      console.warn('Erreur validation commande:', err);
    }
  };

  return (
    <SafeAreaView style={styles.outerContainer}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#101e0f" />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color="#f3ecd8" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Commandes B2B</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.summaryLabel}>Total Commandes</Text>
                <Text style={styles.summaryVal}>{orders.length}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View>
                <Text style={styles.summaryLabel}>En Attente</Text>
                <Text style={[styles.summaryVal, { color: '#d97834' }]}>
                  {orders.filter(o => o.status === 'en_attente').length}
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Historique des commandes</Text>

          {isLoading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Chargement des commandes...</Text>
            </View>
          ) : orders.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="shopping-bag" size={32} color="#889e87" />
              <Text style={styles.emptyStateText}>Aucune commande trouvée pour vos produits.</Text>
            </View>
          ) : (
            orders.map(order => (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View style={styles.orderProductRow}>
                    <Feather name="package" size={16} color="#d97834" />
                    <Text style={styles.orderProduct}>{order.productName}</Text>
                  </View>
                  <View style={[styles.statusBadge, order.status === 'en_attente' ? styles.statusBadgePending : styles.statusBadgeConfirmed]}>
                    <Text style={[styles.statusText, order.status === 'en_attente' ? styles.statusTextPending : styles.statusTextConfirmed]}>
                      {order.status === 'en_attente' ? 'En Attente' : 'Confirmée'}
                    </Text>
                  </View>
                </View>

                <View style={styles.orderDetailsRow}>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>Acheteur</Text>
                    <Text style={styles.detailVal}>{order.buyerName}</Text>
                  </View>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>Volume</Text>
                    <Text style={styles.detailVal}>{order.quantity} {order.unit}</Text>
                  </View>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>Prix Proposé</Text>
                    <Text style={styles.detailVal}>{order.price} FCFA/kg</Text>
                  </View>
                </View>

                {order.status === 'en_attente' && (
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAcceptOrder(order.id)}>
                    <Text style={styles.acceptBtnText}>Valider la commande</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </ScrollView>
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
  summaryCard: { backgroundColor: '#101e0f', borderRadius: 16, padding: Spacing.four, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 11, color: '#889e87', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  summaryVal: { fontSize: 24, fontWeight: '900', color: '#f3ecd8' },
  summaryDivider: { width: 1, height: 40, backgroundColor: '#1d331b' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#101e0f', marginTop: Spacing.two },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 12 },
  emptyStateText: { fontSize: 13, color: '#5a6258', fontWeight: '600' },
  orderCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: Spacing.three, borderWidth: 1, borderColor: '#e6dfcc', gap: 12 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderProductRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderProduct: { fontSize: 15, fontWeight: '800', color: '#101e0f' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusBadgePending: { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#ffedd5' },
  statusBadgeConfirmed: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' },
  statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  statusTextPending: { color: '#ea580c' },
  statusTextConfirmed: { color: '#16a34a' },
  orderDetailsRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f3ecd8', borderRadius: 12, padding: Spacing.three },
  detailCol: { gap: 2 },
  detailLabel: { fontSize: 10, color: '#5a6258', fontWeight: '700', textTransform: 'uppercase' },
  detailVal: { fontSize: 13, fontWeight: '800', color: '#101e0f' },
  acceptBtn: {
    backgroundColor: '#15803d',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4
  },
  acceptBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13
  }
});
