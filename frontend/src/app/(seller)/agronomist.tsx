import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
} from 'react-native';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { AgronomistQuestion, dbService } from '@/services/database';
import { apiClient, isNetworkError } from '@/services/api';
import { BottomNavBar } from '@/components/ui/bottom-nav-bar';
import { useToast } from '@/components/ui/toast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export const CROPS = ['Tomates', 'Maïs', 'Manioc', 'Plantains', 'Poivrons', 'Arachides', 'Cacao', 'Autre'];
export const CATEGORIES = ['Maladie', 'Fertilisation', 'Irrigation', 'Parasites', 'Conseil Général'];

export const QUICK_PROMPTS = [
  { crop: 'Tomates', category: 'Maladie', text: 'Feuilles jaunies avec taches brunes (Mildiou de la tomate)' },
  { crop: 'Maïs', category: 'Parasites', text: 'Trous dans les feuilles et chenilles au cœur des épis' },
  { crop: 'Manioc', category: 'Maladie', text: 'Mosaïque du manioc : déformation et jaunissement des feuilles' },
  { crop: 'Plantains', category: 'Fertilisation', text: 'Quelle dose d’engrais NPK appliquer au moment du rejetonnage ?' },
];

export const TERRAIN_DISCLAIMER =
  'Ce conseil est une aide à la décision fournie par Dr. TCHA (IA) et ne remplace pas un diagnostic de terrain par un agronome professionnel.';

