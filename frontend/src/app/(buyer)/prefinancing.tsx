import { Dimensions, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { PrefinancingDeal, TrustRating, dbService } from '@/services/database';
import { BottomNavBar } from '@/components/ui/bottom-nav-bar';
import { useToast } from '@/components/ui/toast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export default function PrefinancingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { showToast } = useToast();
  const [deals, setDeals] = useState<PrefinancingDeal[]>([]);
  const [ratings, setRatings] = useState<TrustRating[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Rating Form states
  const [ratingScore, setRatingScore] = useState('5');
  const [ratingComment, setRatingComment] = useState('Terrain conforme, excellente gestion.');


  // Form states
  const [gicName, setGicName] = useState('GIC Agro-Vallée Bafoussam');
  const [buyerName, setBuyerName] = useState('SOCIÉTÉ AGRO-CENTRE');
  const [amountFcfa, setAmountFcfa] = useState('1000000');
  const [inputDescription, setInputDescription] = useState('Avance 20 sacs NPK + Semences certifiées');
  const [reservedProduct, setReservedProduct] = useState('Maïs jaune');
  const [reservedVolumeKg, setReservedVolumeKg] = useState('3000');

  useEffect(() => {
    loadData();
    if (params.autoOpen === 'true') {
      if (params.targetGic) setGicName(params.targetGic as string);
      if (params.needDesc) setInputDescription(params.needDesc as string);
      else setInputDescription('');

      setModalVisible(true);
    }
  }, [params.autoOpen, params.targetGic, params.needDesc]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      await dbService.initDatabase();
      const [storedDeals, storedRatings] = await Promise.all([
        dbService.getPrefinancingDeals(),
        dbService.getTrustRatings(),
      ]);
      setDeals(storedDeals);
      setRatings(storedRatings);
    } catch (err) {
      console.warn('Erreur chargement préfinancement:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateDeal = async () => {
    if (!amountFcfa.trim() || !inputDescription.trim()) {
      showToast({ message: 'Veuillez remplir le montant et les intrants avancés.', type: 'warning' });
      return;
    }
    try {
      const amount = parseFloat(amountFcfa.replace(/\s/g, '')) || 0;
      const volume = parseFloat(reservedVolumeKg.replace(/\s/g, '')) || 0;

      const newDeal = await dbService.addPrefinancingDeal(
        gicName,
        buyerName,
        amount,
        inputDescription.trim(),
        reservedProduct,
        volume
      );
      setDeals(prev => [newDeal, ...prev]);
      setInputDescription('');
      setModalVisible(false);
      showToast({ message: 'Accord de préfinancement transmis au GIC !', type: 'success' });
    } catch (err) {
      showToast({ message: 'Erreur création accord préfinancement.', type: 'error' });
    }
  };

  const handleCreateRating = async () => {
    try {
      const score = parseInt(ratingScore, 10);
      if (isNaN(score) || score < 1 || score > 5) {
        showToast({ message: 'Veuillez entrer une note entre 1 et 5.', type: 'warning' });
        return;
      }
      if (!ratingComment.trim()) {
        showToast({ message: 'Veuillez laisser un commentaire.', type: 'warning' });
        return;
      }

      // Add a trust rating targeted at the specific GIC or a general one if GIC is hardcoded
      // Using "gic-01" as a placeholder for the target GIC ID in this demo
      const newRating = await dbService.addTrustRating('gic-01', 'gic', score, ratingComment.trim(), buyerName);
      setRatings(prev => [newRating, ...prev]);
      setRatingModalVisible(false);
      showToast({ message: 'Avis enregistré avec succès !', type: 'success' });
    } catch (err) {
      showToast({ message: 'Erreur lors de l\'enregistrement de l\'avis.', type: 'error' });
    }
  };

  return (
    <SafeAreaView style={styles.outerContainer} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#101e0f" />

        {/* Header Unifié Hauteur Fixe 56px */}
        <View style={styles.header}>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Préfinancement Récoltes</Text>
            <Text style={styles.headerSubtitle}>Investissement direct & Trust Score</Text>
          </View>

          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.addNavButton} onPress={() => setModalVisible(true)}>
              <Feather name="plus" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.three }}>
            <Text style={{ fontSize: 14, color: '#8a9488', lineHeight: 20 }}>
              Investir dans un contrat de culture vous permet d'avancer des fonds ou des intrants à une coopérative agricole. En retour, vous obtenez l'exclusivité d'achat sur une partie de la future récolte à un prix garanti à l'avance.
            </Text>
          </View>

          {/* Carte Trust Score */}
          <View style={styles.trustCard}>
            <View style={styles.trustHeader}>
              <View>
                <Text style={styles.trustTitle}>Trust Score GIC Partner</Text>
                <Text style={styles.trustSub}>Audit de conformité & historique de livraison</Text>
              </View>
              <View style={styles.starBadge}>
                <Feather name="star" size={15} color="#d97834" style={{ marginRight: 4 }} />
                <Text style={styles.starBadgeText}>4.8 / 5</Text>
              </View>
            </View>

            <View style={styles.badgesRow}>
              <View style={styles.trustTag}>
                <Feather name="check-circle" size={12} color="#15803d" style={{ marginRight: 4 }} />
                <Text style={styles.trustTagText}>100% Livré à temps</Text>
              </View>
              <View style={styles.trustTag}>
                <Feather name="shield" size={12} color="#101e0f" style={{ marginRight: 4 }} />
                <Text style={styles.trustTagText}>Accrédité MINADER</Text>
              </View>
            </View>

            {/* Avis acheteurs */}
            {ratings.map(r => (
              <View key={r.id} style={styles.reviewItem}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewAuthor}>{r.authorName}</Text>
                  <Text style={styles.reviewRating}>★ {r.rating}</Text>
                </View>
                <Text style={styles.reviewComment}>"{r.comment}"</Text>
              </View>
            ))}

            <TouchableOpacity
              style={styles.addReviewBtn}
              onPress={() => setRatingModalVisible(true)}
              activeOpacity={0.8}
            >
              <Feather name="edit-3" size={14} color="#15803d" style={{ marginRight: 6 }} />
              <Text style={styles.addReviewBtnText}>Laisser un avis suite à une visite</Text>
            </TouchableOpacity>
          </View>

          {/* Action proposer accord */}
          <TouchableOpacity style={styles.actionButton} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
            <Feather name="trending-up" size={18} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.actionButtonText}>+ Préfinancer une campagne agricole</Text>
          </TouchableOpacity>

          {/* Liste des accords */}
          <Text style={styles.sectionTitle}>Accords en cours ({deals.length})</Text>

          {isLoading ? (
            <View style={{ padding: Spacing.five, alignItems: 'center' }}>
              <Text style={{ color: '#8a9488' }}>Chargement des accords...</Text>
            </View>
          ) : deals.length === 0 ? (
            <View style={{ padding: Spacing.five, alignItems: 'center' }}>
              <Text style={{ color: '#8a9488' }}>Aucun accord en cours.</Text>
            </View>
          ) : deals.map((d) => (
            <View key={d.id} style={styles.dealCard}>
              <View style={styles.dealHeader}>
                <Text style={styles.dealGic}>{d.gicName}</Text>
                <View style={[styles.statusBadge, d.status === 'accepte' ? styles.statusSuccess : styles.statusPending]}>
                  <Text style={styles.statusText}>{d.status === 'accepte' ? '✓ Accord Validé' : '⌛ En Négociation'}</Text>
                </View>
              </View>

              <Text style={styles.buyerName}>Acheteur / Investisseur : {d.buyerName}</Text>

              <View style={styles.amountBox}>
                <Text style={styles.amountLabel}>Avance Intrants / Fonds :</Text>
                <Text style={styles.amountVal}>{d.amountFcfa.toLocaleString()} FCFA</Text>
              </View>

              <Text style={styles.inputDesc}>📦 Intrants : {d.inputDescription}</Text>
              <Text style={styles.reservedText}>🌾 Volume réservé garanti : {d.reservedVolumeKg} kg de {d.reservedProduct}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Modale de proposition de préfinancement */}
        <Modal visible={modalVisible} animationType="slide" transparent>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={{ paddingHorizontal: Spacing.five, paddingTop: Spacing.three, paddingBottom: Spacing.two }}>
                <Text style={{ fontSize: 14, color: '#8a9488', lineHeight: 20 }}>
                  Le préfinancement (ou contrat de culture) permet aux acheteurs d'avancer des fonds ou des intrants agricoles à un GIC en échange de l'exclusivité et d'un prix garanti sur une partie de la future récolte. Cela sécurise l'approvisionnement de l'acheteur et assure un financement initial au GIC.
                </Text>
              </View>

              <View style={styles.modalHeader}>
                <Text style={styles.sectionTitle}>GICs Recommandés (Indice de Confiance)</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Feather name="x" size={24} color="#101e0f" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.inputLabel}>GIC bénéficiaire</Text>
                <TextInput
                  style={styles.textInput}
                  value={gicName}
                  onChangeText={setGicName}
                />

                <Text style={styles.inputLabel}>Nom de l'acheteur / Entreprise</Text>
                <TextInput
                  style={styles.textInput}
                  value={buyerName}
                  onChangeText={setBuyerName}
                />

                <Text style={styles.inputLabel}>Montant total de l'avance (FCFA)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={amountFcfa}
                  onChangeText={setAmountFcfa}
                />

                <Text style={styles.inputLabel}>Description des intrants ou matériel avancés</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="ex: 20 sacs NPK 20-10-10 + Semences certifiées"
                  placeholderTextColor="#889e87"
                  value={inputDescription}
                  onChangeText={setInputDescription}
                />

                <Text style={styles.inputLabel}>Produit réservé en contrepartie</Text>
                <TextInput
                  style={styles.textInput}
                  value={reservedProduct}
                  onChangeText={setReservedProduct}
                />

                <Text style={styles.inputLabel}>Volume garanti réservé (kg)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={reservedVolumeKg}
                  onChangeText={setReservedVolumeKg}
                />

                <TouchableOpacity style={styles.modalSubmitButton} onPress={handleCreateDeal} activeOpacity={0.85}>
                  <Text style={styles.modalSubmitText}>Transmettre la proposition</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Modale de Trust Score (Évaluation) */}
        <Modal visible={ratingModalVisible} animationType="fade" transparent>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.sectionTitle}>Évaluer ce GIC</Text>
                  <TouchableOpacity onPress={() => setRatingModalVisible(false)}>
                    <Feather name="x" size={24} color="#101e0f" />
                  </TouchableOpacity>
                </View>

                <View style={{ paddingHorizontal: Spacing.five, paddingBottom: Spacing.four }}>
                  <Text style={{ fontSize: 13, color: '#8a9488', marginBottom: Spacing.three }}>
                    Partagez votre retour suite à la visite terrain ou à la dernière livraison.
                  </Text>

                  <Text style={styles.inputLabel}>Note (sur 5)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={ratingScore}
                    onChangeText={setRatingScore}
                  />

                  <Text style={styles.inputLabel}>Commentaire d'audit</Text>
                  <TextInput
                    style={[styles.textInput, { height: 80 }]}
                    multiline
                    value={ratingComment}
                    onChangeText={setRatingComment}
                  />

                  <TouchableOpacity style={styles.modalSubmitButton} onPress={handleCreateRating} activeOpacity={0.85}>
                    <Text style={styles.modalSubmitText}>Soumettre l'avis</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
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
  addNavButton: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#d97834', alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: Spacing.three, paddingBottom: 90 },
  trustCard: { backgroundColor: '#ffffff', borderRadius: 20, padding: Spacing.three, marginBottom: Spacing.three, borderWidth: 1, borderColor: '#e6dfcc' },
  trustHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  trustTitle: { fontSize: 15, fontWeight: '800', color: '#101e0f' },
  trustSub: { fontSize: 11, color: '#5a6258' },
  starBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff7ed', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  starBadgeText: { fontSize: 13, fontWeight: '900', color: '#d97834' },
  badgesRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  trustTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3ecd8', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  trustTagText: { fontSize: 11, fontWeight: '700', color: '#101e0f' },
  reviewItem: { backgroundColor: '#f9f6ef', padding: 10, borderRadius: 10, marginTop: 6 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  reviewAuthor: { fontSize: 12, fontWeight: '700', color: '#101e0f' },
  reviewRating: { fontSize: 12, fontWeight: '800', color: '#d97834' },
  reviewComment: { fontSize: 13, color: '#5a6258', fontStyle: 'italic', marginTop: 4 },
  addReviewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0fdf4', paddingVertical: 12, borderRadius: 10, marginTop: 12, borderWidth: 1, borderColor: '#bbf7d0' },
  addReviewBtnText: { color: '#15803d', fontSize: 13, fontWeight: '700' },
  actionButton: { backgroundColor: '#101e0f', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 14, borderRadius: 14, marginHorizontal: Spacing.four, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  actionButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#101e0f', marginBottom: Spacing.three },
  dealCard: { backgroundColor: '#ffffff', borderRadius: 18, padding: Spacing.three, marginBottom: Spacing.three, borderWidth: 1, borderColor: '#e0d8c3' },
  dealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  dealGic: { fontSize: 15, fontWeight: '800', color: '#101e0f', flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusSuccess: { backgroundColor: '#f0fdf4' },
  statusPending: { backgroundColor: '#fffbeb' },
  statusText: { fontSize: 11, fontWeight: '800', color: '#15803d' },
  buyerName: { fontSize: 11, color: '#889e87', fontWeight: '600', marginBottom: 8 },
  amountBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f3ecd8', padding: 10, borderRadius: 10, marginBottom: 8 },
  amountLabel: { fontSize: 12, color: '#101e0f', fontWeight: '600' },
  amountVal: { fontSize: 15, fontWeight: '900', color: '#d97834' },
  inputDesc: { fontSize: 13, color: '#101e0f', marginBottom: 4 },
  reservedText: { fontSize: 13, fontWeight: '800', color: '#101e0f' },
  modalOverlay: { flex: 1, backgroundColor: '#101e0f70', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#f3ecd8', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: Spacing.four, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.three },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#101e0f' },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#101e0f', marginTop: 10, marginBottom: 6 },
  textInput: { backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#e0d8c3', borderRadius: 14, padding: 12, fontSize: 14, color: '#101e0f' },
  modalSubmitButton: { backgroundColor: '#101e0f', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 20, marginBottom: 20 },
  modalSubmitText: { color: '#f3ecd8', fontWeight: '800', fontSize: 15 },
});
