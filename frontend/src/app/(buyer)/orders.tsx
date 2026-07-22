import { Dimensions, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';
import { dbService, OrderRecord } from '@/services/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

const TYPE_LABELS: Record<string, string> = {
  commande_ferme: 'Commande ferme',
  achat_direct: 'Achat direct',
  reservation: 'Réservation',
};

export default function BuyerOrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        await dbService.initDatabase();
        setOrders(await dbService.getOrders());
      };
      load();
    }, [])
  );

  return (
    <SafeAreaView style={styles.outer}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f3ecd8" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Feather name="arrow-left" size={22} color="#101e0f" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mes commandes</Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {orders.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="file-text" size={36} color="#889e87" />
              <Text style={styles.emptyText}>Aucune commande enregistrée.</Text>
            </View>
          ) : (
            orders.map((o) => (
              <View key={o.id} style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.title}>{o.productName}</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{o.status}</Text>
                  </View>
                </View>
                <Text style={styles.meta}>{TYPE_LABELS[o.type] ?? o.type}</Text>
                <Text style={styles.meta}>{o.gicName}</Text>
                <Text style={styles.value}>
                  {o.quantity} {o.unit} · {o.price} FCFA/{o.unit}
                </Text>
                <Text style={styles.meta}>
                  {new Date(o.createdAt).toLocaleString('fr-FR')}
                </Text>
              </View>
            ))
          )}
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
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 13, color: '#5a6258' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    padding: 14,
    gap: 4,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 14, fontWeight: '800', color: '#101e0f', flex: 1 },
  badge: {
    backgroundColor: '#889e8730',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#101e0f' },
  meta: { fontSize: 11, color: '#5a6258', fontWeight: '600' },
  value: { fontSize: 13, fontWeight: '800', color: '#d97834', marginTop: 2 },
});
