import { Dimensions, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { AgronomistQuestion, dbService } from '@/services/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

const CROPS = ['Tomates', 'Maïs', 'Manioc', 'Plantains', 'Poivrons', 'Arachides', 'Autre'];
const CATEGORIES = ['Maladie', 'Fertilisation', 'Irrigation', 'Parasites', 'Conseil Général'];

export default function AgronomistScreen() {
  const router = useRouter();
  const [questions, setQuestions] = useState<AgronomistQuestion[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  // Form states
  const [selectedCrop, setSelectedCrop] = useState(CROPS[0]);
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [questionText, setQuestionText] = useState('');
  const [hasPhoto, setHasPhoto] = useState(false);

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      await dbService.initDatabase();
      const list = await dbService.getAgronomistQuestions();
      setQuestions(list);
    } catch (err) {
      console.warn('Erreur chargement questions agronome:', err);
    }
  };

  const handleCreateQuestion = async () => {
    if (!questionText.trim()) {
      alert('Veuillez décrire votre question ou symptôme.');
      return;
    }
    try {
      const mockPhoto = hasPhoto ? 'https://images.unsplash.com/photo-1592417817098-8f3d6eb231fc?q=80&w=400' : undefined;
      const newQ = await dbService.addAgronomistQuestion(selectedCrop, selectedCategory, questionText.trim(), mockPhoto);
      setQuestions(prev => [newQ, ...prev]);
      setQuestionText('');
      setHasPhoto(false);
      setModalVisible(false);
    } catch (err) {
      alert('Erreur lors de la sauvegarde de la question.');
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
            <Text style={styles.headerTitle}>Assistance Agronome</Text>
            <Text style={styles.headerSubtitle}>Questions & Diagnostics Phyto</Text>
          </View>
          <TouchableOpacity style={styles.addNavButton} onPress={() => setModalVisible(true)}>
            <Feather name="plus" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Carte d'information offline */}
          <View style={styles.infoBanner}>
            <Feather name="wifi-off" size={18} color="#d97834" style={{ marginRight: 10 }} />
            <Text style={styles.infoBannerText}>
              Vos questions sont sauvegardées localement et envoyées automatiquement dès le retour du réseau.
            </Text>
          </View>

          {/* Bouton poser une question */}
          <TouchableOpacity style={styles.actionButton} onPress={() => setModalVisible(true)}>
            <Feather name="message-square" size={20} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.actionButtonText}>Poser une question à l'agronome</Text>
          </TouchableOpacity>

          {/* Liste des questions */}
          <Text style={styles.sectionTitle}>Historique de vos questions ({questions.length})</Text>

          {questions.map((q) => (
            <View key={q.id} style={styles.questionCard}>
              <View style={styles.questionHeader}>
                <View style={styles.badgeRow}>
                  <View style={styles.cropBadge}>
                    <Text style={styles.cropBadgeText}>{q.crop}</Text>
                  </View>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{q.category}</Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, q.status === 'repondu' ? styles.statusBadgeSuccess : styles.statusBadgePending]}>
                  <Text style={[styles.statusBadgeText, q.status === 'repondu' ? styles.statusTextSuccess : styles.statusTextPending]}>
                    {q.status === 'repondu' ? '✓ Répondu' : '⌛ En attente'}
                  </Text>
                </View>
              </View>

              <Text style={styles.questionText}>{q.question}</Text>

              {q.photoUrl && (
                <View style={styles.photoIndicator}>
                  <Feather name="image" size={14} color="#889e87" style={{ marginRight: 4 }} />
                  <Text style={styles.photoIndicatorText}>Photo de symptôme jointe</Text>
                </View>
              )}

              {/* Réponse de l'agronome */}
              {q.status === 'repondu' && q.answer ? (
                <View style={styles.answerBox}>
                  <View style={styles.answerHeader}>
                    <Feather name="check-circle" size={16} color="#101e0f" style={{ marginRight: 6 }} />
                    <Text style={styles.answerTitle}>Conseil de l'Agronome SI-TCHA :</Text>
                  </View>
                  <Text style={styles.answerText}>{q.answer}</Text>
                </View>
              ) : (
                <Text style={styles.pendingHint}>
                  Un agronome analysera votre symptôme dès la synchronisation des données.
                </Text>
              )}
            </View>
          ))}
        </ScrollView>

        {/* Modale de saisie de question */}
        <Modal visible={modalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nouvelle Question Agronome</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Feather name="x" size={24} color="#101e0f" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.inputLabel}>Culture concernée</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {CROPS.map((crop) => (
                    <TouchableOpacity
                      key={crop}
                      style={[styles.chip, selectedCrop === crop && styles.chipActive]}
                      onPress={() => setSelectedCrop(crop)}
                    >
                      <Text style={[styles.chipText, selectedCrop === crop && styles.chipTextActive]}>{crop}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.inputLabel}>Type de problème / Catégorie</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.chip, selectedCategory === cat && styles.chipActive]}
                      onPress={() => setSelectedCategory(cat)}
                    >
                      <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.inputLabel}>Description détaillée du symptôme</Text>
                <TextInput
                  style={[styles.textInput, { height: 100 }]}
                  placeholder="Décrivez les taches, la couleur des feuilles, la météo récente..."
                  placeholderTextColor="#889e87"
                  multiline
                  value={questionText}
                  onChangeText={setQuestionText}
                />

                <TouchableOpacity
                  style={[styles.photoButton, hasPhoto && styles.photoButtonActive]}
                  onPress={() => setHasPhoto(!hasPhoto)}
                >
                  <Feather name="camera" size={20} color={hasPhoto ? '#101e0f' : '#d97834'} style={{ marginRight: 8 }} />
                  <Text style={[styles.photoButtonText, hasPhoto && styles.photoButtonTextActive]}>
                    {hasPhoto ? '✓ Photo du symptôme jointe' : '+ Joindre une photo de la plante'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modalSubmitButton} onPress={handleCreateQuestion}>
                  <Text style={styles.modalSubmitText}>Enregistrer la question (File Offline)</Text>
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
  infoBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', padding: Spacing.three, borderRadius: 12, marginBottom: Spacing.three, borderWidth: 1, borderColor: '#e0d8c3' },
  infoBannerText: { flex: 1, fontSize: 12, color: '#101e0f', lineHeight: 16 },
  actionButton: { flexDirection: 'row', backgroundColor: '#d97834', padding: Spacing.three, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.four },
  actionButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#101e0f', marginBottom: Spacing.three },
  questionCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: Spacing.three, marginBottom: Spacing.three, borderWidth: 1, borderColor: '#e0d8c3' },
  questionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  badgeRow: { flexDirection: 'row', gap: 6 },
  cropBadge: { backgroundColor: '#f3ecd8', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  cropBadgeText: { fontSize: 11, fontWeight: '700', color: '#101e0f' },
  categoryBadge: { backgroundColor: '#e8f0e8', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  categoryBadgeText: { fontSize: 11, fontWeight: '600', color: '#889e87' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeSuccess: { backgroundColor: '#e6f4ea' },
  statusBadgePending: { backgroundColor: '#fef7e0' },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  statusTextSuccess: { color: '#137333' },
  statusTextPending: { color: '#b06000' },
  questionText: { fontSize: 14, color: '#101e0f', lineHeight: 20, marginBottom: 8 },
  photoIndicator: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  photoIndicatorText: { fontSize: 12, color: '#889e87', fontStyle: 'italic' },
  answerBox: { backgroundColor: '#f0f7f0', padding: 12, borderRadius: 10, marginTop: 6, borderLeftWidth: 3, borderLeftColor: '#101e0f' },
  answerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  answerTitle: { fontSize: 12, fontWeight: '700', color: '#101e0f' },
  answerText: { fontSize: 13, color: '#101e0f', lineHeight: 18 },
  pendingHint: { fontSize: 12, color: '#889e87', fontStyle: 'italic', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#f3ecd8', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.four, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.three },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#101e0f' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#101e0f', marginTop: 12, marginBottom: 6 },
  chipScroll: { flexDirection: 'row', marginBottom: 6 },
  chip: { backgroundColor: '#ffffff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 8, borderWidth: 1, borderColor: '#e0d8c3' },
  chipActive: { backgroundColor: '#d97834', borderColor: '#d97834' },
  chipText: { fontSize: 12, color: '#101e0f' },
  chipTextActive: { color: '#ffffff', fontWeight: '700' },
  textInput: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e0d8c3', borderRadius: 10, padding: 12, fontSize: 14, color: '#101e0f', textAlignVertical: 'top' },
  photoButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d97834', borderRadius: 10, padding: 12, marginTop: 16 },
  photoButtonActive: { backgroundColor: '#e8f0e8', borderColor: '#101e0f' },
  photoButtonText: { color: '#d97834', fontWeight: '600', fontSize: 13 },
  photoButtonTextActive: { color: '#101e0f', fontWeight: '700' },
  modalSubmitButton: { backgroundColor: '#d97834', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 20, marginBottom: 20 },
  modalSubmitText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
});
