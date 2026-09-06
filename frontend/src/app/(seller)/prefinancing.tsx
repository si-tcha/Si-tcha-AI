import { Dimensions, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { dbService, PrefinancingDeal } from '@/services/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export default function SellerPrefinancingScreen() {
  const router = useRouter();
  const [deals, setDeals] = useState<PrefinancingDeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDeals();
  }, []);

  const loadDeals = async () => {
    try {
      setIsLoading(true);
      await dbService.initDatabase();
      const data = await dbService.getPrefinancingDeals();
      setDeals(data);
    } catch (err) {
      console.warn('Erreur de chargement des offres de préfinancement', err);
    } finally {
      setIsLoading(false);
    }
  };

  const totalAmount = deals.reduce((acc, deal) => acc + deal.amountFcfa, 0);

  return (
    <SafeAreaView style={styles.outerContainer}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#101e0f" />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color="#f3ecd8" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Préfinancement</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <Feather name="briefcase" size={20} color="#d97834" />
              <Text style={styles.heroTitle}>Propositions Reçues</Text>
            </View>
            <Text style={styles.heroAmount}>{totalAmount.toLocaleString()} FCFA</Text>
            <Text style={styles.heroSub}>Total des financements proposés</Text>
          </View>

          <Text style={styles.sectionTitle}>Détails des offres ({deals.length})</Text>

          {isLoading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Chargement des offres...</Text>
            </View>
          ) : deals.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="inbox" size={32} color="#889e87" />
              <Text style={styles.emptyStateText}>Aucune offre de préfinancement reçue.</Text>
            </View>
          ) : (
            deals.map(deal => (
              <View key={deal.id} style={styles.dealCard}>
                <View style={styles.dealHeader}>
                  <View style={styles.dealBuyerInfo}>
                    <View style={styles.dealBuyerAvatar}>
                      <Feather name="user" size={14} color="#f3ecd8" />
                    </View>
                    <Text style={styles.dealBuyerName}>{deal.buyerName || 'Acheteur Anonyme'}</Text>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    deal.status === 'accepte' ? styles.statusBadgeSuccess : ((deal.status as string) === 'refuse' ? styles.statusBadgeDanger : {})
                  ]}>
                    <Text style={[
                      styles.statusText,
                      deal.status === 'accepte' ? styles.statusTextSuccess : ((deal.status as string) === 'refuse' ? styles.statusTextDanger : {})
                    ]}>
                      {deal.status === 'propose' ? 'Nouveau' : (deal.status === 'accepte' ? 'Accepté' : 'Refusé')}
                    </Text>
                  </View>
                </View>

                <View style={styles.dealAmountRow}>
                  <Text style={styles.dealAmountLabel}>Financement proposé</Text>
                  <Text style={styles.dealAmountVal}>{deal.amountFcfa.toLocaleString()} FCFA</Text>
                </View>

                <View style={styles.dealDivider} />

                <View style={styles.dealConditions}>
                  <Text style={styles.conditionTitle}>Contrepartie attendue :</Text>
                  <View style={styles.conditionRow}>
                    <Feather name="package" size={14} color="#101e0f" />
                    <Text style={styles.conditionText}>{deal.reservedVolumeKg} kg de {deal.reservedProduct}</Text>
                  </View>
                  <View style={styles.conditionRow}>
                    <Feather name="info" size={14} color="#101e0f" />
                    <Text style={styles.conditionText}>Pour: {deal.inputDescription}</Text>
                  </View>
                </View>

                {deal.status === 'propose' && (
                  <View style={styles.dealActions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}
                      onPress={async () => {
                        await dbService.updatePrefinancingDealStatus(deal.id, 'refuse');
                        loadDeals();
                      }}
                    >
                      <Text style={styles.actionBtnText}>Refuser</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#15803d' }]}
                      onPress={async () => {
                        await dbService.updatePrefinancingDealStatus(deal.id, 'accepte');
                        loadDeals();
                      }}
                    >
                      <Text style={styles.actionBtnText}>Accepter</Text>
                    </TouchableOpacity>
                  </View>
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
  heroCard: { backgroundColor: '#101e0f', borderRadius: 20, padding: Spacing.five, alignItems: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  heroHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroTitle: { fontSize: 13, color: '#889e87', fontWeight: '700', textTransform: 'uppercase' },
  heroAmount: { fontSize: 32, fontWeight: '900', color: '#f3ecd8' },
  heroSub: { fontSize: 12, color: '#889e87', fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#101e0f', marginTop: Spacing.two },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 12 },
  emptyStateText: { fontSize: 13, color: '#5a6258', fontWeight: '600' },
  dealCard: { backgroundColor: '#ffffff', borderRadius: 18, padding: Spacing.four, borderWidth: 1, borderColor: '#e6dfcc', gap: 12 },
  dealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  dealBuyerInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  dealBuyerAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1d331b', justifyContent: 'center', alignItems: 'center' },
  dealBuyerName: { fontSize: 14, fontWeight: '800', color: '#101e0f' },
  statusBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#fde68a' },
  statusText: { color: '#d97706', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  statusBadgeSuccess: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  statusTextSuccess: { color: '#15803d' },
  statusBadgeDanger: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  statusTextDanger: { color: '#ef4444' },
  dealAmountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0fdf4', padding: Spacing.three, borderRadius: 12, borderWidth: 1, borderColor: '#bbf7d0' },
  dealAmountLabel: { fontSize: 11, color: '#15803d', fontWeight: '700', textTransform: 'uppercase' },
  dealAmountVal: { fontSize: 16, fontWeight: '900', color: '#15803d' },
  dealDivider: { height: 1, backgroundColor: '#e6dfcc' },
  dealConditions: { gap: 6 },
  conditionTitle: { fontSize: 12, fontWeight: '700', color: '#5a6258' },
  conditionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  conditionText: { fontSize: 12, color: '#101e0f', flexShrink: 1 },
  dealActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' }
});
