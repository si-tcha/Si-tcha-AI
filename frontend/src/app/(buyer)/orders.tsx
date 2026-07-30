import { Dimensions, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, Image } from 'react-native';
import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';
import { dbService, OrderRecord } from '@/services/database';
import { BottomNavBar } from '@/components/ui/bottom-nav-bar';
import { useToast } from '@/components/ui/toast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

const TYPE_LABELS: Record<string, string> = {
  commande_ferme: 'Commande ferme',
  achat_direct: 'Achat direct',
  reservation: 'Réservation garantie',
};

export default function BuyerOrdersScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Rating state
  const [ratingOrder, setRatingOrder] = useState<OrderRecord | null>(null);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratedOrders, setRatedOrders] = useState<Set<string>>(new Set());

  const handleSubmitRating = async () => {
    if (!ratingOrder || ratingStars === 0) return;
    try {
      await dbService.addTrustRating(
        ratingOrder.gicName,
        'gic',
        ratingStars,
        ratingComment.trim(),
        'Acheteur'
      );
      setRatedOrders(prev => new Set([...prev, ratingOrder.id]));
      setRatingOrder(null);
      setRatingStars(0);
      setRatingComment('');
      showToast({ message: 'Merci pour votre évaluation !', type: 'success' });
    } catch (err) {
      showToast({ message: 'Erreur lors de l\'évaluation.', type: 'error' });
    }
  };

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        setIsLoading(true);
        await dbService.initDatabase();
        setOrders(await dbService.getOrders());
        setIsLoading(false);
      };
      load();
    }, [])
  );

  return (
    <SafeAreaView style={styles.outerContainer} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#101e0f" />
        
        {/* Header Unifié Hauteur Fixe 56px */}
        <View style={styles.header}>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Mes Commandes & Bordereaux</Text>
            <Text style={styles.headerSubtitle}>Suivi Logistique & Reçus QR</Text>
          </View>

          <View style={styles.headerIcons}>
            <View style={styles.iconButton}>
              <Feather name="file-text" size={18} color="#f3ecd8" />
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Chargement de vos commandes...</Text>
            </View>
          ) : orders.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="shopping-bag" size={40} color="#889e87" />
              <Text style={styles.emptyText}>Aucune commande enregistrée pour l'instant.</Text>
              <TouchableOpacity style={styles.shopBtn} onPress={() => router.replace('/(buyer)/home')}>
                <Text style={styles.shopBtnText}>Explorer le marché direct</Text>
              </TouchableOpacity>
            </View>
          ) : (
            orders.map((o) => (
              <View key={o.id} style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.title}>{o.productName}</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>✓ {o.status === 'en_attente' ? 'EN ATTENTE' : (o.status === 'confirmee' ? 'CONFIRMÉE' : o.status.toUpperCase())}</Text>
                  </View>
                </View>

                <View style={styles.typeBadgeRow}>
                  <Text style={styles.typeBadgeText}>{TYPE_LABELS[o.type] ?? o.type}</Text>
                  <Text style={styles.gicTag} numberOfLines={1}>GIC: {o.gicName}</Text>
                </View>

                <View style={styles.priceRow}>
                  <Text style={styles.value}>
                    {o.quantity} {o.unit} · {o.price} FCFA/{o.unit}
                  </Text>
                  <Text style={styles.totalPrice}>{(o.quantity * parseFloat(o.price || '0')).toLocaleString()} FCFA</Text>
                </View>

                {/* Timeline Progress */}
                <View style={styles.timelineRow}>
                  <View style={styles.timelineStepActive}>
                    <Feather name="check" size={10} color="#ffffff" />
                  </View>
                  <View style={styles.timelineLineActive} />
                  <View style={styles.timelineStepActive}>
                    <Feather name={o.type === 'reservation' ? "loader" : "package"} size={10} color="#ffffff" />
                  </View>
                  <View style={styles.timelineLine} />
                  <View style={styles.timelineStep}>
                    <Feather name={o.type === 'reservation' ? "sun" : "truck"} size={10} color="#889e87" />
                  </View>
                </View>
                <Text style={styles.timelineLabel}>
                  {o.type === 'reservation' ? 'Fonds Avancés · Production en cours' : 'Préparé en entrepôt GIC · Prêt pour transport'}
                </Text>

                <View style={styles.footerRow}>
                  <Text style={styles.dateMeta}>
                    {new Date(o.createdAt).toLocaleString('fr-FR')}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {o.status === 'confirmee' && !ratedOrders.has(o.id) && (
                      <TouchableOpacity style={styles.rateBtn} onPress={() => { setRatingOrder(o); setRatingStars(0); setRatingComment(''); }}>
                        <Feather name="star" size={13} color="#d97834" />
                        <Text style={styles.rateBtnText}>Noter</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.receiptBtn} onPress={() => setSelectedOrder(o)}>
                      <Feather name="grid" size={13} color="#101e0f" />
                      <Text style={styles.receiptBtnText}>Reçu QR</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {/* Modal Reçu QR */}
        <Modal visible={!!selectedOrder} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Reçu Transactionnel QR</Text>
                <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                  <Feather name="x" size={22} color="#101e0f" />
                </TouchableOpacity>
              </View>

              {selectedOrder && (
                <View style={styles.receiptBox}>
                  <View style={styles.qrPlaceholder}>
                    <Image 
                      source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(selectedOrder.id)}` }}
                      style={{ width: 120, height: 120 }}
                    />
                  </View>
                  <Text style={styles.receiptCode}>REF-{selectedOrder.id.substring(0, 8).toUpperCase()}</Text>
                  <Text style={styles.receiptProd}>{selectedOrder.productName}</Text>
                  <Text style={styles.receiptGic}>Fournisseur: {selectedOrder.gicName}</Text>
                  <Text style={styles.receiptTotal}>Total: {(selectedOrder.quantity * parseFloat(selectedOrder.price || '0')).toLocaleString()} FCFA</Text>
                  <Text style={styles.receiptHint}>Paiement Mobile Money Sécurisé · Présentez ce QR Code au magasinier du GIC.</Text>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* Modal Évaluation GIC */}
        <Modal visible={!!ratingOrder} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Évaluer le GIC</Text>
                <TouchableOpacity onPress={() => setRatingOrder(null)}>
                  <Feather name="x" size={22} color="#101e0f" />
                </TouchableOpacity>
              </View>

              {ratingOrder && (
                <View style={{ gap: 12 }}>
                  <Text style={{ fontSize: 13, color: '#5a6258', fontWeight: '600', textAlign: 'center' }}>
                    Comment s'est passée votre transaction avec {ratingOrder.gicName} ?
                  </Text>

                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 8 }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity key={star} onPress={() => setRatingStars(star)}>
                        <Feather
                          name={star <= ratingStars ? 'star' : 'star'}
                          size={32}
                          color={star <= ratingStars ? '#d97834' : '#e6dfcc'}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TextInput
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: '#e6dfcc',
                      padding: 12,
                      fontSize: 13,
                      color: '#101e0f',
                      height: 80,
                      textAlignVertical: 'top',
                    }}
                    placeholder="Un commentaire ? (optionnel)"
                    placeholderTextColor="#889e87"
                    multiline
                    value={ratingComment}
                    onChangeText={setRatingComment}
                  />

                  <TouchableOpacity
                    style={{
                      backgroundColor: ratingStars > 0 ? '#15803d' : '#e6dfcc',
                      paddingVertical: 12,
                      borderRadius: 12,
                      alignItems: 'center',
                    }}
                    onPress={handleSubmitRating}
                    disabled={ratingStars === 0}
                  >
                    <Text style={{ color: ratingStars > 0 ? '#ffffff' : '#889e87', fontWeight: '800', fontSize: 14 }}>
                      Envoyer mon évaluation ({ratingStars}/5)
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>

        <BottomNavBar role="buyer" />
      </View>
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
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 13, color: '#5a6258', fontWeight: '600' },
  shopBtn: { backgroundColor: '#d97834', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  shopBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e6dfcc',
    padding: 14,
    gap: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '800', color: '#101e0f', flex: 1 },
  badge: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#15803d' },
  typeBadgeRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  typeBadgeText: { fontSize: 11, fontWeight: '700', color: '#d97834' },
  gicTag: { fontSize: 11, color: '#5a6258', fontWeight: '600', flexShrink: 1 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9f6ef', padding: 10, borderRadius: 10 },
  value: { fontSize: 12, fontWeight: '700', color: '#101e0f' },
  totalPrice: { fontSize: 15, fontWeight: '900', color: '#d97834' },
  timelineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  timelineStepActive: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#15803d', alignItems: 'center', justifyContent: 'center' },
  timelineLineActive: { flex: 1, height: 3, backgroundColor: '#15803d' },
  timelineLine: { flex: 1, height: 3, backgroundColor: '#e6dfcc' },
  timelineStep: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#e6dfcc', alignItems: 'center', justifyContent: 'center' },
  timelineLabel: { fontSize: 10, color: '#15803d', fontWeight: '700', textAlign: 'center', marginTop: 2 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f3ecd8', paddingTop: 8, marginTop: 4 },
  dateMeta: { fontSize: 11, color: '#889e87', fontWeight: '600' },
  rateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff7ed', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#ffedd5' },
  rateBtnText: { fontSize: 11, fontWeight: '800', color: '#d97834' },
  receiptBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f3ecd8', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  receiptBtnText: { fontSize: 11, fontWeight: '800', color: '#101e0f' },
  modalOverlay: { flex: 1, backgroundColor: '#101e0f70', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#f3ecd8', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: Spacing.four },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#101e0f' },
  receiptBox: { alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 20, padding: 20, gap: 8, marginVertical: 10 },
  qrPlaceholder: { padding: 10, backgroundColor: '#f9f6ef', borderRadius: 16 },
  receiptCode: { fontSize: 12, fontWeight: '800', color: '#889e87', letterSpacing: 1 },
  receiptProd: { fontSize: 16, fontWeight: '800', color: '#101e0f' },
  receiptGic: { fontSize: 12, color: '#5a6258' },
  receiptTotal: { fontSize: 18, fontWeight: '900', color: '#d97834', marginTop: 4 },
  receiptHint: { fontSize: 11, color: '#5a6258', textAlign: 'center', lineHeight: 16, marginTop: 6 },
});
