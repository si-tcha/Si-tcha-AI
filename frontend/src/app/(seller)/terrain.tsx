import { Dimensions, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';
import {
  AgriProgramRecord,
  dbService,
  MarketPriceRecord,
  PhytoAlertRecord,
  WeatherRecord,
} from '@/services/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

type TabKey = 'meteo' | 'marche' | 'programmes' | 'phyto';

export default function SellerTerrainScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('meteo');
  const [weather, setWeather] = useState<WeatherRecord[]>([]);
  const [market, setMarket] = useState<MarketPriceRecord[]>([]);
  const [programs, setPrograms] = useState<AgriProgramRecord[]>([]);
  const [phyto, setPhyto] = useState<PhytoAlertRecord[]>([]);

  useEffect(() => {
    const load = async () => {
      await dbService.initDatabase();
      const [w, m, p, ph] = await Promise.all([
        dbService.getWeather(),
        dbService.getMarketPrices(),
        dbService.getAgriPrograms(),
        dbService.getPhytoAlerts(),
      ]);
      setWeather(w);
      setMarket(m);
      setPrograms(p);
      setPhyto(ph);
    };
    load();
  }, []);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'meteo', label: 'Météo' },
    { key: 'marche', label: 'Marché' },
    { key: 'programmes', label: 'Programmes' },
    { key: 'phyto', label: 'Phyto' },
  ];

  return (
    <SafeAreaView style={styles.outer}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f3ecd8" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Feather name="arrow-left" size={22} color="#101e0f" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Infos terrain</Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {tabs.map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tab, tab === t.key && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {tab === 'meteo' &&
            weather.map((w) => (
              <View key={w.id} style={styles.card}>
                <Text style={styles.cardTitle}>{w.bassin}</Text>
                <Text style={styles.meta}>{w.date}</Text>
                <Text style={styles.value}>{w.temperature} °C · {w.pluviometrie} mm</Text>
              </View>
            ))}

          {tab === 'marche' &&
            market.map((m) => (
              <View key={m.id} style={styles.card}>
                <Text style={styles.cardTitle}>{m.product}</Text>
                <Text style={styles.meta}>{m.bassin} · {m.date}</Text>
                <Text style={styles.value}>{m.prixMoyen} FCFA/kg</Text>
                <Text style={styles.meta}>Rentabilité estimée · {m.rentabilite}%</Text>
              </View>
            ))}

          {tab === 'programmes' &&
            programs.map((p) => (
              <View key={p.id} style={styles.card}>
                <Text style={styles.cardTitle}>{p.nom}</Text>
                <Text style={styles.meta}>{p.description}</Text>
                <Text style={styles.meta}>Éligibilité · {p.criteresEligibilite}</Text>
                <Text style={styles.value}>Limite · {p.dateLimite}</Text>
              </View>
            ))}

          {tab === 'phyto' &&
            (phyto.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.meta}>Aucune alerte phytosanitaire locale.</Text>
              </View>
            ) : (
              phyto.map((a) => (
                <View key={a.id} style={[styles.card, styles.alertCard]}>
                  <View style={styles.alertHeader}>
                    <Feather name="alert-triangle" size={16} color="#d97834" />
                    <Text style={styles.cardTitle}>{a.ravageurMaladie}</Text>
                  </View>
                  <Text style={styles.meta}>{a.bassin} · {a.dateEmission}</Text>
                  <Text style={styles.protocol}>{a.protocoleUrgence}</Text>
                </View>
              ))
            ))}
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
  tabs: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, gap: 8 },
  tab: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6dfcc',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tabActive: { backgroundColor: '#101e0f', borderColor: '#101e0f' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#5a6258' },
  tabTextActive: { color: '#f3ecd8' },
  scroll: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: 12 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    padding: Spacing.three,
    gap: 4,
  },
  alertCard: { borderColor: '#d97834', backgroundColor: '#fff8f1' },
  alertHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#101e0f' },
  meta: { fontSize: 12, color: '#5a6258', fontWeight: '600' },
  value: { fontSize: 14, fontWeight: '800', color: '#101e0f', marginTop: 4 },
  protocol: { fontSize: 13, color: '#101e0f', marginTop: 6, lineHeight: 18 },
});
