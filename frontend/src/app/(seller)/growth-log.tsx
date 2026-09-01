import { Dimensions, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { ParcelGrowthRecord, dbService } from '@/services/database';
import { BottomNavBar } from '@/components/ui/bottom-nav-bar';
import { useToast } from '@/components/ui/toast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

const STAGES: ('Semis' | 'Levée' | 'Floraison' | 'Maturation' | 'Prêt à récolter')[] = [
  'Semis',
  'Levée',
  'Floraison',
  'Maturation',
  'Prêt à récolter',
];

export default function GrowthLogScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [parcels, setParcels] = useState<ParcelGrowthRecord[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  // Form states
  const [parcelName, setParcelName] = useState('');
  const [crop, setCrop] = useState('Tomates');
  const [sowingDate, setSowingDate] = useState('2026-05-10');
  const [stage, setStage] = useState<'Semis' | 'Levée' | 'Floraison' | 'Maturation' | 'Prêt à récolter'>('Maturation');
  const [estimatedHarvestDate, setEstimatedHarvestDate] = useState('2026-08-15');
  const [estimatedVolumeKg, setEstimatedVolumeKg] = useState('2500');
  const [actualHarvestVolumeKg, setActualHarvestVolumeKg] = useState('');

  useEffect(() => {
    loadParcels();
  }, []);

  const loadParcels = async () => {
    try {
      await dbService.initDatabase();
      const list = await dbService.getParcels();
      setParcels(list);
    } catch (err) {
      console.warn('Erreur chargement parcelles:', err);
    }
  };

  const handleAddParcel = async () => {
    if (!parcelName.trim() || !estimatedVolumeKg.trim()) {
      showToast({ message: 'Veuillez renseigner le nom de la parcelle et l\'estimation.', type: 'warning' });
      return;
    }
    try {
      const newP = await dbService.addParcel(
        parcelName.trim(),
        crop,
        sowingDate,
        stage,
        estimatedHarvestDate,
        parseFloat(estimatedVolumeKg),
        actualHarvestVolumeKg ? parseFloat(actualHarvestVolumeKg) : undefined
      );
      setParcels(prev => [newP, ...prev]);
      setParcelName('');
      setActualHarvestVolumeKg('');
      setModalVisible(false);
      showToast({ message: 'Parcelle enregistrée avec succès !', type: 'success' });
    } catch (err) {
      showToast({ message: 'Erreur lors de l\'enregistrement de la parcelle.', type: 'error' });
    }
  };

  // Algorithme de détection des baisses de rendement > 15%
  const alerts = parcels.filter(p => {
    if (p.actualHarvestVolumeKg && p.estimatedVolumeKg > 0) {
      const ratio = p.actualHarvestVolumeKg / p.estimatedVolumeKg;
      return ratio < 0.85; // Baisse supérieure à 15%
    }
    return false;
  });

  return (
    <SafeAreaView style={styles.outerContainer}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#101e0f" />

        {/* En-tête */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color="#f3ecd8" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>Journal de Croissance</Text>
            <Text style={styles.headerSubtitle}>Suivi Parcelles & Prédiction Rendement</Text>
          </View>
          <TouchableOpacity style={styles.addNavButton} onPress={() => setModalVisible(true)}>
            <Feather name="plus" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Bannière Alerte Baisse > 15% si détectée */}
          {alerts.map(a => {
            const lossPct = Math.round((1 - (a.actualHarvestVolumeKg! / a.estimatedVolumeKg)) * 100);
            return (
              <View key={a.id} style={styles.alertBanner}>
                <View style={styles.alertHeader}>
                  <Feather name="alert-triangle" size={20} color="#b91c1c" style={{ marginRight: 8 }} />
                  <Text style={styles.alertTitle}>BAISSE DE RENDEMENT DÉTECTÉE (&gt; 15%)</Text>
                </View>
                <Text style={styles.alertBody}>
                  Sur <Text style={{ fontWeight: '800' }}>{a.parcelName}</Text> ({a.crop}) : Est. initiale {a.estimatedVolumeKg} kg ➔ Récolté réel : {a.actualHarvestVolumeKg} kg (<Text style={{ fontWeight: '800', color: '#b91c1c' }}>Perte -{lossPct}%</Text>).
                </Text>
                <TouchableOpacity style={styles.alertAction} onPress={() => router.push('/(seller)/agronomist')} activeOpacity={0.8}>
                  <Feather name="shield" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.alertActionText}>Consulter l'Agronome IA</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {/* Action ajouter parcelle */}
          <TouchableOpacity style={styles.actionButton} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
            <Feather name="plus-circle" size={18} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.actionButtonText}>+ Suivre une nouvelle parcelle</Text>
          </TouchableOpacity>

          {/* Liste des parcelles */}
          <Text style={styles.sectionTitle}>Parcelles sous suivi ({parcels.length})</Text>

          {parcels.map((p) => {
            const hasDrop = p.actualHarvestVolumeKg && (p.actualHarvestVolumeKg / p.estimatedVolumeKg < 0.85);
            return (
              <View key={p.id} style={[styles.parcelCard, hasDrop ? styles.parcelCardAlert : undefined]}>
                <View style={styles.parcelHeader}>
                  <Text style={styles.parcelName}>{p.parcelName}</Text>
                  <View style={styles.stageBadge}>
                    <Text style={styles.stageBadgeText}>{p.stage}</Text>
                  </View>
                </View>

                <View style={styles.parcelDetailsRow}>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>Culture</Text>
                    <Text style={styles.detailVal}>{p.crop}</Text>
                  </View>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>Date Semis</Text>
                    <Text style={styles.detailVal}>{p.sowingDate}</Text>
                  </View>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>Récolte Est.</Text>
                    <Text style={styles.detailVal}>{p.estimatedHarvestDate}</Text>
                  </View>
                </View>

                <View style={styles.volumeRow}>
                  <Text style={styles.volumeLabel}>Estimation Volume :</Text>
                  <Text style={styles.volumeVal}>{p.estimatedVolumeKg} kg</Text>
                </View>

                {p.actualHarvestVolumeKg !== undefined && (
                  <View style={[styles.volumeRow, { marginTop: 6 }]}>
                    <Text style={styles.volumeLabel}>Récolte Réelle Finale :</Text>
                    <Text style={[styles.volumeVal, hasDrop ? { color: '#b91c1c' } : { color: '#15803d' }]}>
                      {p.actualHarvestVolumeKg} kg {hasDrop ? '(Écart -15%+)' : '✓ Conforme'}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        {/* Modale de saisie de parcelle */}
        <Modal visible={modalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nouvelle Parcelle de Croissance</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Feather name="x" size={24} color="#101e0f" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.inputLabel}>Nom de la parcelle / Champ</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="ex: Parcelle Ouest Bafoussam (3 ha)"
                  placeholderTextColor="#889e87"
                  value={parcelName}
                  onChangeText={setParcelName}
                />

                <Text style={styles.inputLabel}>Culture</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="ex: Tomates, Maïs, Manioc..."
                  placeholderTextColor="#889e87"
                  value={crop}
                  onChangeText={setCrop}
                />

                <Text style={styles.inputLabel}>Stade de croissance actuel</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 8 }}>
                  {STAGES.map((stg) => (
                    <TouchableOpacity
                      key={stg}
                      style={[styles.chip, stage === stg && styles.chipActive]}
                      onPress={() => setStage(stg)}
                    >
                      <Text style={[styles.chipText, stage === stg && styles.chipTextActive]}>{stg}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.inputLabel}>Volume de récolte estimé (kg)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="ex: 3000"
                  placeholderTextColor="#889e87"
                  keyboardType="numeric"
                  value={estimatedVolumeKg}
                  onChangeText={setEstimatedVolumeKg}
                />

                <Text style={styles.inputLabel}>Volume réellement récolté (kg) [Optionnel si récolté]</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="ex: 2200"
                  placeholderTextColor="#889e87"
                  keyboardType="numeric"
                  value={actualHarvestVolumeKg}
                  onChangeText={setActualHarvestVolumeKg}
                />

                <TouchableOpacity style={styles.modalSubmitButton} onPress={handleAddParcel} activeOpacity={0.85}>
                  <Text style={styles.modalSubmitText}>Enregistrer la Parcelle</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <BottomNavBar role="seller" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#101e0f', alignItems: 'center' },
  container: { flex: 1, width: CONTAINER_WIDTH, backgroundColor: '#f3ecd8' },
  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.three, backgroundColor: '#101e0f', borderBottomWidth: 1, borderBottomColor: '#1d331b' },
  backButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#1d331b', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#f3ecd8' },
  headerSubtitle: { fontSize: 11, color: '#889e87' },
  addNavButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#d97834', alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: Spacing.three },
  alertBanner: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fca5a5', borderRadius: 16, padding: Spacing.three, marginBottom: Spacing.three },
  alertHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  alertTitle: { fontSize: 12, fontWeight: '800', color: '#b91c1c' },
  alertBody: { fontSize: 12, color: '#7f1d1d', lineHeight: 18, marginBottom: 10 },
  alertAction: { flexDirection: 'row', backgroundColor: '#b91c1c', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, alignSelf: 'flex-start', alignItems: 'center' },
  alertActionText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  actionButton: { flexDirection: 'row', backgroundColor: '#d97834', padding: Spacing.three, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.four },
  actionButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#101e0f', marginBottom: Spacing.three },
  parcelCard: { backgroundColor: '#ffffff', borderRadius: 18, padding: Spacing.three, marginBottom: Spacing.three, borderWidth: 1, borderColor: '#e0d8c3' },
  parcelCardAlert: { borderColor: '#fca5a5', backgroundColor: '#fffafa' },
  parcelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  parcelName: { fontSize: 15, fontWeight: '800', color: '#101e0f' },
  stageBadge: { backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  stageBadgeText: { fontSize: 11, fontWeight: '800', color: '#15803d' },
  parcelDetailsRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f9f6ef', padding: 10, borderRadius: 12, marginBottom: 10 },
  detailCol: { alignItems: 'center' },
  detailLabel: { fontSize: 10, color: '#889e87', fontWeight: '600' },
  detailVal: { fontSize: 12, fontWeight: '800', color: '#101e0f', marginTop: 2 },
  volumeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  volumeLabel: { fontSize: 13, color: '#101e0f', fontWeight: '600' },
  volumeVal: { fontSize: 14, fontWeight: '800', color: '#d97834' },
  modalOverlay: { flex: 1, backgroundColor: '#101e0f70', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#f3ecd8', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: Spacing.four, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.three },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#101e0f' },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#101e0f', marginTop: 10, marginBottom: 6 },
  chip: { backgroundColor: '#ffffff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, marginRight: 8, borderWidth: 1, borderColor: '#e0d8c3' },
  chipActive: { backgroundColor: '#101e0f', borderColor: '#101e0f' },
  chipText: { fontSize: 12, color: '#101e0f', fontWeight: '600' },
  chipTextActive: { color: '#f3ecd8', fontWeight: '800' },
  textInput: { backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#e0d8c3', borderRadius: 14, padding: 12, fontSize: 14, color: '#101e0f' },
  modalSubmitButton: { backgroundColor: '#d97834', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 20, marginBottom: 20 },
  modalSubmitText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
});
