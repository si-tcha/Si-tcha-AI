import { Dimensions, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';
import { ConfidentialGic, dbService, ProductOffer } from '@/services/database';
import { BottomNavBar } from '@/components/ui/bottom-nav-bar';
import { useToast } from '@/components/ui/toast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export default function BuyerGicsScreen() {
  const router = useRouter();
  const { showToast } = useToast();
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

  const handleAddToCart = async (product: ProductOffer) => {
    try {
      await dbService.addToCart({
        productId: product.id,
        name: product.name,
        price: product.price,
        unit: product.unit,
      });
      showToast({ message: `${product.name} ajouté au panier !`, type: 'success' });
    } catch (err) {
      showToast({ message: 'Erreur ajout panier.', type: 'error' });
    }
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
          <Text style={styles.headerTitle}>Annuaire GIC Certifiés MINADER</Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Banner */}
          <View style={styles.infoBanner}>
            <Feather name="check-circle" size={20} color="#15803d" />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoBannerTitle}>GICs Vérifiés sur le Terrain</Text>
              <Text style={styles.infoBannerSub}>
                Toutes les coopératives affichées possèdent un identifiant légal REF et un audit de sol valide.
              </Text>
            </View>
          </View>

          {gics.map((gic) => {
            const isSelected = selectedId === gic.id;
            return (
              <View key={gic.id} style={[styles.card, isSelected && styles.cardSelected]}>
                <TouchableOpacity
                  style={styles.cardHeaderAction}
                  onPress={() => setSelectedId(isSelected ? null : gic.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.gicIconBg}>
                    <Text style={styles.emoji}>{gic.emoji}</Text>
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name}>{gic.name}</Text>
                      <View style={styles.scoreBadge}>
                        <Feather name="star" size={11} color="#d97834" />
                        <Text style={styles.scoreBadgeText}>4.9/5</Text>
                      </View>
                    </View>
                    <Text style={styles.ref}>REF: {gic.identifiantREF}</Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.meta}>Bassin: {gic.bassin}</Text>
                      <Text style={styles.metaDivider}>•</Text>
                      <Text style={styles.meta}>24 Producteurs</Text>
                    </View>
                  </View>
                  <Feather
                    name={isSelected ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#101e0f"
                  />
                </TouchableOpacity>

                {/* Direct pre-finance action */}
                <View style={styles.gicFooterRow}>
                  <TouchableOpacity 
                    style={styles.prefinanceBtn} 
                    onPress={() => router.push('/(buyer)/prefinancing')}
                    activeOpacity={0.8}
                  >
                    <Feather name="trending-up" size={13} color="#ffffff" />
                    <Text style={styles.prefinanceBtnText}>Préfinancer Récolte</Text>
                  </TouchableOpacity>
                </View>

                {/* Expanded product list for this GIC */}
                {isSelected && (
                  <View style={styles.offerBlock}>
                    <Text style={styles.offerTitle}>Récoltes publiées par ce GIC ({offers.length})</Text>
                    {offers.length === 0 ? (
                      <Text style={styles.emptyMeta}>Aucune récolte disponible actuellement.</Text>
                    ) : (
                      offers.map((o) => (
                        <View key={o.id} style={styles.offerCard}>
                          <View style={styles.offerMain}>
                            <Text style={styles.offerName}>{o.emoji} {o.name}</Text>
                            <Text style={styles.meta}>
                              Dispo: {o.volumeDisponible} {o.unit} · {o.maturite}
                            </Text>
                          </View>
                          <View style={styles.offerRight}>
                            <Text style={styles.price}>{o.price} FCFA/{o.unit}</Text>
                            <TouchableOpacity style={styles.addCartMiniBtn} onPress={() => handleAddToCart(o)}>
                              <Feather name="plus" size={14} color="#f3ecd8" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        <BottomNavBar role="buyer" />
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
  headerTitle: { fontSize: 15, fontWeight: '800', color: '#f3ecd8' },
  scroll: { padding: Spacing.four, gap: 12 },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 16,
    padding: 14,
  },
  infoBannerTitle: { fontSize: 13, fontWeight: '800', color: '#15803d' },
  infoBannerSub: { fontSize: 11, color: '#166534', marginTop: 2, lineHeight: 16 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e6dfcc',
    padding: 14,
    gap: 10,
  },
  cardSelected: { borderColor: '#101e0f' },
  cardHeaderAction: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gicIconBg: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#f9f6ef', alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 24 },
  cardBody: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 14, fontWeight: '800', color: '#101e0f' },
  scoreBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fff7ed', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  scoreBadgeText: { fontSize: 10, fontWeight: '800', color: '#d97834' },
  ref: { fontSize: 11, fontWeight: '700', color: '#d97834' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { fontSize: 11, color: '#5a6258', fontWeight: '600' },
  metaDivider: { color: '#889e87' },
  gicFooterRow: { borderTopWidth: 1, borderTopColor: '#f3ecd8', paddingTop: 8, marginTop: 2 },
  prefinanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#d97834',
    paddingVertical: 8,
    borderRadius: 10,
  },
  prefinanceBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  offerBlock: { marginTop: 8, gap: 8, borderTopWidth: 1, borderTopColor: '#f3ecd8', paddingTop: 10 },
  offerTitle: { fontSize: 13, fontWeight: '800', color: '#101e0f' },
  emptyMeta: { fontSize: 11, color: '#5a6258' },
  offerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9f6ef',
    borderRadius: 12,
    padding: 10,
  },
  offerMain: { flex: 1, gap: 2 },
  offerName: { fontSize: 13, fontWeight: '800', color: '#101e0f' },
  offerRight: { alignItems: 'flex-end', gap: 4 },
  price: { fontSize: 12, fontWeight: '800', color: '#d97834' },
  addCartMiniBtn: { width: 26, height: 26, borderRadius: 8, backgroundColor: '#101e0f', alignItems: 'center', justifyContent: 'center' },
});
