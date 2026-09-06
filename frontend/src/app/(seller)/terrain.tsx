import { Dimensions, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React, { useCallback, useState } from 'react';
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

/* ─── Stage progress helpers ─── */
const STAGE_ORDER = ['Semis', 'Levée', 'Floraison', 'Maturation', 'Prêt à récolter'] as const;
const stageIndex = (s: string) => { const i = STAGE_ORDER.indexOf(s as any); return i >= 0 ? i : 0; };
const STAGE_COLOR = ['#889e87', '#22c55e', '#d97834', '#d97834', '#15803d'];

/* ─── Weather icon mapper ─── */
const weatherIcon = (desc?: string): keyof typeof Feather.glyphMap => {
  if (!desc) return 'cloud';
  const d = desc.toLowerCase();
  if (d.includes('pluie') || d.includes('rain')) return 'cloud-rain';
  if (d.includes('orage') || d.includes('thunder')) return 'cloud-lightning';
  if (d.includes('nuag') || d.includes('cloud') || d.includes('couvert')) return 'cloud';
  if (d.includes('soleil') || d.includes('sun') || d.includes('clear') || d.includes('clair') || d.includes('dégagé')) return 'sun';
  if (d.includes('brume') || d.includes('brouillard') || d.includes('fog')) return 'cloud-drizzle';
  return 'cloud';
};

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

  const tabs: { key: TabKey; label: string; icon: keyof typeof Feather.glyphMap; count?: number }[] = [
    { key: 'parcelles', label: 'SIG Parcelles', icon: 'map-pin', count: parcels.length },
    { key: 'meteo', label: 'Météo 5J', icon: 'cloud-rain', count: weather.length },
    { key: 'marche', label: 'Cours Marché', icon: 'trending-up', count: market.length },
    { key: 'programmes', label: 'Aides GIC', icon: 'award', count: programs.length },
    { key: 'phyto', label: 'Alerte Phyto', icon: 'alert-circle', count: phyto.length },
  ];

  /* ─── SIG stats computed ─── */
  const totalEstimatedKg = parcels.reduce((s, p) => s + (p.estimatedVolumeKg || 0), 0);
  const activeStages = new Set(parcels.map(p => p.stage)).size;

  return (
    <SafeAreaView style={styles.outer}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#101e0f" />

        {/* ─── Header ─── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Feather name="arrow-left" size={20} color="#f3ecd8" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>SIG & Terrain</Text>
            <Text style={styles.headerSub}>Données agro-climatiques</Text>
          </View>
          <TouchableOpacity onPress={() => setTab('parcelles')} style={styles.iconBtn}>
            <Feather name="map" size={20} color="#d97834" />
          </TouchableOpacity>
        </View>

        {/* ─── Tab selector ─── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={styles.tabs}>
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[styles.tab, active && styles.tabActive]}
                activeOpacity={0.7}
              >
                <Feather name={t.icon} size={14} color={active ? '#ffffff' : '#5a6258'} />
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
                {(t.count ?? 0) > 0 && (
                  <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>{t.count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* ═══════════════ PARCELLES SIG ═══════════════ */}
          {tab === 'parcelles' && (
            <View style={styles.tabSection}>

              {/* Section title */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <View style={styles.sectionDot} />
                  <Text style={styles.sectionTitle}>Vue Satellite des Parcelles</Text>
                </View>
                <Text style={styles.sectionCount}>{parcels.length} parcelle{parcels.length !== 1 ? 's' : ''}</Text>
              </View>

              {/* Satellite Map Card */}
              <View style={styles.mapCard}>
                <View style={styles.mapHeader}>
                  <View style={styles.mapTitleRow}>
                    <View style={styles.mapIconCircle}>
                      <Feather name="globe" size={14} color="#ffffff" />
                    </View>
                    <View>
                      <Text style={styles.mapTitle}>Parcelle GIC Bafoussam - Zone A</Text>
                      <Text style={styles.mapCoords}>5°28'N  10°25'E  ·  Alt. 1 450 m</Text>
                    </View>
                  </View>
                  <View style={styles.liveIndicator}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>SIG</Text>
                  </View>
                </View>

                {/* Satellite representation */}
                <View style={styles.satelliteBox}>
                  {/* Grid overlay for topographic feel */}
                  <View style={styles.gridOverlay}>
                    {[0, 1, 2, 3].map(i => (
                      <View key={`h${i}`} style={[styles.gridLineH, { top: `${25 * (i + 1)}%` as any }]} />
                    ))}
                    {[0, 1, 2].map(i => (
                      <View key={`v${i}`} style={[styles.gridLineV, { left: `${33 * (i + 1)}%` as any }]} />
                    ))}
                  </View>

                  {parcels.length > 0 ? parcels.map((parcel, idx) => {
                    const si = stageIndex(parcel.stage);
                    const color = STAGE_COLOR[si];
                    return (
                      <View
                        key={parcel.id}
                        style={[
                          styles.parcelOverlay,
                          { borderColor: color, backgroundColor: `${color}20` },
                        ]}
                      >
                        <View style={styles.parcelRow}>
                          <View style={[styles.parcelStageDot, { backgroundColor: color }]} />
                          <Text style={styles.parcelLabel} numberOfLines={1}>
                            {parcel.parcelName}: {parcel.crop}
                          </Text>
                          <Text style={styles.parcelKg}>{parcel.estimatedVolumeKg} kg</Text>
                        </View>
                        <View style={styles.parcelSubRow}>
                          <Text style={styles.parcelStatus}>
                            {parcel.stage} · {parcel.estimatedHarvestDate}
                          </Text>
                        </View>
                      </View>
                    );
                  }) : (
                    <View style={styles.emptyParcel}>
                      <Feather name="layers" size={24} color="#889e87" />
                      <Text style={styles.emptyText}>Aucune parcelle synchronisée</Text>
                      <Text style={styles.emptySubText}>Ajoutez vos parcelles dans Suivi des Cultures</Text>
                    </View>
                  )}
                </View>

                {/* Stats row */}
                <View style={styles.sigStatsRow}>
                  <View style={styles.sigStatItem}>
                    <Feather name="maximize" size={14} color="#d97834" />
                    <Text style={styles.sigStatVal}>2.5 Ha</Text>
                    <Text style={styles.sigStatLabel}>Surface</Text>
                  </View>
                  <View style={styles.sigDivider} />
                  <View style={styles.sigStatItem}>
                    <Feather name="activity" size={14} color="#15803d" />
                    <Text style={styles.sigStatVal}>6.2 pH</Text>
                    <Text style={styles.sigStatLabel}>Acidité sol</Text>
                  </View>
                  <View style={styles.sigDivider} />
                  <View style={styles.sigStatItem}>
                    <Feather name="cloud-rain" size={14} color="#0284c7" />
                    <Text style={styles.sigStatVal}>48 mm</Text>
                    <Text style={styles.sigStatLabel}>Pluie / 7j</Text>
                  </View>
                  <View style={styles.sigDivider} />
                  <View style={styles.sigStatItem}>
                    <Feather name="package" size={14} color="#d97834" />
                    <Text style={styles.sigStatVal}>{totalEstimatedKg > 0 ? `${(totalEstimatedKg / 1000).toFixed(1)}t` : '—'}</Text>
                    <Text style={styles.sigStatLabel}>Estimé</Text>
                  </View>
                </View>
              </View>

              {/* Stage Legend */}
              <View style={styles.legendCard}>
                <Text style={styles.legendTitle}>Légende des stades</Text>
                <View style={styles.legendRow}>
                  {STAGE_ORDER.map((s, i) => (
                    <View key={s} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: STAGE_COLOR[i] }]} />
                      <Text style={styles.legendText}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Field inspection banner */}
              <View style={styles.fieldCard}>
                <View style={styles.fieldIconCircle}>
                  <Feather name="aperture" size={16} color="#ffffff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldTitle}>Dernier Relevé GPS & Sol</Text>
                  <Text style={styles.fieldSub}>Coordonnées vérifiées par l'agent de terrain SI-TCHA il y a 2 jours.</Text>
                </View>
                <Feather name="check-circle" size={16} color="#15803d" />
              </View>
            </View>
          )}

          {/* ═══════════════ MÉTÉO ═══════════════ */}
          {tab === 'meteo' && (
            <View style={styles.tabSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionDot, { backgroundColor: '#0284c7' }]} />
                  <Text style={styles.sectionTitle}>Prévisions Météorologiques</Text>
                </View>
                <Text style={styles.sectionCount}>{weather.length} relevé{weather.length !== 1 ? 's' : ''}</Text>
              </View>

              {weather.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Feather name="cloud-off" size={28} color="#889e87" />
                  <Text style={styles.emptyCardTitle}>Aucune donnée météo</Text>
                  <Text style={styles.emptyCardSub}>Les relevés seront disponibles après synchronisation.</Text>
                </View>
              ) : (
                weather.map((w) => {
                  const icon = weatherIcon(w.description);
                  const humidityVal = w.humidity ?? null;
                  const rainVal = w.pluviometrie ?? null;
                  return (
                    <View key={w.id} style={styles.card}>
                      <View style={styles.cardHeaderRow}>
                        <View style={styles.cardTitleGroup}>
                          <View style={[styles.weatherIconBg, icon === 'sun' && { backgroundColor: '#fff7ed' }]}>
                            <Feather name={icon} size={18} color={icon === 'sun' ? '#d97834' : '#0284c7'} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.cardTitle}>{w.bassin}</Text>
                            {w.description && (
                              <Text style={styles.cardDescText}>{w.description}</Text>
                            )}
                          </View>
                        </View>
                        <View style={styles.dateBadge}>
                          <Feather name="calendar" size={10} color="#5a6258" />
                          <Text style={styles.dateBadgeText}>{w.date}</Text>
                        </View>
                      </View>

                      <View style={styles.weatherMetricsRow}>
                        {/* Temperature */}
                        <View style={styles.wMetricCard}>
                          <Feather name="thermometer" size={16} color="#d97834" />
                          <Text style={styles.wVal}>{w.temperature}°C</Text>
                          <Text style={styles.wSub}>Température</Text>
                        </View>

                        {/* Humidity or Rain */}
                        <View style={styles.wMetricCard}>
                          <Feather name={humidityVal !== null ? 'droplet' : 'cloud-rain'} size={16} color="#0284c7" />
                          <Text style={styles.wVal}>
                            {humidityVal !== null ? `${humidityVal}%` : `${rainVal} mm`}
                          </Text>
                          <Text style={styles.wSub}>{humidityVal !== null ? 'Humidité' : 'Pluviométrie'}</Text>
                          {/* Visual bar */}
                          <View style={styles.metricBarBg}>
                            <View
                              style={[
                                styles.metricBarFill,
                                {
                                  width: `${Math.min(humidityVal ?? ((rainVal ?? 0) / 2), 100)}%` as any,
                                  backgroundColor: '#0284c7',
                                },
                              ]}
                            />
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* ═══════════════ MARCHÉ ═══════════════ */}
          {tab === 'marche' && (
            <View style={styles.tabSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionDot, { backgroundColor: '#d97834' }]} />
                  <Text style={styles.sectionTitle}>Cours du Marché Local</Text>
                </View>
                <Text style={styles.sectionCount}>{market.length} produit{market.length !== 1 ? 's' : ''}</Text>
              </View>

              {market.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Feather name="bar-chart-2" size={28} color="#889e87" />
                  <Text style={styles.emptyCardTitle}>Aucune donnée de marché</Text>
                  <Text style={styles.emptyCardSub}>Les prix seront affichés après synchronisation.</Text>
                </View>
              ) : (
                market.map((m) => {
                  const rentaNum = parseFloat(String(m.rentabilite)) || 0;
                  return (
                    <View key={m.id} style={styles.card}>
                      <View style={styles.cardHeaderRow}>
                        <View style={styles.cardTitleGroup}>
                          <View style={styles.productIconBg}>
                            <Feather name="package" size={14} color="#d97834" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.cardTitle}>{m.product}</Text>
                            <Text style={styles.cardMeta}>{m.bassin} · {m.date}</Text>
                          </View>
                        </View>
                        <View style={[styles.rentaBadge, rentaNum >= 20 && styles.rentaBadgeHigh]}>
                          <Feather name="trending-up" size={10} color={rentaNum >= 20 ? '#d97834' : '#15803d'} />
                          <Text style={[styles.rentaBadgeText, rentaNum >= 20 && styles.rentaBadgeTextHigh]}>
                            +{m.rentabilite}%
                          </Text>
                        </View>
                      </View>

                      {/* Price highlight */}
                      <View style={styles.priceRow}>
                        <Text style={styles.priceHighlight}>{m.prixMoyen}</Text>
                        <Text style={styles.priceCurrency}> FCFA / kg</Text>
                      </View>

                      {/* Profitability bar */}
                      <View style={styles.rentaBarSection}>
                        <Text style={styles.rentaBarLabel}>Rentabilité</Text>
                        <View style={styles.rentaBarBg}>
                          <View
                            style={[
                              styles.rentaBarFill,
                              {
                                width: `${Math.min(rentaNum, 100)}%` as any,
                                backgroundColor: rentaNum >= 20 ? '#d97834' : '#15803d',
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.rentaBarVal, rentaNum >= 20 && { color: '#d97834' }]}>
                          {m.rentabilite}%
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* ═══════════════ PROGRAMMES ═══════════════ */}
          {tab === 'programmes' && (
            <View style={styles.tabSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionDot, { backgroundColor: '#d97834' }]} />
                  <Text style={styles.sectionTitle}>Programmes & Aides GIC</Text>
                </View>
                <Text style={styles.sectionCount}>{programs.length} programme{programs.length !== 1 ? 's' : ''}</Text>
              </View>

              {programs.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Feather name="award" size={28} color="#889e87" />
                  <Text style={styles.emptyCardTitle}>Aucun programme disponible</Text>
                  <Text style={styles.emptyCardSub}>Les programmes MINADER seront affichés ici.</Text>
                </View>
              ) : (
                programs.map((p) => (
                  <View key={p.id} style={styles.card}>
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.cardTitleGroup}>
                        <View style={styles.programIconBg}>
                          <Feather name="award" size={14} color="#d97834" />
                        </View>
                        <Text style={[styles.cardTitle, { flex: 1 }]}>{p.nom}</Text>
                      </View>
                    </View>

                    <Text style={styles.programDesc}>{p.description}</Text>

                    <View style={styles.eligibilityBox}>
                      <View style={styles.eligibilityHeader}>
                        <Feather name="check-square" size={12} color="#101e0f" />
                        <Text style={styles.eligibilityTitle}>Critères d'éligibilité</Text>
                      </View>
                      <Text style={styles.eligibilityText}>{p.criteresEligibilite}</Text>
                    </View>

                    <View style={styles.deadlineRow}>
                      <View style={styles.deadlineBadge}>
                        <Feather name="clock" size={11} color="#d97834" />
                        <Text style={styles.deadlineText}>Date Limite : {p.dateLimite}</Text>
                      </View>
                      <View style={styles.applyHint}>
                        <Text style={styles.applyHintText}>Éligible</Text>
                        <Feather name="arrow-right" size={12} color="#15803d" />
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* ═══════════════ ALERTE PHYTO ═══════════════ */}
          {tab === 'phyto' && (
            <View style={styles.tabSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionDot, { backgroundColor: '#dc2626' }]} />
                  <Text style={styles.sectionTitle}>Alertes Phytosanitaires</Text>
                </View>
                <Text style={styles.sectionCount}>{phyto.length} alerte{phyto.length !== 1 ? 's' : ''}</Text>
              </View>

              {phyto.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Feather name="shield" size={28} color="#889e87" />
                  <Text style={styles.emptyCardTitle}>Aucune alerte phytosanitaire</Text>
                  <Text style={styles.emptyCardSub}>Vos cultures sont en sécurité pour le moment.</Text>
                </View>
              ) : (
                phyto.map((a) => (
                  <View key={a.id} style={styles.alertCard}>
                    {/* Severity strip */}
                    <View style={styles.alertStrip} />

                    <View style={styles.alertContent}>
                      <View style={styles.alertHeader}>
                        <View style={styles.alertIconBg}>
                          <Feather name="alert-triangle" size={14} color="#ffffff" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.alertTitle}>{a.ravageurMaladie}</Text>
                          <View style={styles.alertMetaRow}>
                            <Feather name="map-pin" size={10} color="#5a6258" />
                            <Text style={styles.alertMeta}>{a.bassin}</Text>
                            <Text style={styles.alertMetaDot}>·</Text>
                            <Feather name="calendar" size={10} color="#5a6258" />
                            <Text style={styles.alertMeta}>{a.dateEmission}</Text>
                          </View>
                        </View>
                        <View style={styles.severityBadge}>
                          <Text style={styles.severityText}>Urgent</Text>
                        </View>
                      </View>

                      <View style={styles.protocolBox}>
                        <View style={styles.protocolHeader}>
                          <Feather name="shield" size={12} color="#d97834" />
                          <Text style={styles.protocolTitle}>Protocole d'Urgence</Text>
                        </View>
                        <Text style={styles.protocol}>{a.protocoleUrgence}</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>

        <BottomNavBar role="seller" />
      </View>
    </SafeAreaView>
  );
}

/* ─────────────────────────── STYLES ─────────────────────────── */

const styles = StyleSheet.create({
  /* ── Layout ── */
  outer: { flex: 1, backgroundColor: '#101e0f', alignItems: 'center' },
  container: { width: CONTAINER_WIDTH, height: '100%', backgroundColor: '#f3ecd8' },

  /* ── Header ── */
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
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#f3ecd8' },
  headerSub: { fontSize: 10, fontWeight: '600', color: '#889e87', marginTop: 1 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#1d331b',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Tabs ── */
  tabs: { paddingHorizontal: Spacing.four, paddingVertical: 5, gap: 5 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6dfcc',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tabActive: { backgroundColor: '#101e0f', borderColor: '#101e0f' },
  tabText: { fontSize: 11, fontWeight: '700', color: '#5a6258' },
  tabTextActive: { color: '#f3ecd8' },
  tabBadge: {
    backgroundColor: '#e6dfcc',
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeActive: { backgroundColor: '#d97834' },
  tabBadgeText: { fontSize: 10, fontWeight: '800', color: '#5a6258' },
  tabBadgeTextActive: { color: '#ffffff' },

  /* ── Scroll / Section ── */
  scroll: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two, paddingBottom: Spacing.five + 20, gap: 10 },
  tabSection: { gap: 10, width: '100%' },

  /* ── Section Header ── */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#15803d' },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#101e0f' },
  sectionCount: { fontSize: 11, fontWeight: '600', color: '#889e87' },

  /* ── Empty States ── */
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    padding: 28,
    alignItems: 'center',
    gap: 6,
  },
  emptyCardTitle: { fontSize: 14, fontWeight: '800', color: '#101e0f' },
  emptyCardSub: { fontSize: 12, color: '#5a6258', textAlign: 'center' },

  /* ── Map Card (SIG) ── */
  mapCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#e6dfcc',
    padding: Spacing.four,
    gap: 14,
  },
  mapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  mapTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  mapIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#d97834',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapTitle: { fontSize: 13, fontWeight: '800', color: '#101e0f' },
  mapCoords: { fontSize: 10, color: '#889e87', fontWeight: '600', marginTop: 2 },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#182b17',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  liveText: { fontSize: 9, fontWeight: '800', color: '#22c55e', letterSpacing: 0.5 },

  /* Satellite Box */
  satelliteBox: {
    minHeight: 140,
    backgroundColor: '#182b17',
    borderRadius: 16,
    padding: 10,
    gap: 6,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gridOverlay: {
    ...(StyleSheet.absoluteFill as object),
    zIndex: 0,
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(136,158,135,0.12)',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(136,158,135,0.12)',
  },
  parcelOverlay: {
    borderWidth: 1.5,
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderRadius: 10,
    padding: 8,
    zIndex: 1,
  },
  parcelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  parcelStageDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  parcelLabel: { fontSize: 11, fontWeight: '800', color: '#ffffff', flex: 1 },
  parcelKg: { fontSize: 10, fontWeight: '700', color: '#d97834' },
  parcelSubRow: { marginTop: 3, paddingLeft: 14 },
  parcelStatus: { fontSize: 10, color: '#f3ecd8' },
  emptyParcel: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20, gap: 6 },
  emptyText: { fontSize: 12, fontWeight: '700', color: '#f3ecd8' },
  emptySubText: { fontSize: 10, color: '#889e87' },

  /* SIG Stats */
  sigStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f3ecd8',
    borderRadius: 14,
    padding: 12,
  },
  sigStatItem: { alignItems: 'center', gap: 3, flex: 1 },
  sigStatVal: { fontSize: 14, fontWeight: '800', color: '#101e0f' },
  sigStatLabel: { fontSize: 9, color: '#5a6258', fontWeight: '600' },
  sigDivider: { width: 1, height: 30, backgroundColor: '#e6dfcc' },

  /* Legend */
  legendCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    padding: 12,
    gap: 8,
  },
  legendTitle: { fontSize: 11, fontWeight: '700', color: '#5a6258' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, fontWeight: '600', color: '#101e0f' },

  /* Field Card */
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
  fieldIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#15803d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldTitle: { fontSize: 13, fontWeight: '800', color: '#15803d' },
  fieldSub: { fontSize: 11, color: '#166534', marginTop: 2, lineHeight: 16 },

  /* ── Generic Card ── */
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    padding: Spacing.three,
    gap: 10,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#101e0f' },
  cardDescText: { fontSize: 12, color: '#5a6258', marginTop: 2, textTransform: 'capitalize' },
  cardMeta: { fontSize: 12, color: '#5a6258', fontWeight: '500' },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f3ecd8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dateBadgeText: { fontSize: 10, color: '#5a6258', fontWeight: '600' },

  /* ── Weather ── */
  weatherIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherMetricsRow: { flexDirection: 'row', gap: 12 },
  wMetricCard: {
    flex: 1,
    backgroundColor: '#f3ecd8',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
  },
  wVal: { fontSize: 18, fontWeight: '900', color: '#101e0f' },
  wSub: { fontSize: 10, color: '#5a6258', fontWeight: '600' },
  metricBarBg: {
    width: '100%',
    height: 4,
    backgroundColor: '#e6dfcc',
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  metricBarFill: { height: '100%', borderRadius: 2 },

  /* ── Market ── */
  productIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rentaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  rentaBadgeHigh: { backgroundColor: '#fff7ed' },
  rentaBadgeText: { fontSize: 11, fontWeight: '800', color: '#15803d' },
  rentaBadgeTextHigh: { color: '#d97834' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  priceHighlight: { fontSize: 26, fontWeight: '900', color: '#d97834' },
  priceCurrency: { fontSize: 13, fontWeight: '700', color: '#5a6258' },
  rentaBarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f3ecd8',
    borderRadius: 10,
    padding: 10,
  },
  rentaBarLabel: { fontSize: 10, fontWeight: '600', color: '#5a6258', width: 60 },
  rentaBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#e6dfcc',
    borderRadius: 3,
    overflow: 'hidden',
  },
  rentaBarFill: { height: '100%', borderRadius: 3 },
  rentaBarVal: { fontSize: 11, fontWeight: '800', color: '#15803d', width: 36, textAlign: 'right' },

  /* ── Programmes ── */
  programIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  programDesc: { fontSize: 12, color: '#5a6258', lineHeight: 18 },
  eligibilityBox: {
    backgroundColor: '#f3ecd8',
    padding: 12,
    borderRadius: 12,
    gap: 6,
  },
  eligibilityHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eligibilityTitle: { fontSize: 11, fontWeight: '800', color: '#101e0f' },
  eligibilityText: { fontSize: 11, color: '#101e0f', fontWeight: '500', lineHeight: 16, paddingLeft: 18 },
  deadlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deadlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fff7ed',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  deadlineText: { fontSize: 11, fontWeight: '700', color: '#d97834' },
  applyHint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  applyHintText: { fontSize: 11, fontWeight: '700', color: '#15803d' },

  /* ── Phyto Alerts ── */
  alertCard: {
    flexDirection: 'row',
    backgroundColor: '#fff7ed',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d97834',
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  alertStrip: {
    width: 5,
    backgroundColor: '#d97834',
  },
  alertContent: {
    flex: 1,
    padding: Spacing.four,
    gap: 12,
  },
  alertHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  alertIconBg: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#d97834',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: { fontSize: 14, fontWeight: '800', color: '#101e0f' },
  alertMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  alertMeta: { fontSize: 10, color: '#5a6258', fontWeight: '500' },
  alertMetaDot: { fontSize: 10, color: '#5a6258' },
  severityBadge: {
    backgroundColor: '#d97834',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  severityText: { fontSize: 9, fontWeight: '800', color: '#ffffff', letterSpacing: 0.5 },
  protocolBox: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 12,
    gap: 6,
  },
  protocolHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  protocolTitle: { fontSize: 11, fontWeight: '800', color: '#d97834' },
  protocol: { fontSize: 12, color: '#101e0f', lineHeight: 18, paddingLeft: 18 },
});
