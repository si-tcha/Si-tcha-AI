import { Dimensions, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';
import {
  AgriProgramRecord,
  dbService,
  MarketPriceRecord,
  PhytoAlertRecord,
  WeatherRecord,
  ParcelGrowthRecord,
} from '@/services/database';
import { BottomNavBar } from '@/components/ui/bottom-nav-bar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

type TabKey = 'parcelles' | 'meteo' | 'marche' | 'programmes' | 'phyto';

export default function SellerTerrainScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('parcelles');
  const [weather, setWeather] = useState<WeatherRecord[]>([]);
  const [market, setMarket] = useState<MarketPriceRecord[]>([]);
  const [programs, setPrograms] = useState<AgriProgramRecord[]>([]);
  const [phyto, setPhyto] = useState<PhytoAlertRecord[]>([]);
  const [parcels, setParcels] = useState<ParcelGrowthRecord[]>([]);

  const loadTerrainData = useCallback(async () => {
    try {
      await dbService.initDatabase();
      await dbService.syncRemoteData().catch(() => {});
      const [w, m, p, ph, par] = await Promise.all([
        dbService.getWeather(),
        dbService.getMarketPrices(),
        dbService.getAgriPrograms(),
        dbService.getPhytoAlerts(),
        dbService.getParcels(),
      ]);
      setWeather(w);
      setMarket(m);
      setPrograms(p);
      setPhyto(ph);
      setParcels(par);
    } catch (err) {
      console.warn('Erreur chargement terrain:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTerrainData();
    }, [loadTerrainData])
  );

  const tabs: { key: TabKey; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: 'parcelles', label: 'SIG Parcelles', icon: 'map-pin' },
    { key: 'meteo', label: 'Météo 5J', icon: 'cloud-rain' },
    { key: 'marche', label: 'Cours Marché', icon: 'trending-up' },
    { key: 'programmes', label: 'Aides GIC', icon: 'award' },
    { key: 'phyto', label: 'Alerte Phyto', icon: 'alert-circle' },
  ];

  return (
    <SafeAreaView style={styles.outer}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#101e0f" />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Feather name="arrow-left" size={20} color="#f3ecd8" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>SIG & Données Terrain</Text>
          <TouchableOpacity onPress={() => setTab('parcelles')} style={styles.iconBtn}>
            <Feather name="map" size={20} color="#d97834" />
          </TouchableOpacity>
        </View>

        {/* Tab selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {tabs.map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tab, tab === t.key && styles.tabActive]}
            >
              <Feather name={t.icon} size={14} color={tab === t.key ? '#ffffff' : '#5a6258'} />
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {tab === 'parcelles' && (
            <View style={styles.tabSection}>
              {/* Carte SIMULEE SIG */}
              <View style={styles.mapCard}>
                <View style={styles.mapHeader}>
                  <View style={styles.mapTitleRow}>
                    <Feather name="globe" size={16} color="#d97834" />
                    <Text style={styles.mapTitle}>Parcelle GIC Bafoussam - Zone A</Text>
                  </View>
                  <Text style={styles.mapCoords}>5°28'N 10°25'E</Text>
                </View>

                {/* Satellite representation box */}
                <View style={styles.satelliteBox}>
                  {parcels.length > 0 ? parcels.map((parcel, idx) => (
                    <View key={parcel.id} style={[styles.parcelOverlay, idx % 2 !== 0 && { borderColor: '#d97834', backgroundColor: 'rgba(217,120,52,0.15)' }]}>
                      <Text style={styles.parcelLabel}>{parcel.parcelName}: {parcel.crop} ({parcel.estimatedVolumeKg} kg attendus)</Text>
                      <Text style={styles.parcelStatus}>Stade: {parcel.stage} · Récolte prévue: {parcel.estimatedHarvestDate}</Text>
                    </View>
                  )) : (
                    <View style={styles.parcelOverlay}>
                      <Text style={styles.parcelLabel}>Aucune parcelle synchronisée</Text>
                      <Text style={styles.parcelStatus}>Ajoutez vos parcelles dans Suivi des Cultures</Text>
                    </View>
                  )}
                </View>

                <View style={styles.sigStatsRow}>
                  <View style={styles.sigStatCol}>
                    <Text style={styles.sigStatVal}>2.5 Ha</Text>
                    <Text style={styles.sigStatLabel}>Surface totale</Text>
                  </View>
                  <View style={styles.sigDivider} />
                  <View style={styles.sigStatCol}>
                    <Text style={styles.sigStatVal}>6.2 pH</Text>
                    <Text style={styles.sigStatLabel}>Acidité sol</Text>
                  </View>
                  <View style={styles.sigDivider} />
                  <View style={styles.sigStatCol}>
                    <Text style={styles.sigStatVal}>48 mm</Text>
                    <Text style={styles.sigStatLabel}>Pluie / 7j</Text>
                  </View>
                </View>
              </View>

              {/* Drone / Field inspection banner */}
              <View style={styles.fieldCard}>
                <Feather name="aperture" size={20} color="#15803d" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldTitle}>Dernier Relevé GPS & Sol</Text>
                  <Text style={styles.fieldSub}>Coordonnées vérifiées par l'agent de terrain SI-TCHA il y a 2 jours.</Text>
                </View>
              </View>
            </View>
          )}

          {tab === 'meteo' &&
            (weather.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.meta}>Aucune donnée météorologique disponible.</Text>
              </View>
            ) : (
              weather.map((w) => (
                <View key={w.id} style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>{w.bassin}</Text>
                    <Text style={styles.badgeDate}>{w.date}</Text>
                  </View>
                  {w.description && <Text style={{ color: '#5a6258', marginBottom: 12, textTransform: 'capitalize' }}>{w.description}</Text>}
                  <View style={styles.weatherMetricsRow}>
                    <View style={styles.wMetric}>
                      <Feather name="thermometer" size={18} color="#d97834" />
                      <Text style={styles.wVal}>{w.temperature} °C</Text>
                      <Text style={styles.wSub}>Température</Text>
                    </View>
                    <View style={styles.wMetric}>
                      <Feather name="cloud-rain" size={18} color="#0284c7" />
                      <Text style={styles.wVal}>{w.humidity !== undefined ? w.humidity + ' %' : w.pluviometrie + ' mm'}</Text>
                      <Text style={styles.wSub}>{w.humidity !== undefined ? 'Humidité' : 'Pluviométrie'}</Text>
                    </View>
                  </View>
                </View>
              ))
            ))}

          {tab === 'marche' &&
            (market.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.meta}>Aucune donnée de marché disponible pour le moment.</Text>
              </View>
            ) : (
              market.map((m) => (
                <View key={m.id} style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>{m.product}</Text>
                    <View style={styles.rentaBadge}>
                      <Text style={styles.rentaBadgeText}>Rentabilité +{m.rentabilite}%</Text>
                    </View>
                  </View>
                  <Text style={styles.meta}>Bassin: {m.bassin} · {m.date}</Text>
                  <Text style={styles.priceHighlight}>{m.prixMoyen} FCFA / kg</Text>
                </View>
              ))
            ))}

          {tab === 'programmes' &&
            (programs.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.meta}>Aucun programme d'aide disponible pour le moment.</Text>
              </View>
            ) : (
              programs.map((p) => (
                <View key={p.id} style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>{p.nom}</Text>
                    <Feather name="award" size={18} color="#d97834" />
                  </View>
                  <Text style={styles.meta}>{p.description}</Text>
                  <View style={styles.eligibilityBox}>
                    <Text style={styles.eligibilityText}>Critères : {p.criteresEligibilite}</Text>
                  </View>
                  <Text style={styles.dateLimit}>Date Limite : {p.dateLimite}</Text>
                </View>
              ))
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
                    <Feather name="alert-triangle" size={18} color="#d97834" />
                    <Text style={styles.cardTitle}>{a.ravageurMaladie}</Text>
                  </View>
                  <Text style={styles.meta}>{a.bassin} · {a.dateEmission}</Text>
                  <View style={styles.protocolBox}>
                    <Text style={styles.protocolTitle}>Protocole d'Urgence :</Text>
                    <Text style={styles.protocol}>{a.protocoleUrgence}</Text>
                  </View>
                </View>
              ))
            ))}
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
  iconBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#1d331b', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#f3ecd8' },
  tabs: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, gap: 8 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6dfcc',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabActive: { backgroundColor: '#101e0f', borderColor: '#101e0f' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#5a6258' },
  tabTextActive: { color: '#f3ecd8' },
  scroll: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: 12 },
  tabSection: { gap: 12 },
  mapCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#e6dfcc',
    padding: Spacing.four,
    gap: 12,
  },
  mapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mapTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mapTitle: { fontSize: 13, fontWeight: '800', color: '#101e0f' },
  mapCoords: { fontSize: 11, color: '#889e87', fontWeight: '600' },
  satelliteBox: {
    height: 140,
    backgroundColor: '#182b17',
    borderRadius: 16,
    padding: 12,
    justifyContent: 'space-around',
    overflow: 'hidden',
  },
  parcelOverlay: {
    borderWidth: 1.5,
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderRadius: 10,
    padding: 8,
  },
  parcelLabel: { fontSize: 11, fontWeight: '800', color: '#ffffff' },
  parcelStatus: { fontSize: 10, color: '#f3ecd8', marginTop: 2 },
  sigStatsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingTop: 6 },
  sigStatCol: { alignItems: 'center', gap: 2 },
  sigStatVal: { fontSize: 14, fontWeight: '800', color: '#101e0f' },
  sigStatLabel: { fontSize: 10, color: '#5a6258', fontWeight: '600' },
  sigDivider: { width: 1, height: 25, backgroundColor: '#e6dfcc' },
  fieldCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 16,
    padding: 14,
  },
  fieldTitle: { fontSize: 13, fontWeight: '800', color: '#15803d' },
  fieldSub: { fontSize: 11, color: '#166534', marginTop: 2, lineHeight: 16 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    padding: Spacing.three,
    gap: 6,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#101e0f' },
  badgeDate: { fontSize: 11, color: '#5a6258', fontWeight: '600' },
  weatherMetricsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  wMetric: { alignItems: 'center', gap: 4 },
  wVal: { fontSize: 16, fontWeight: '800', color: '#101e0f' },
  wSub: { fontSize: 11, color: '#5a6258' },
  rentaBadge: { backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  rentaBadgeText: { fontSize: 11, fontWeight: '800', color: '#15803d' },
  meta: { fontSize: 12, color: '#5a6258', fontWeight: '500' },
  priceHighlight: { fontSize: 18, fontWeight: '900', color: '#d97834', marginTop: 4 },
  eligibilityBox: { backgroundColor: '#f3ecd8', padding: 8, borderRadius: 8, marginTop: 4 },
  eligibilityText: { fontSize: 11, color: '#101e0f', fontWeight: '600' },
  dateLimit: { fontSize: 11, fontWeight: '700', color: '#d97834', marginTop: 4 },
  alertCard: { borderColor: '#d97834', backgroundColor: '#fff7ed' },
  alertHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  protocolBox: { backgroundColor: '#ffffff', padding: 10, borderRadius: 10, marginTop: 6 },
  protocolTitle: { fontSize: 11, fontWeight: '800', color: '#d97834' },
  protocol: { fontSize: 12, color: '#101e0f', marginTop: 4, lineHeight: 18 },
});