export default function AgronomistScreen() {
  const router = useRouter();
  const { showToast } = useToast();

  const [questions, setQuestions] = useState<AgronomistQuestion[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [isAsking, setIsAsking] = useState(false);

  // Formulaire
  const [selectedCrop, setSelectedCrop] = useState(CROPS[0]);
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [questionText, setQuestionText] = useState('');

  const loadQuestions = useCallback(async () => {
    try {
      await dbService.initDatabase();
      const list = await dbService.getAgronomistQuestions();
      setQuestions(list);
    } catch {
      // Ignorer l'erreur silencieusement en lecture locale
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const handleCreateQuestion = async () => {
    const trimmedQuestion = questionText.trim();
    if (!trimmedQuestion) {
      showToast({ message: 'Veuillez décrire votre question ou symptôme.', type: 'warning' });
      return;
    }
    if (trimmedQuestion.length < 5) {
      showToast({ message: 'La question doit contenir au moins 5 caractères.', type: 'warning' });
      return;
    }
    if (trimmedQuestion.length > 1000) {
      showToast({ message: 'La question ne doit pas dépasser 1000 caractères.', type: 'warning' });
      return;
    }

    setIsAsking(true);
    try {
      // 1. Appel au backend Gemini
      const res = await apiClient.askAgronomist(selectedCrop, selectedCategory, trimmedQuestion);

      if (!res?.answer) {
        throw new Error('Réponse vide du service agronomique.');
      }

      // 2. Sauvegarde de la consultation répondue dans l'historique local
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const answeredItem: AgronomistQuestion = {
        id,
        crop: selectedCrop,
        category: selectedCategory,
        question: trimmedQuestion,
        status: 'repondu',
        answer: res.answer,
        createdAt: new Date().toISOString(),
        synced: true,
      };

      setQuestions((prev) => [answeredItem, ...prev]);
      setQuestionText('');
      setModalVisible(false);
      showToast({ message: 'Ordonnance agronomique générée !', type: 'success' });
    } catch (err: any) {
      // Gestion honnête des erreurs fournisseur et réseau
      let failureReason = 'Service indisponible pour le moment.';

      if (isNetworkError(err)) {
        failureReason = 'Connexion réseau requise pour consulter l’Agronome IA en ligne.';
      } else if (err?.status === 504) {
        failureReason = 'Le service agronomique a mis trop de temps à répondre. Veuillez réessayer.';
      } else if (err?.message) {
        failureReason = err.message;
      }

      showToast({ message: failureReason, type: 'error' });

      // Enregistrement comme question en attente
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const pendingItem: AgronomistQuestion = {
        id,
        crop: selectedCrop,
        category: selectedCategory,
        question: trimmedQuestion,
        status: 'en_attente',
        answer: undefined,
        createdAt: new Date().toISOString(),
        synced: false,
      };
      setQuestions((prev) => [pendingItem, ...prev]);
      setModalVisible(false);
    } finally {
      setIsAsking(false);
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
            <Text style={styles.headerSubtitle}>Dr. TCHA · Diagnostic Phyto & Conseils</Text>
          </View>
          <TouchableOpacity
            style={styles.addNavButton}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Bandeau d'information honnête (en ligne requis, pas de fausse promesse hors-ligne) */}
          <View style={styles.infoBanner}>
            <View style={styles.aiBadgeIcon}>
              <Feather name="cpu" size={20} color="#d97834" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoBannerTitle}>Assistant Connecté Dr. TCHA (IA)</Text>
              <Text style={styles.infoBannerText}>
                Analyse agronomique et ordonnances phytosanitaires en ligne. Connexion Internet requise. Ne remplace pas un diagnostic de terrain.
              </Text>
            </View>
          </View>

          {/* Quick Prompts Suggestions */}
          <View style={styles.promptsSection}>
            <Text style={styles.promptsTitle}>Questions fréquentes & Diagnostics rapides</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.promptsScroll}
            >
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
                  <Text style={styles.promptText} numberOfLines={2}>
                    {prompt.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Bouton poser une question */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.85}
          >
            <Feather name="message-square" size={18} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.actionButtonText}>+ Poser une question au Dr. TCHA</Text>
          </TouchableOpacity>

          {/* Liste des consultations passées */}
          <Text style={styles.sectionTitle}>Historique des Consultations ({questions.length})</Text>

          {loadingHistory ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator color="#d97834" />
            </View>
          ) : questions.length === 0 ? (
            <View style={styles.emptyHistoryCard}>
              <Feather name="book-open" size={32} color="#889e87" style={{ marginBottom: 8 }} />
              <Text style={styles.emptyHistoryTitle}>Aucune consultation enregistrée</Text>
              <Text style={styles.emptyHistoryText}>
                Posez votre première question pour recevoir une ordonnance technique adaptée à votre culture.
              </Text>
            </View>
          ) : (
            questions.map((q) => (
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
                  <View
                    style={[
                      styles.statusBadge,
                      q.status === 'repondu' ? styles.statusBadgeSuccess : styles.statusBadgePending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        q.status === 'repondu' ? styles.statusTextSuccess : styles.statusTextPending,
                      ]}
                    >
                      {q.status === 'repondu' ? '✓ Ordonnance Fournie' : '⌛ Question en attente'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.questionText}>{q.question}</Text>

                {/* Réponse de l'agronome */}
                {q.status === 'repondu' && q.answer ? (
                  <View style={styles.answerBox}>
                    <View style={styles.answerHeader}>
                      <Feather name="check-circle" size={16} color="#15803d" style={{ marginRight: 6 }} />
                      <Text style={styles.answerTitle}>Ordonnance & Recommandations :</Text>
                    </View>
                    <Text style={styles.answerText}>{q.answer}</Text>

                    {/* Disclaimer professionnel obligatoire */}
                    <View style={styles.disclaimerBox}>
                      <Feather name="info" size={12} color="#854d0e" style={{ marginRight: 4 }} />
                      <Text style={styles.disclaimerText}>{TERRAIN_DISCLAIMER}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.pendingBox}>
                    <Feather name="clock" size={14} color="#b45309" style={{ marginRight: 6 }} />
                    <Text style={styles.pendingHint}>
                      Question en attente · Le service agronomique était indisponible lors de l’envoi.
                    </Text>
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>

        {/* Modale de saisie de question */}
        <Modal visible={modalVisible} animationType="slide" transparent>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Nouvelle Consultation</Text>
                  <TouchableOpacity onPress={() => !isAsking && setModalVisible(false)}>
                    <Feather name="x" size={24} color="#101e0f" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={styles.inputLabel}>Culture concernée</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipScroll}
                  >
                    {CROPS.map((crop) => (
                      <TouchableOpacity
                        key={crop}
                        style={[styles.chip, selectedCrop === crop && styles.chipActive]}
                        onPress={() => setSelectedCrop(crop)}
                        disabled={isAsking}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            selectedCrop === crop && styles.chipTextActive,
                          ]}
                        >
                          {crop}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.inputLabel}>Type de problème / Catégorie</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipScroll}
                  >
                    {CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.chip, selectedCategory === cat && styles.chipActive]}
                        onPress={() => setSelectedCategory(cat)}
                        disabled={isAsking}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            selectedCategory === cat && styles.chipTextActive,
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.inputLabel}>Description détaillée du symptôme</Text>
                  <TextInput
                    style={[styles.textInput, { height: 110 }]}
                    placeholder="Décrivez les taches, la couleur des feuilles, les ravageurs observés, l'étendue du champ..."
                    placeholderTextColor="#889e87"
                    multiline
                    maxLength={1000}
                    value={questionText}
                    onChangeText={setQuestionText}
                    editable={!isAsking}
                  />
                  <Text style={styles.charCountText}>{questionText.length} / 1000 caractères</Text>

                  {/* Information honnête sur les médias/photos (aucun faux upload) */}
                  <View style={styles.photoNoticeBox}>
                    <Feather name="camera-off" size={16} color="#6b7280" style={{ marginRight: 8 }} />
                    <Text style={styles.photoNoticeText}>
                      Transmission photo : temporairement indisponible. Veuillez détailler vos observations par écrit ci-dessus.
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.modalSubmitButton, isAsking && { opacity: 0.7 }]}
                    onPress={handleCreateQuestion}
                    disabled={isAsking}
                    activeOpacity={0.85}
                  >
                    {isAsking ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <ActivityIndicator color="#f3ecd8" style={{ marginRight: 8 }} />
                        <Text style={styles.modalSubmitText}>Dr. TCHA analyse...</Text>
                      </View>
                    ) : (
                      <Text style={styles.modalSubmitText}>Consulter l’Agronome IA</Text>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
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
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#1d331b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#f3ecd8' },
  headerSubtitle: { fontSize: 11, color: '#889e87' },
  addNavButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#d97834',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: { padding: Spacing.three, paddingBottom: 80 },
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
  actionButton: {
    flexDirection: 'row',
    backgroundColor: '#d97834',
    padding: Spacing.three,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.four,
  },
  actionButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#101e0f', marginBottom: Spacing.three },
  emptyHistoryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: Spacing.four,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0d8c3',
    marginVertical: 8,
  },
  emptyHistoryTitle: { fontSize: 14, fontWeight: '800', color: '#101e0f', marginBottom: 4 },
  emptyHistoryText: { fontSize: 12, color: '#5a6258', textAlign: 'center', lineHeight: 17 },
  questionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: '#e0d8c3',
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
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
  answerBox: {
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 12,
    marginTop: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#15803d',
  },
  answerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  answerTitle: { fontSize: 12, fontWeight: '800', color: '#15803d' },
  answerText: { fontSize: 13, color: '#101e0f', lineHeight: 18 },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fefce8',
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#fef08a',
  },
  disclaimerText: { fontSize: 10, color: '#854d0e', lineHeight: 14, flex: 1 },
  pendingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    padding: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  pendingHint: { fontSize: 11, color: '#b45309', fontWeight: '600', flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: '#101e0f70', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#f3ecd8',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: Spacing.four,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#101e0f' },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#101e0f', marginTop: 10, marginBottom: 6 },
  chipScroll: { flexDirection: 'row', marginBottom: 6 },
  chip: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0d8c3',
  },
  chipActive: { backgroundColor: '#d97834', borderColor: '#d97834' },
  chipText: { fontSize: 12, color: '#101e0f', fontWeight: '600' },
  chipTextActive: { color: '#ffffff', fontWeight: '800' },
  textInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e0d8c3',
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    color: '#101e0f',
    textAlignVertical: 'top',
  },
  charCountText: { fontSize: 10, color: '#889e87', alignSelf: 'flex-end', marginTop: 4 },
  photoNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 10,
    marginTop: 14,
  },
  photoNoticeText: { fontSize: 11, color: '#4b5563', flex: 1, lineHeight: 15 },
  modalSubmitButton: {
    backgroundColor: '#101e0f',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 24,
  },
  modalSubmitText: { color: '#f3ecd8', fontWeight: '800', fontSize: 15 },
});
