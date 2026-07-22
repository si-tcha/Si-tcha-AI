import { Dimensions, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { PrefinancingDeal, TrustRating, dbService } from '@/services/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export default function PrefinancingScreen() {
  const router = useRouter();
  const [deals, setDeals] = useState<PrefinancingDeal[]>([]);
  const [ratings, setRatings] = useState<TrustRating[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  // Form states
  const [gicName, setGicName] = useState('GIC Agro-Vallée Bafoussam');
  const [buyerName, setBuyerName] = useState('SOCIÉTÉ AGRO-CENTRE');
  const [amountFcfa, setAmountFcfa] = useState('1000000');
  const [inputDescription, setInputDescription] = useState('Avance 20 sacs NPK + Semences certifiées');
  const [reservedProduct, setReservedProduct] = useState('Maïs jaune');
  const [reservedVolumeKg, setReservedVolumeKg] = useState('3000');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await dbService.initDatabase();
      const [storedDeals, storedRatings] = await Promise.all([
        dbService.getPrefinancingDeals(),
        dbService.getTrustRatings(),
      ]);
      setDeals(storedDeals);
      setRatings(storedRatings);
    } catch (err) {
      console.warn('Erreur chargement préfinancement:', err);
    }
  };

  const handleCreateDeal = async () => {
    if (!amountFcfa.trim() || !inputDescription.trim()) {
      alert('Veuillez remplir le montant et les intrants avancés.');
      return;
    }
    try {
      const newDeal = await dbService.addPrefinancingDeal(
        gicName,
        buyerName,
        parseFloat(amountFcfa),
        inputDescription.trim(),
        reservedProduct,
        parseFloat(reservedVolumeKg)
      );
      setDeals(prev => [newDeal, ...prev]);
      setInputDescription('');
      setModalVisible(false);
    } catch (err) {
      alert('Erreur création accord préfinancement.');
    }
  };

  return (
    <SafeAreaView style={styles.outerContainer}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f3ecd8" />

        {/* En-tête */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color="#101e0f" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>Préfinancement & Trust Score</Text>
            <Text style={styles.headerSubtitle}>Avances Intrants contre Réservation</Text>
          </View>
          <TouchableOpacity style={styles.addNavButton} onPress={() => setModalVisible(true)}>
            <Feather name="plus" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Carte Trust Score */}
          <View style={styles.trustCard}>
            <View style={styles.trustHeader}>
              <View>
                <Text style={styles.trustTitle}>Score de Confiance (Trust Score)</Text>
                <Text style={styles.trustSub}>Basé sur l'historique de livraison des GICs</Text>
              </View>
              <View style={styles.starBadge}>
                <Feather name="star" size={16} color="#d97834" style={{ marginRight: 4 }} />
                <Text style={styles.starBadgeText}>4.8 / 5.0</Text>
              </View>
            </View>

            <View style={styles.badgesRow}>
              <View style={styles.trustTag}>
                <Feather name="check-circle" size={12} color="#137333" style={{ marginRight: 4 }} />
                <Text style={styles.trustTagText}>100% Conforme</Text>
              </View>
              <View style={styles.trustTag}>
                <Feather name="shield" size={12} color="#101e0f" style={{ marginRight: 4 }} />
                <Text style={styles.trustTagText}>GIC Légalisé MINADER</Text>
              </View>
            </View>

            {/* Avis client */}
            {ratings.map(r => (
              <View key={r.id} style={styles.reviewItem}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewAuthor}>{r.authorName}</Text>
                  <Text style={styles.reviewRating}>★ {r.rating}</Text>
                </View>
                <Text style={styles.reviewComment}>"{r.comment}"</Text>
              </View>
            ))}
          </View>

          {/* Action proposer accord */}
          <TouchableOpacity style={styles.actionButton} onPress={() => setModalVisible(true)}>
            <Feather name="credit-card" size={18} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.actionButtonText}>Proposer un accord de préfinancement au GIC</Text>
          </TouchableOpacity>

          {/* Liste des accords */}
          <Text style={styles.sectionTitle}>Accords de Préfinancement ({deals.length})</Text>

          {deals.map((d) => (
            <View key={d.id} style={styles.dealCard}>
              <View style={styles.dealHeader}>
                <Text style={styles.dealGic}>{d.gicName}</Text>
                <View style={[styles.statusBadge, d.status === 'accepte' ? styles.statusSuccess : styles.statusPending]}>
                  <Text style={styles.statusText}>{d.status === 'accepte' ? '✓ Accord Accepté' : '⌛ En Attente'}</Text>
                </View>
              </View>

              <Text style={styles.buyerName}>Acheteur partenaire : {d.buyerName}</Text>
              
              <View style={styles.amountBox}>
                <Text style={styles.amountLabel}>Montant / Valeur de l'Avance :</Text>
                <Text style={styles.amountVal}>{d.amountFcfa.toLocaleString()} FCFA</Text>
              </View>

              <Text style={styles.inputDesc}>📦 Intrants fournis : {d.inputDescription}</Text>
              <Text style={styles.reservedText}>🌾 Produit réservé : {d.reservedVolumeKg} kg de {d.reservedProduct}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Modale de proposition de préfinancement */}
        <Modal visible={modalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nouveau Préfinancement</Text>
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

                <TouchableOpacity style={styles.modalSubmitButton} onPress={handleCreateDeal}>
                  <Text style={styles.modalSubmitText}>Envoyer la proposition de préfinancement</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#101e0f', alignItems: 'center' },
  container: { flex: 1, width: CONTAINER_WIDTH, backgroundColor: '#f3ecd8' },
  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.three, backgroundColor: '#f3ecd8', borderBottomWidth: 1, borderBottomColor: '#e0d8c3' },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#101e0f' },
  headerSubtitle: { fontSize: 12, color: '#889e87' },
  addNavButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#d97834', alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: Spacing.three },
  trustCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: Spacing.three, marginBottom: Spacing.three, borderWidth: 1, borderColor: '#e0d8c3' },
  trustHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  trustTitle: { fontSize: 15, fontWeight: '700', color: '#101e0f' },
  trustSub: { fontSize: 11, color: '#889e87' },
  starBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#feefe3', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  starBadgeText: { fontSize: 13, fontWeight: '800', color: '#d97834' },
  badgesRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  trustTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3ecd8', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  trustTagText: { fontSize: 11, fontWeight: '600', color: '#101e0f' },
  reviewItem: { backgroundColor: '#f9f6ef', padding: 10, borderRadius: 8, marginTop: 6 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  reviewAuthor: { fontSize: 12, fontWeight: '700', color: '#101e0f' },
  reviewRating: { fontSize: 12, fontWeight: '700', color: '#d97834' },
  reviewComment: { fontSize: 12, color: '#5a6258', fontStyle: 'italic' },
  actionButton: { flexDirection: 'row', backgroundColor: '#d97834', padding: Spacing.three, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.four },
  actionButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#101e0f', marginBottom: Spacing.three },
  dealCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: Spacing.three, marginBottom: Spacing.three, borderWidth: 1, borderColor: '#e0d8c3' },
  dealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  dealGic: { fontSize: 15, fontWeight: '700', color: '#101e0f' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusSuccess: { backgroundColor: '#e6f4ea' },
  statusPending: { backgroundColor: '#fef7e0' },
  statusText: { fontSize: 11, fontWeight: '700', color: '#101e0f' },
  buyerName: { fontSize: 12, color: '#889e87', marginBottom: 8 },
  amountBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f3ecd8', padding: 8, borderRadius: 8, marginBottom: 8 },
  amountLabel: { fontSize: 12, color: '#101e0f' },
  amountVal: { fontSize: 14, fontWeight: '800', color: '#d97834' },
  inputDesc: { fontSize: 13, color: '#101e0f', marginBottom: 4 },
  reservedText: { fontSize: 13, fontWeight: '700', color: '#101e0f' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#f3ecd8', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.four, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.three },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#101e0f' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#101e0f', marginTop: 10, marginBottom: 6 },
  textInput: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e0d8c3', borderRadius: 10, padding: 12, fontSize: 14, color: '#101e0f' },
  modalSubmitButton: { backgroundColor: '#d97834', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 20, marginBottom: 20 },
  modalSubmitText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
});
