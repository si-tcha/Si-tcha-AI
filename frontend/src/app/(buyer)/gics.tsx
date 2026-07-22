import { Dimensions, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';
import { ConfidentialGic, dbService, ProductOffer } from '@/services/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export default function BuyerGicsScreen() {
  const router = useRouter();
  const [gics, setGics] = useState<ConfidentialGic[]>([]);
  const [products, setProducts] = useState<ProductOffer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      await dbService.initDatabase();
      setGics(await dbService.getConfidentialGics());
      setProducts(await dbService.getProducts());
    };
    load();
  }, []);

  const offers = selectedId
    ? products.filter((p) => p.gicId === selectedId)
    : [];

  return (
    <SafeAreaView style={styles.outer}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f3ecd8" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Feather name="arrow-left" size={22} color="#101e0f" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>GIC partenaires</Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.hint}>
            Vue confidentielle : nom, logo et identifiant REF uniquement.
          </Text>

          {gics.map((gic) => (
            <TouchableOpacity
              key={gic.id}
              style={[styles.card, selectedId === gic.id && styles.cardSelected]}
              onPress={() => setSelectedId(gic.id === selectedId ? null : gic.id)}
            >
              <Text style={styles.emoji}>{gic.emoji}</Text>
              <View style={styles.cardBody}>
                <Text style={styles.name}>{gic.name}</Text>
                <Text style={styles.ref}>{gic.identifiantREF}</Text>
                <Text style={styles.meta}>Bassin · {gic.bassin}</Text>
              </View>
              <Feather
                name={selectedId === gic.id ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#5a6258"
              />
            </TouchableOpacity>
          ))}

          {selectedId && (
            <View style={styles.offerBlock}>
              <Text style={styles.offerTitle}>Offres disponibles</Text>
              {offers.length === 0 ? (
                <Text style={styles.meta}>Aucune offre publiée pour ce GIC.</Text>
              ) : (
                offers.map((o) => (
                  <View key={o.id} style={styles.offerCard}>
                    <Text style={styles.offerName}>{o.emoji} {o.name}</Text>
                    <Text style={styles.meta}>
                      {o.volumeDisponible} {o.unit} · {o.maturite} · dispo {o.dateDispo}
                    </Text>
                    <Text style={styles.price}>{o.price} FCFA/{o.unit}</Text>
                  </View>
                ))
              )}
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
  scroll: { padding: Spacing.four, gap: 10 },
  hint: { fontSize: 12, color: '#5a6258', marginBottom: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    padding: 14,
  },
  cardSelected: { borderColor: '#101e0f' },
  emoji: { fontSize: 28 },
  cardBody: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: '800', color: '#101e0f' },
  ref: { fontSize: 11, fontWeight: '700', color: '#d97834' },
  meta: { fontSize: 11, color: '#5a6258', fontWeight: '600' },
  offerBlock: { marginTop: 8, gap: 8 },
  offerTitle: { fontSize: 14, fontWeight: '800', color: '#101e0f' },
  offerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    padding: 12,
    gap: 4,
  },
  offerName: { fontSize: 13, fontWeight: '700', color: '#101e0f' },
  price: { fontSize: 13, fontWeight: '800', color: '#d97834' },
});
