import { Dimensions, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';
import { ConfidentialGic, dbService, ProductOffer, TrustRating } from '@/services/database';
import { useCart } from '@/services/cart-store';
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
  const [trustRatings, setTrustRatings] = useState<TrustRating[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Trust Rating Modal State
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [ratingTarget, setRatingTarget] = useState<ConfidentialGic | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');

  useFocusEffect(
    React.useCallback(() => {
      let isMounted = true;
      const loadLocal = async () => {
        const [gList, pList, rList] = await Promise.all([
          dbService.getConfidentialGics(),
          dbService.getProducts(),
          dbService.getTrustRatings(),
        ]);
        if (isMounted) {
          setGics(gList);
          setProducts(pList);
          setTrustRatings(rList);
          setIsLoading(false);
        }
      };

      const load = async () => {
        await dbService.initDatabase();
        await loadLocal(); // Afficher local immédiatement

        // Sync en arrière-plan et recharger si besoin
        dbService.syncRemoteData().then(async (updated) => {
          if (updated && isMounted) await loadLocal();
        }).catch(() => {});
      };

      load();
      return () => {
        isMounted = false;
      };
    }, [])
  );

  const offers = selectedId
    ? products.filter((p) => p.gicId === selectedId)
    : [];

  const { addToCart: addProductToCart } = useCart();

  const handleAddToCart = async (product: ProductOffer) => {
    try {
      await addProductToCart(
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          unit: product.unit,
        },
        product.volumeDisponible
      );
      showToast({ message: `🛒 ${product.name} ajouté au panier !`, type: 'success' });
    } catch (err: any) {
      showToast({ message: err?.message || 'Erreur ajout panier.', type: 'error' });
    }
  };

  const handleSubmitRating = async () => {
    if (!ratingTarget) return;
    try {
      await dbService.addTrustRating(
        ratingTarget.id,
        'gic',
        ratingValue,
        ratingComment,
        'Acheteur Anonyme' // On pourrait utiliser le nom du user courant
      );
      showToast({ message: 'Évaluation soumise avec succès !', type: 'success' });
      setRatingModalVisible(false);
      const rList = await dbService.getTrustRatings();
      setTrustRatings(rList);
    } catch (err) {
      showToast({ message: 'Erreur lors de la soumission.', type: 'error' });
    }
  };

  return (
    <SafeAreaView style={styles.outerContainer} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#101e0f" />

        {/* Header Unifié Hauteur Fixe 56px */}
        <View style={styles.header}>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Annuaire GIC Certifiés MINADER</Text>
            <Text style={styles.headerSubtitle}>Coopératives & Audits de Sol Vérifiés</Text>
          </View>

          <View style={styles.headerIcons}>
            <View style={styles.iconButton}>
              <Feather name="shield" size={18} color="#f3ecd8" />
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: 8 }}>
            <Text style={{ fontSize: 13, color: '#8a9488', lineHeight: 18 }}>
              Découvrez les GIC certifiés et leurs catalogues. Vous pouvez acheter directement chez eux sans intermédiaire.
            </Text>
          </View>

          {isLoading ? (
            <View style={{ gap: 16 }}>
              {[1, 2, 3].map((key) => (
                <View key={key} style={styles.skeletonCard}>
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    <View style={styles.skeletonAvatar} />
                    <View style={{ flex: 1, gap: 8 }}>
                      <View style={styles.skeletonTitle} />
                      <View style={styles.skeletonSub} />
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                    <View style={styles.skeletonBadge} />
                    <View style={styles.skeletonBadge} />
                  </View>
                </View>
              ))}
            </View>
          ) : gics.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="users" size={40} color="#889e87" />
              <Text style={styles.emptyText}>Aucun GIC enregistré pour le moment.</Text>
            </View>
          ) : (
            <View style={styles.infoBanner}>
              <Feather name="check-circle" size={20} color="#15803d" />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoBannerTitle}>GICs Vérifiés sur le Terrain</Text>
                <Text style={styles.infoBannerSub}>
                  Toutes les coopératives affichées possèdent un identifiant légal REF et un audit de sol valide.
                </Text>
              </View>
            </View>
          )}

          {gics.map((gic) => {
            const isSelected = selectedId === gic.id;
            const gicRatings = trustRatings.filter(r => r.targetId === gic.id);
            const avgRating = gicRatings.length > 0
              ? (gicRatings.reduce((sum, r) => sum + r.rating, 0) / gicRatings.length).toFixed(1)
              : '--';

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
                        <Text style={styles.scoreBadgeText}>{avgRating}/5</Text>
                      </View>
                    </View>
                    <Text style={styles.ref}>REF: {gic.identifiantREF}</Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.meta}>Bassin: {gic.bassin}</Text>
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
                    onPress={() => router.replace({
                      pathname: '/(buyer)/prefinancing',
                      params: {
                        autoOpen: 'true',
                        targetGic: gic.name,
                        needDesc: gic.needs && gic.needs.length > 0 ? gic.needs[0].description : ''
                      }
                    })}
                    activeOpacity={0.8}
                  >
                    <Feather name="trending-up" size={13} color="#ffffff" />
                    <Text style={styles.prefinanceBtnText}>Préfinancer Récolte</Text>
                  </TouchableOpacity>
                </View>

                {/* Expanded product list for this GIC */}
                {isSelected && (
                  <View style={styles.offerBlock}>
                    {gic.needs && gic.needs.length > 0 && (
                      <View style={styles.needsBlock}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <Feather name="bell" size={14} color="#d97834" />
                          <Text style={styles.needsTitle}>Besoins exprimés par le GIC</Text>
                        </View>
                        {gic.needs.map((n: any) => (
                          <View key={n.id} style={styles.needItem}>
                            <Text style={styles.needCat}>{n.category}</Text>
                            <Text style={styles.needDesc}>{n.description}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    <View style={styles.offerBlockHeader}>
                      <Text style={styles.offerTitle}>Récoltes publiées par ce GIC ({offers.length})</Text>
                      <TouchableOpacity
                        style={styles.rateBtn}
                        onPress={() => {
                          setRatingTarget(gic);
                          setRatingValue(5);
                          setRatingComment('');
                          setRatingModalVisible(true);
                        }}
                      >
                        <Feather name="star" size={13} color="#d97834" />
                        <Text style={styles.rateBtnText}>Évaluer le GIC</Text>
                      </TouchableOpacity>
                    </View>

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

      {/* MODAL ÉVALUATION CONFIANCE */}
      <Modal visible={ratingModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Évaluer {ratingTarget?.name}</Text>
              <TouchableOpacity onPress={() => setRatingModalVisible(false)}>
                <Feather name="x" size={24} color="#101e0f" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalForm}>
              <Text style={styles.label}>Note sur 5</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setRatingValue(star)}>
                    <Feather
                      name="star"
                      size={32}
                      color={star <= ratingValue ? '#d97834' : '#e6dfcc'}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Commentaire (optionnel)</Text>
              <View style={styles.textInputWrapper}>
                <TextInput
                  style={styles.textArea}
                  placeholder="Ex: Récoltes excellentes, livraison à l'heure..."
                  placeholderTextColor="#9ca49a"
                  multiline
                  numberOfLines={4}
                  value={ratingComment}
                  onChangeText={setRatingComment}
                  textAlignVertical="top"
                />
              </View>

              <TouchableOpacity onPress={handleSubmitRating} style={styles.modalSubmitBtn} activeOpacity={0.85}>
                <Text style={styles.modalSubmitText}>Soumettre l'évaluation</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#101e0f', alignItems: 'center' },
  container: { flex: 1, width: CONTAINER_WIDTH, backgroundColor: '#f3ecd8' },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    backgroundColor: '#101e0f',
    borderBottomWidth: 1,
    borderBottomColor: '#1d331b',
  },
  headerTitleGroup: { gap: 1 },
  headerTitle: { fontSize: 15, fontWeight: '900', color: '#f3ecd8' },
  headerSubtitle: { fontSize: 10, fontWeight: '600', color: '#889e87' },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#1d331b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { padding: Spacing.four, gap: 12, paddingBottom: 90 },
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  skeletonCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    padding: 16,
    opacity: 0.7,
  },
  skeletonAvatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#f3ecd8' },
  skeletonTitle: { width: '60%', height: 14, borderRadius: 4, backgroundColor: '#f3ecd8' },
  skeletonSub: { width: '40%', height: 10, borderRadius: 4, backgroundColor: '#f3ecd8' },
  skeletonBadge: { width: 80, height: 24, borderRadius: 6, backgroundColor: '#f3ecd8' },
  cardSelected: { borderColor: '#d97834', borderWidth: 1.5 },
  cardHeaderAction: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  gicIconBg: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#f9f6ef', alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 24 },
  cardBody: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 14, fontWeight: '800', color: '#101e0f' },
  scoreBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fff7ed', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  scoreBadgeText: { fontSize: 10, fontWeight: '800', color: '#d97834' },
  ref: { fontSize: 11, fontWeight: '700', color: '#d97834' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  meta: { fontSize: 11, color: '#5a6258', fontWeight: '500' },
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
  offerBlock: { marginTop: 4, gap: 8, borderTopWidth: 1, borderTopColor: '#f3ecd8', paddingTop: 10 },
  offerTitle: { fontSize: 13, fontWeight: '800', color: '#101e0f' },
  emptyMeta: { fontSize: 11, color: '#5a6258' },
  needsBlock: { marginBottom: 12, padding: 12, backgroundColor: '#fff7ed', borderRadius: 12, borderWidth: 1, borderColor: '#ffedd5' },
  needsTitle: { fontSize: 12, fontWeight: '800', color: '#d97834' },
  needItem: { marginBottom: 4 },
  needCat: { fontSize: 11, fontWeight: '700', color: '#101e0f' },
  needDesc: { fontSize: 11, color: '#5a6258' },
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
  empty: {
    padding: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.six,
  },
  emptyText: {
    color: '#889e87',
    marginTop: Spacing.two,
    fontSize: 14,
  },
  offerBlockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  rateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff7ed', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#ffedd5' },
  rateBtnText: { color: '#d97834', fontSize: 11, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#f3ecd8', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: Spacing.four },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.four },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#101e0f' },
  modalForm: { gap: 16 },
  label: { fontSize: 12, fontWeight: '800', color: '#101e0f' },
  starsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.two },
  textInputWrapper: { backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e6dfcc' },
  textArea: { minHeight: 100, padding: 12, fontSize: 14, color: '#101e0f' },
  modalSubmitBtn: { backgroundColor: '#d97834', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: Spacing.two },
  modalSubmitText: { color: '#ffffff', fontSize: 15, fontWeight: '900' }
});
