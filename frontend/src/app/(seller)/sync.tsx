import { Dimensions, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';
import { dbService, SyncResult } from '@/services/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export default function SellerSyncScreen() {
  const router = useRouter();
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
  };

  const handleSync = async () => {
    setBusy(true);
    try {
      const syncResult = await dbService.runMockSync();
      setResult(syncResult);
      setLastSync(syncResult.lastSyncAt);
    } catch (err) {
      console.warn(err);
      alert('Échec de la synchronisation mock.');
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
          <Text style={styles.headerTitle}>Sync locale</Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mode Xender (mock)</Text>
            <Text style={styles.body}>
              Compare les horodatages locaux avec un appareil pair. En conflit sur une même donnée, la
              saisie du Leader GIC prévaut automatiquement.
            </Text>
            <Text style={styles.meta}>
              Dernière sync · {lastSync ? new Date(lastSync).toLocaleString('fr-FR') : 'Jamais'}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Rôle de cet appareil (test conflits)</Text>
            <TouchableOpacity style={styles.roleBtn} onPress={toggleRole}>
              <Feather name="shield" size={16} color="#f3ecd8" />
              <Text style={styles.roleBtnText}>{role === 'leader' ? 'Leader GIC' : 'Membre'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.syncBtn, busy && styles.syncBtnDisabled]}
            onPress={handleSync}
            disabled={busy}
          >
            <Feather name="refresh-cw" size={18} color="#f3ecd8" />
            <Text style={styles.syncBtnText}>{busy ? 'Synchronisation…' : 'Lancer la sync'}</Text>
          </TouchableOpacity>

          {result && (
            <View style={styles.resultCard}>
              <Text style={styles.cardTitle}>Résultat</Text>
              <Text style={styles.body}>{result.summary}</Text>
              <Text style={styles.meta}>Fusionnés · {result.mergedCount}</Text>
              <Text style={styles.meta}>Conflits Leader · {result.conflictsResolvedByLeader}</Text>
            </View>
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
  scroll: { padding: Spacing.four, gap: Spacing.three },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    padding: Spacing.four,
    gap: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#101e0f' },
  body: { fontSize: 13, color: '#5a6258', lineHeight: 19 },
  meta: { fontSize: 12, color: '#5a6258', fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '700', color: '#101e0f' },
  roleBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#101e0f',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  roleBtnText: { color: '#f3ecd8', fontWeight: '700' },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#d97834',
    borderRadius: 16,
    paddingVertical: 16,
  },
  syncBtnDisabled: { opacity: 0.6 },
  syncBtnText: { color: '#f3ecd8', fontWeight: '800', fontSize: 15 },
  resultCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#889e87',
    padding: Spacing.four,
    gap: 6,
  },
});
