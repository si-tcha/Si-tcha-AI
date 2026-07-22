import { Dimensions, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';
import { AlertPreferences, dbService } from '@/services/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

const PRODUCT_OPTIONS = ['Tomates fraîches', 'Maïs jaune', 'Manioc frais', 'Poivrons rouges', 'Légumes', 'Céréales'];
const BASSIN_OPTIONS = ['Ouest', 'Centre', 'Nord', 'Littoral'];

export default function BuyerAlertsScreen() {
  const router = useRouter();
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
    setMatchCount(await dbService.getMatchingAlertCount());
    alert('Préférences d\'alertes sauvegardées.');
  };

  return (
    <SafeAreaView style={styles.outer}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f3ecd8" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Feather name="arrow-left" size={22} color="#101e0f" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Alertes produits</Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.infoCard}>
            <Feather name="bell" size={18} color="#d97834" />
            <Text style={styles.infoText}>
              {matchCount > 0
                ? `${matchCount} offre(s) correspondent à vos préférences (mock offline).`
                : 'Aucune offre ne correspond encore. Choisissez produits et bassins.'}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Produits / catégories</Text>
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
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>Bassins</Text>
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
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveText}>Enregistrer</Text>
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
  scroll: { padding: Spacing.four, gap: 12 },
  infoCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fff8f1',
    borderWidth: 1,
    borderColor: '#d97834',
    borderRadius: 14,
    padding: 12,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 12, color: '#101e0f', lineHeight: 18 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#101e0f' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6dfcc',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillActive: { backgroundColor: '#101e0f', borderColor: '#101e0f' },
  pillText: { fontSize: 12, fontWeight: '600', color: '#5a6258' },
  pillTextActive: { color: '#f3ecd8' },
  saveBtn: {
    marginTop: 8,
    backgroundColor: '#101e0f',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveText: { color: '#f3ecd8', fontWeight: '800' },
});
