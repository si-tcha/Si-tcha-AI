import { Dimensions, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';
import { dbService, SyncResult } from '@/services/database';
import { BottomNavBar } from '@/components/ui/bottom-nav-bar';
import { useToast } from '@/components/ui/toast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export default function SellerSyncScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [role, setRole] = useState<'leader' | 'member'>('leader');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = async () => {
      await dbService.initDatabase();
      setRole(await dbService.getLocalRole());
      setLastSync(await dbService.getLastSyncAt());
    };
    load();
  }, []);

  const toggleRole = async () => {
    const next = role === 'leader' ? 'member' : 'leader';
    await dbService.setLocalRole(next);
    setRole(next);
    showToast({ message: `Rôle basculé en: ${next === 'leader' ? 'Leader GIC (Prioritaire)' : 'Membre'}`, type: 'info' });
  };

  const handleSync = async () => {
    setBusy(true);
    try {
      const syncResult = await dbService.runMockSync();
      setResult(syncResult);
      setLastSync(syncResult.lastSyncAt);
      showToast({ message: 'Synchronisation avec le cloud réussie !', type: 'success' });
    } catch (err) {
      console.warn(err);
      showToast({ message: 'Échec de la synchronisation.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.outer}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#101e0f" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Feather name="arrow-left" size={20} color="#f3ecd8" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Synchronisation Cloud</Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Card Status */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Feather name="cloud" size={18} color="#d97834" />
              <Text style={styles.cardTitle}>Synchronisation avec le Serveur</Text>
            </View>
            <Text style={styles.body}>
              Sauvegarde vos données locales (récoltes, dépenses, offres B2B) vers le cloud et télécharge les dernières mises à jour du marché. En cas d'absence de réseau, les données restent sur votre téléphone (Offline-first).
            </Text>
            <View style={styles.timeTag}>
              <Feather name="clock" size={12} color="#889e87" />
              <Text style={styles.meta}>
                Dernière synchro · {lastSync ? new Date(lastSync).toLocaleString('fr-FR') : 'Jamais'}
              </Text>
            </View>
          </View>

          {/* Toggle Role Device */}
          <View style={styles.card}>
            <Text style={styles.label}>Rôle configuré sur cet appareil</Text>
            <TouchableOpacity style={styles.roleBtn} onPress={toggleRole} activeOpacity={0.8}>
              <Feather name="shield" size={16} color="#d97834" />
              <Text style={styles.roleBtnText}>{role === 'leader' ? 'Leader GIC (Administrateur)' : 'Membre Producteur'}</Text>
            </TouchableOpacity>
          </View>

          {/* Trigger Sync button */}
          <TouchableOpacity
            style={[styles.syncBtn, busy && styles.syncBtnDisabled]}
            onPress={handleSync}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Feather name="refresh-cw" size={20} color="#ffffff" />
            <Text style={styles.syncBtnText}>{busy ? 'Synchronisation en cours...' : 'Lancer la Synchronisation'}</Text>
          </TouchableOpacity>

          {/* Result view */}
          {result && (
            <View style={styles.resultCard}>
              <View style={styles.cardTitleRow}>
                <Feather name="check-circle" size={18} color="#15803d" />
                <Text style={[styles.cardTitle, { color: '#15803d' }]}>Compte-Rendu de Synchro</Text>
              </View>
              <Text style={styles.body}>{result.summary}</Text>
              <View style={styles.resultMetricsRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricVal}>{result.mergedCount}</Text>
                  <Text style={styles.metricSub}>Données Fusionnées</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricVal}>OK</Text>
                  <Text style={styles.metricSub}>Statut Base Locale</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        <BottomNavBar role="seller" />
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
  scroll: { padding: Spacing.four, gap: Spacing.three },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    padding: Spacing.four,
    gap: 8,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#101e0f' },
  body: { fontSize: 13, color: '#5a6258', lineHeight: 19 },
  timeTag: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  meta: { fontSize: 11, color: '#889e87', fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '700', color: '#101e0f' },
  roleBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#101e0f',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  roleBtnText: { color: '#f3ecd8', fontWeight: '800', fontSize: 13 },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#d97834',
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: '#d97834',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  syncBtnDisabled: { opacity: 0.6 },
  syncBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  resultCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#bbf7d0',
    padding: Spacing.four,
    gap: 8,
  },
  resultMetricsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  metricItem: { alignItems: 'center' },
  metricVal: { fontSize: 20, fontWeight: '900', color: '#15803d' },
  metricSub: { fontSize: 11, color: '#166534', fontWeight: '600', marginTop: 2 },
});
