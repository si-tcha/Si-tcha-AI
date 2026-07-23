import { Dimensions, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';
import { AlertPreferences, dbService } from '@/services/database';
import { BottomNavBar } from '@/components/ui/bottom-nav-bar';
import { useToast } from '@/components/ui/toast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

const PRODUCT_OPTIONS = ['Tomates fraîches', 'Maïs jaune', 'Manioc frais', 'Poivrons rouges', 'Légumes', 'Céréales'];
const BASSIN_OPTIONS = ['Ouest', 'Centre', 'Nord', 'Littoral'];

export default function BuyerAlertsScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [prefs, setPrefs] = useState<AlertPreferences>({ productNames: [], bassins: [] });
  const [matchCount, setMatchCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      await dbService.initDatabase();
      const stored = await dbService.getAlertPreferences();
      setPrefs(stored);
      setMatchCount(await dbService.getMatchingAlertCount());
    };
    load();
  }, []);

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const handleSave = async () => {
    await dbService.saveAlertPreferences(prefs);
    const updatedCount = await dbService.getMatchingAlertCount();
    setMatchCount(updatedCount);
    showToast({ message: 'Préférences d\'alertes sauvegardées !', type: 'success' });
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
          <Text style={styles.headerTitle}>Centre d'Alertes Récoltes</Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.infoCard}>
            <View style={styles.alertIconBg}>
              <Feather name="bell" size={20} color="#d97834" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Notifications Disponibilité</Text>
              <Text style={styles.infoText}>
                {matchCount > 0
                  ? `${matchCount} récolte(s) correspondent actuellement à vos critères.`
                  : 'Sélectionnez vos produits et bassins pour recevoir des alertes instantanées.'}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Produits & Catégories surveillés</Text>
          <View style={styles.pills}>
            {PRODUCT_OPTIONS.map((name) => {
              const active = prefs.productNames.includes(name);
              return (
                <TouchableOpacity
                  key={name}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() =>
                    setPrefs((p) => ({ ...p, productNames: toggle(p.productNames, name) }))
                  }
                  activeOpacity={0.8}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{active ? `✓ ${name}` : name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>Bassins de Production</Text>
          <View style={styles.pills}>
            {BASSIN_OPTIONS.map((name) => {
              const active = prefs.bassins.includes(name);
              return (
                <TouchableOpacity
                  key={name}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() =>
                    setPrefs((p) => ({ ...p, bassins: toggle(p.bassins, name) }))
                  }
                  activeOpacity={0.8}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{active ? `✓ ${name}` : name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Feather name="check" size={18} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.saveText}>Enregistrer mes Préférences</Text>
          </TouchableOpacity>
        </ScrollView>

        <BottomNavBar role="buyer" alertCount={matchCount} />
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
  scroll: { padding: Spacing.four, gap: 14 },
  infoCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6dfcc',
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
  },
  alertIconBg: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  infoTitle: { fontSize: 13, fontWeight: '800', color: '#101e0f' },
  infoText: { fontSize: 11, color: '#5a6258', lineHeight: 16, marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#101e0f', marginTop: 4 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6dfcc',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  pillActive: { backgroundColor: '#101e0f', borderColor: '#101e0f' },
  pillText: { fontSize: 12, fontWeight: '700', color: '#5a6258' },
  pillTextActive: { color: '#f3ecd8' },
  saveBtn: {
    marginTop: 12,
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
  saveText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
});
