import { Dimensions, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { AgronomistQuestion, dbService } from '@/services/database';
import { BottomNavBar } from '@/components/ui/bottom-nav-bar';
import { useToast } from '@/components/ui/toast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

const CROPS = ['Tomates', 'Maïs', 'Manioc', 'Plantains', 'Poivrons', 'Arachides', 'Autre'];
const CATEGORIES = ['Maladie', 'Fertilisation', 'Irrigation', 'Parasites', 'Conseil Général'];

const QUICK_PROMPTS = [
  { crop: 'Tomates', category: 'Maladie', text: 'Feuilles jaunies avec taches brunes (Mildiou de la tomate)' },
  { crop: 'Maïs', category: 'Parasites', text: 'Trous dans les feuilles et chenilles au cœur des épis' },
  { crop: 'Manioc', category: 'Maladie', text: 'Mosaïque du manioc: déformation et jaunissement des feuilles' },
  { crop: 'Plantains', category: 'Fertilisation', text: 'Quelle dose d\'engrais NPK appliquer au moment du rejetonnage ?' },
];

export default function AgronomistScreen() {
  const router = useRouter();
  const { showToast } = useToast();
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
      showToast({ message: 'Veuillez décrire votre question ou symptôme.', type: 'warning' });
      return;
    }
    try {
      const mockPhoto = hasPhoto ? 'https://images.unsplash.com/photo-1592417817098-8f3d6eb231fc?q=80&w=400' : undefined;
      await dbService.addAgronomistQuestion(selectedCrop, selectedCategory, questionText.trim(), mockPhoto);
      await loadQuestions();
      setQuestionText('');
      setHasPhoto(false);
      setModalVisible(false);
      showToast({ message: 'Question transmise à l\'Agronome IA !', type: 'success' });
    } catch (err) {
      showToast({ message: 'Erreur lors de la sauvegarde de la question.', type: 'error' });
    }
  };

  const handleApplyQuickPrompt = (prompt: typeof QUICK_PROMPTS[0]) => {
    setSelectedCrop(prompt.crop);
    setSelectedCategory(prompt.category);
    setQuestionText(prompt.text);
    setModalVisible(true);
  };

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
            <Text style={styles.headerTitle}>Agronome IA SI-TCHA</Text>
            <Text style={styles.headerSubtitle}>Diagnostique Phyto & Conseils 24/7</Text>
          </View>
          <TouchableOpacity style={styles.addNavButton} onPress={() => setModalVisible(true)}>
            <Feather name="plus" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Carte d'information offline AI */}
          <View style={styles.infoBanner}>
            <View style={styles.aiBadgeIcon}>
              <Feather name="cpu" size={20} color="#d97834" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoBannerTitle}>Mode IA Hors-Ligne Actif</Text>
              <Text style={styles.infoBannerText}>
                L'IA analyse vos symptômes localement et synchronise les ordonnances agronomiques dès le retour du réseau.
              </Text>
            </View>
          </View>

          {/* Quick Prompts Suggestions */}
          <View style={styles.promptsSection}>
            <Text style={styles.promptsTitle}>Questions fréquentes & Diagnostics rapides</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promptsScroll}>
              {QUICK_PROMPTS.map((prompt, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.promptCard}
                  onPress={() => handleApplyQuickPrompt(prompt)}
                  activeOpacity={0.8}
                >
                  <View style={styles.promptBadgeRow}>
                    <Text style={styles.promptCropText}>🌱 {prompt.crop}</Text>
                    <Text style={styles.promptCategoryText}>{prompt.category}</Text>
                  </View>
                  <Text style={styles.promptText} numberOfLines={2}>{prompt.text}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Bouton poser une question */}
          <TouchableOpacity style={styles.actionButton} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
            <Feather name="message-square" size={20} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.actionButtonText}>+ Poser une question à l'agronome</Text>
          </TouchableOpacity>

          {/* Liste des questions */}
          <Text style={styles.sectionTitle}>Historique des Consultations ({questions.length})</Text>

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
                    {q.status === 'repondu' ? '✓ Ordonnance IA Validée' : '⌛ Analyse locale'}
                  </Text>
                </View>
              </View>

              <Text style={styles.questionText}>{q.question}</Text>

              {q.photoUrl && (
                <View style={styles.photoIndicator}>
                  <Feather name="image" size={14} color="#d97834" style={{ marginRight: 4 }} />
                  <Text style={styles.photoIndicatorText}>Photo du symptôme analysée</Text>
                </View>
              )}

              {/* Réponse de l'agronome */}
              {q.status === 'repondu' && q.answer ? (
                <View style={styles.answerBox}>
                  <View style={styles.answerHeader}>
                    <Feather name="check-circle" size={16} color="#15803d" style={{ marginRight: 6 }} />
                    <Text style={styles.answerTitle}>Conseil & Traitement recommandé :</Text>
                  </View>
                  <Text style={styles.answerText}>{q.answer}</Text>
                </View>
              ) : (
                <View style={styles.pendingBox}>
                  <Feather name="clock" size={14} color="#b45309" style={{ marginRight: 6 }} />
                  <Text style={styles.pendingHint}>
                    L'Agronome IA synthétise la solution optimale pour votre parcelle...
                  </Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        {/* Modale de saisie de question */}
        <Modal visible={modalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nouvelle Consultation Agronome</Text>
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
                  placeholder="Décrivez les taches, la couleur des feuilles, les ravageurs observés..."
                  placeholderTextColor="#889e87"
                  multiline
                  value={questionText}
                  onChangeText={setQuestionText}
                />

                <TouchableOpacity
                  style={[styles.photoButton, hasPhoto && styles.photoButtonActive]}
                  onPress={() => setHasPhoto(!hasPhoto)}
                >
                  <Feather name="camera" size={20} color={hasPhoto ? '#15803d' : '#d97834'} style={{ marginRight: 8 }} />
                  <Text style={[styles.photoButtonText, hasPhoto && styles.photoButtonTextActive]}>
                    {hasPhoto ? '✓ Photo du symptôme jointe' : '+ Joindre une photo de la feuille / plante'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modalSubmitButton} onPress={handleCreateQuestion} activeOpacity={0.85}>
                  <Text style={styles.modalSubmitText}>Enregistrer la consultation (IA Offline)</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    backgroundColor: '#101e0f',
    borderBottomWidth: 1,
    borderBottomColor: '#1d331b',
  },
  backButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#1d331b', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#f3ecd8' },
  headerSubtitle: { fontSize: 11, color: '#889e87' },
  addNavButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#d97834', alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: Spacing.three },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: Spacing.three,
    borderRadius: 16,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: '#e0d8c3',
    gap: 12,
  },
  aiBadgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  infoBannerTitle: { fontSize: 13, fontWeight: '800', color: '#101e0f' },
  infoBannerText: { fontSize: 11, color: '#5a6258', lineHeight: 16, marginTop: 2 },
  promptsSection: { marginBottom: Spacing.three },
  promptsTitle: { fontSize: 13, fontWeight: '800', color: '#101e0f', marginBottom: 8 },
  promptsScroll: { gap: 10, paddingRight: 10 },
  promptCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6dfcc',
    borderRadius: 14,
    padding: 12,
    width: 240,
    gap: 6,
  },
  promptBadgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  promptCropText: { fontSize: 11, fontWeight: '800', color: '#101e0f' },
  promptCategoryText: { fontSize: 10, fontWeight: '700', color: '#d97834' },
  promptText: { fontSize: 12, color: '#5a6258', lineHeight: 16 },
  actionButton: { flexDirection: 'row', backgroundColor: '#d97834', padding: Spacing.three, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.four },
  actionButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#101e0f', marginBottom: Spacing.three },
  questionCard: { backgroundColor: '#ffffff', borderRadius: 18, padding: Spacing.three, marginBottom: Spacing.three, borderWidth: 1, borderColor: '#e0d8c3' },
  questionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  badgeRow: { flexDirection: 'row', gap: 6 },
  cropBadge: { backgroundColor: '#f3ecd8', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  cropBadgeText: { fontSize: 11, fontWeight: '800', color: '#101e0f' },
  categoryBadge: { backgroundColor: '#e8f0e8', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  categoryBadgeText: { fontSize: 11, fontWeight: '700', color: '#15803d' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusBadgeSuccess: { backgroundColor: '#f0fdf4' },
  statusBadgePending: { backgroundColor: '#fffbeb' },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  statusTextSuccess: { color: '#15803d' },
  statusTextPending: { color: '#b45309' },
  questionText: { fontSize: 14, color: '#101e0f', lineHeight: 20, marginBottom: 8, fontWeight: '500' },
  photoIndicator: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  photoIndicatorText: { fontSize: 12, color: '#d97834', fontWeight: '600' },
  answerBox: { backgroundColor: '#f0fdf4', padding: 12, borderRadius: 12, marginTop: 6, borderLeftWidth: 4, borderLeftColor: '#15803d' },
  answerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  answerTitle: { fontSize: 12, fontWeight: '800', color: '#15803d' },
  answerText: { fontSize: 13, color: '#101e0f', lineHeight: 18 },
  pendingBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', padding: 10, borderRadius: 10, marginTop: 6 },
  pendingHint: { fontSize: 11, color: '#b45309', fontWeight: '600', flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: '#101e0f70', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#f3ecd8', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: Spacing.four, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.three },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#101e0f' },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#101e0f', marginTop: 12, marginBottom: 6 },
  chipScroll: { flexDirection: 'row', marginBottom: 6 },
  chip: { backgroundColor: '#ffffff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, marginRight: 8, borderWidth: 1, borderColor: '#e0d8c3' },
  chipActive: { backgroundColor: '#d97834', borderColor: '#d97834' },
  chipText: { fontSize: 12, color: '#101e0f', fontWeight: '600' },
  chipTextActive: { color: '#ffffff', fontWeight: '800' },
  textInput: { backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#e0d8c3', borderRadius: 14, padding: 12, fontSize: 14, color: '#101e0f', textAlignVertical: 'top' },
  photoButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#d97834', borderRadius: 14, padding: 12, marginTop: 16 },
  photoButtonActive: { backgroundColor: '#f0fdf4', borderColor: '#15803d' },
  photoButtonText: { color: '#d97834', fontWeight: '700', fontSize: 13 },
  photoButtonTextActive: { color: '#15803d', fontWeight: '800' },
  modalSubmitButton: { backgroundColor: '#101e0f', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 20, marginBottom: 20 },
  modalSubmitText: { color: '#f3ecd8', fontWeight: '800', fontSize: 15 },
});
