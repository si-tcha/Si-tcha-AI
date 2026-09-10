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
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { ParcelGrowthRecord, ParcelStage } from '@/services/database.shared';
import { growthService, UserCacheContext } from '@/services/growthService';
import { calculateYieldDrop, isValidIsoDate } from '@/utils/growthUtils';
import { BottomNavBar } from '@/components/ui/bottom-nav-bar';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/context/AuthContext';

import { isValidSellerContext, ValidSellerContext } from '@/utils/cacheKey';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export const STAGES: ParcelStage[] = [
  'Semis',
  'Levée',
  'Floraison',
  'Maturation',
  'Prêt à récolter',
  'Récolté',
];

export default function GrowthLogScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user, loading: authLoading } = useAuth();

  // Contexte d'isolation strict — interdiction absolue de fallbacks anonymous ou gicId=0
  const sellerCtx = useMemo<ValidSellerContext | null>(() => {
    if (user?.role === 'seller' && user.id && user.gicId) {
      const candidate = {
        role: 'seller' as const,
        userId: String(user.id).trim(),
        gicId: String(user.gicId).trim(),
      };
      if (isValidSellerContext(candidate)) {
        return candidate;
      }
    }
    return null;
  }, [user]);

  const [parcels, setParcels] = useState<ParcelGrowthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Modale d'ajout
  const [modalVisible, setModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Formulaire d'ajout
  const [parcelName, setParcelName] = useState('');
  const [crop, setCrop] = useState('Tomates');
  const [sowingDate, setSowingDate] = useState('');
  const [stage, setStage] = useState<ParcelStage>('Semis');
  const [estimatedHarvestDate, setEstimatedHarvestDate] = useState('');
  const [estimatedVolumeKg, setEstimatedVolumeKg] = useState('2500');
  const [actualHarvestVolumeKg, setActualHarvestVolumeKg] = useState('');
  const [actualHarvestDate, setActualHarvestDate] = useState('');

  // Modale / Édition de parcelle existante
  const [editingParcel, setEditingParcel] = useState<ParcelGrowthRecord | null>(null);
  const [editStage, setEditStage] = useState<ParcelStage>('Semis');
  const [editActualVolume, setEditActualVolume] = useState('');
  const [editActualDate, setEditActualDate] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const loadParcels = useCallback(async () => {
    // Pendant l'hydratation de l'authentification : ne pas appeler l'API ni lire/écrire de cache
    if (authLoading) {
      setLoading(true);
      return;
    }

    // Si contexte invalide ou non disponible : vider les données privées et afficher l'erreur
    if (!sellerCtx) {
      setParcels([]);
      setLoading(false);
      setLoadError('Authentification vendeur requise pour afficher le journal de croissance.');
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const res = await growthService.loadParcels(sellerCtx);
      setParcels(res.parcels);
      setIsOfflineMode(res.isOffline);
      if (res.error) {
        setLoadError(res.error);
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Impossible de charger les parcelles.');
    } finally {
      setLoading(false);
    }
  }, [authLoading, sellerCtx]);

  useEffect(() => {
    loadParcels();
  }, [loadParcels]);

  const handleAddParcel = async () => {
    // 1. Validations côté client
    if (!parcelName.trim()) {
      showToast({ message: 'Veuillez saisir le nom de la parcelle.', type: 'warning' });
      return;
    }
    if (!crop.trim()) {
      showToast({ message: 'Veuillez renseigner la culture.', type: 'warning' });
      return;
    }
    if (!isValidIsoDate(sowingDate)) {
      showToast({
        message: 'Date de semis invalide (format attendu : AAAA-MM-JJ, ex: 2026-05-10).',
        type: 'warning',
      });
      return;
    }
    if (!isValidIsoDate(estimatedHarvestDate)) {
      showToast({
        message: 'Date de récolte estimée invalide (format attendu : AAAA-MM-JJ, ex: 2026-08-15).',
        type: 'warning',
      });
      return;
    }
    if (estimatedHarvestDate < sowingDate) {
      showToast({
        message: 'La date de récolte estimée ne peut pas être antérieure à la date de semis.',
        type: 'warning',
      });
      return;
    }
    if (actualHarvestDate && !isValidIsoDate(actualHarvestDate)) {
      showToast({
        message: 'Date de récolte réelle invalide (format attendu : AAAA-MM-JJ).',
        type: 'warning',
      });
      return;
    }
    if (actualHarvestDate && actualHarvestDate < sowingDate) {
      showToast({
        message: 'La date de récolte réelle ne peut pas être antérieure à la date de semis.',
        type: 'warning',
      });
      return;
    }

    const estVol = parseFloat(estimatedVolumeKg);
    if (isNaN(estVol) || estVol <= 0) {
      showToast({
        message: 'Le volume de récolte estimé doit être un nombre strictement supérieur à 0.',
        type: 'warning',
      });
      return;
    }

    let actVol: number | null = null;
    if (actualHarvestVolumeKg.trim()) {
      actVol = parseFloat(actualHarvestVolumeKg);
      if (isNaN(actVol) || actVol < 0) {
        showToast({
          message: 'Le volume réel récolté doit être un nombre supérieur ou égal à 0.',
          type: 'warning',
        });
        return;
      }
    }

    // 2. Envoi au serveur (confirmation requise)
    if (!sellerCtx) {
      showToast({ message: 'Session vendeur requise pour enregistrer une parcelle.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await growthService.createParcel(sellerCtx, {
        parcelName: parcelName.trim(),
        crop: crop.trim(),
        sowingDate: sowingDate.trim(),
        stage,
        estimatedHarvestDate: estimatedHarvestDate.trim(),
        estimatedVolumeKg: estVol,
        actualHarvestVolumeKg: actVol,
        actualHarvestDate: actualHarvestDate.trim() || null,
      });

      // Succès confirmé : mise à jour de l'affichage et fermeture du formulaire
      setParcels((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
      setParcelName('');
      setCrop('Tomates');
      setSowingDate('');
      setStage('Semis');
      setEstimatedHarvestDate('');
      setEstimatedVolumeKg('2500');
      setActualHarvestVolumeKg('');
      setActualHarvestDate('');
      setModalVisible(false);

      showToast({
        message: 'Parcelle enregistrée avec succès sur le serveur !',
        type: 'success',
      });
    } catch (err: any) {
      // Échec : NE PAS afficher de faux succès, conserver la saisie dans le modal
      const errorMsg =
        err?.message ||
        'Échec de synchronisation avec le serveur. Vos saisies ont été conservées.';
      showToast({
        message: errorMsg,
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (parcel: ParcelGrowthRecord) => {
    setEditingParcel(parcel);
    setEditStage(parcel.stage);
    setEditActualVolume(
      parcel.actualHarvestVolumeKg !== undefined && parcel.actualHarvestVolumeKg !== null
        ? String(parcel.actualHarvestVolumeKg)
        : ''
    );
    setEditActualDate(parcel.actualHarvestDate || '');
  };

  const handleUpdateParcel = async () => {
    if (!editingParcel) return;

    let actVol: number | null = null;
    if (editActualVolume.trim()) {
      actVol = parseFloat(editActualVolume);
      if (isNaN(actVol) || actVol < 0) {
        showToast({
          message: 'Le volume réel récolté doit être supérieur ou égal à 0 kg.',
          type: 'warning',
        });
        return;
      }
    }

    if (editActualDate.trim()) {
      if (!isValidIsoDate(editActualDate.trim())) {
        showToast({
          message: 'Date de récolte réelle invalide (format attendu : AAAA-MM-JJ).',
          type: 'warning',
        });
        return;
      }
      if (editActualDate.trim() < editingParcel.sowingDate) {
        showToast({
          message: 'La date de récolte réelle ne peut pas être antérieure à la date de semis.',
          type: 'warning',
        });
        return;
      }
    }

    if (!sellerCtx) {
      showToast({ message: 'Session vendeur requise pour mettre à jour une parcelle.', type: 'error' });
      return;
    }

    setIsUpdating(true);
    try {
      const updated = await growthService.updateParcel(
        sellerCtx,
        editingParcel.id,
        {
          stage: editStage,
          actualHarvestVolumeKg: actVol,
          actualHarvestDate: editActualDate.trim() || null,
        },
        editingParcel.sowingDate
      );

      setParcels((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditingParcel(null);
      showToast({ message: 'Parcelle mise à jour avec succès !', type: 'success' });
    } catch (err: any) {
      // En cas d'échec : conserver la saisie dans le formulaire d'édition
      showToast({
        message: err?.message || 'Échec de la mise à jour sur le serveur. Saisie conservée.',
        type: 'error',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Parcelles en alerte : STRICTEMENT > 15 %
  const alertParcels = parcels.filter((p) => {
    const { isDropAlert } = calculateYieldDrop(p.estimatedVolumeKg, p.actualHarvestVolumeKg);
    return isDropAlert;
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
          <TouchableOpacity
            style={styles.addNavButton}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Bandeau Mode Hors-Ligne si applicable */}
        {isOfflineMode && (
          <View style={styles.offlineBanner}>
            <Feather name="wifi-off" size={14} color="#b45309" style={{ marginRight: 6 }} />
            <Text style={styles.offlineBannerText}>
              Mode hors-ligne : données du journal chargées depuis le cache local.
            </Text>
          </View>
        )}

        {/* État de chargement initial */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#d97834" />
            <Text style={styles.loadingText}>Chargement des parcelles...</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Bannière d'erreur globale avec bouton Réessayer */}
            {loadError && (
              <View style={styles.errorCard}>
                <Feather name="alert-circle" size={20} color="#b91c1c" style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.errorTitle}>Erreur de connexion</Text>
                  <Text style={styles.errorSubtitle}>{loadError}</Text>
                </View>
                <TouchableOpacity style={styles.retryButton} onPress={loadParcels}>
                  <Text style={styles.retryButtonText}>Réessayer</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Bannières d'alerte baisse > 15% (strict) */}
            {alertParcels.map((a) => {
              const { dropPercent } = calculateYieldDrop(
                a.estimatedVolumeKg,
                a.actualHarvestVolumeKg
              );
              return (
                <View key={`alert-${a.id}`} style={styles.alertBanner}>
                  <View style={styles.alertHeader}>
                    <Feather name="alert-triangle" size={18} color="#b91c1c" style={{ marginRight: 6 }} />
                    <Text style={styles.alertTitle}>BAISSE DE RENDEMENT DÉTECTÉE (&gt; 15%)</Text>
                  </View>
                  <Text style={styles.alertBody}>
                    Sur <Text style={{ fontWeight: '800' }}>{a.parcelName}</Text> ({a.crop}) : Est. initiale {a.estimatedVolumeKg} kg ➔ Récolté réel : {a.actualHarvestVolumeKg} kg (
                    <Text style={{ fontWeight: '800', color: '#b91c1c' }}>Perte -{dropPercent}%</Text>
                    ).
                  </Text>
                  <TouchableOpacity
                    style={styles.alertAction}
                    onPress={() => router.push('/(seller)/agronomist')}
                    activeOpacity={0.85}
                  >
                    <Feather name="shield" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.alertActionText}>Consulter l’Agronome IA</Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Bouton d'action rapide */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.85}
            >
              <Feather name="plus-circle" size={18} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.actionButtonText}>+ Suivre une nouvelle parcelle</Text>
            </TouchableOpacity>

            {/* Titre section */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Parcelles sous suivi ({parcels.length})</Text>
              <TouchableOpacity onPress={loadParcels} style={styles.refreshButton}>
                <Feather name="refresh-cw" size={14} color="#101e0f" />
                <Text style={styles.refreshText}>Actualiser</Text>
              </TouchableOpacity>
            </View>

            {/* État vide */}
            {parcels.length === 0 && (
              <View style={styles.emptyCard}>
                <Feather name="inbox" size={36} color="#889e87" style={{ marginBottom: 10 }} />
                <Text style={styles.emptyTitle}>Aucune parcelle sous suivi</Text>
                <Text style={styles.emptySubtitle}>
                  Enregistrez votre premier champ pour suivre les étapes de croissance et anticiper les rendements.
                </Text>
                <TouchableOpacity
                  style={[styles.actionButton, { marginTop: 16, marginBottom: 0 }]}
                  onPress={() => setModalVisible(true)}
                >
                  <Text style={styles.actionButtonText}>+ Ajouter une parcelle</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Liste des parcelles */}
            {parcels.map((p) => {
              const { dropPercent, isDropAlert } = calculateYieldDrop(
                p.estimatedVolumeKg,
                p.actualHarvestVolumeKg
              );
              const hasHarvest =
                p.actualHarvestVolumeKg !== null && p.actualHarvestVolumeKg !== undefined;

              return (
                <View
                  key={p.id}
                  style={[styles.parcelCard, isDropAlert ? styles.parcelCardAlert : undefined]}
                >
                  <View style={styles.parcelHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.parcelName}>{p.parcelName}</Text>
                      <Text style={styles.parcelCropSub}>{p.crop}</Text>
                    </View>
                    <View style={styles.stageBadge}>
                      <Text style={styles.stageBadgeText}>{p.stage}</Text>
                    </View>
                  </View>

                  <View style={styles.parcelDetailsRow}>
                    <View style={styles.detailCol}>
                      <Text style={styles.detailLabel}>Date Semis</Text>
                      <Text style={styles.detailVal}>{p.sowingDate}</Text>
                    </View>
                    <View style={styles.detailCol}>
                      <Text style={styles.detailLabel}>Récolte Est.</Text>
                      <Text style={styles.detailVal}>{p.estimatedHarvestDate}</Text>
                    </View>
                    <View style={styles.detailCol}>
                      <Text style={styles.detailLabel}>Date Réelle</Text>
                      <Text style={styles.detailVal}>{p.actualHarvestDate || '—'}</Text>
                    </View>
                  </View>

                  <View style={styles.volumeRow}>
                    <Text style={styles.volumeLabel}>Estimation Volume :</Text>
                    <Text style={styles.volumeVal}>{p.estimatedVolumeKg} kg</Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.volumeRow, { marginTop: 8 }]}
                    onPress={() => openEditModal(p)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.volumeLabel}>Récolte Réelle Finale :</Text>
                    {hasHarvest ? (
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text
                          style={[
                            styles.volumeVal,
                            isDropAlert ? { color: '#b91c1c' } : { color: '#15803d' },
                          ]}
                        >
                          {p.actualHarvestVolumeKg} kg{' '}
                          {isDropAlert ? `(Baisse -${dropPercent}%)` : '✓ Conforme'}
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.volumeVal, { color: '#889e87' }]}>
                        Non renseignée · Modifier
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.editCardAction}
                    onPress={() => openEditModal(p)}
                    activeOpacity={0.8}
                  >
                    <Feather name="edit-3" size={13} color="#d97834" style={{ marginRight: 6 }} />
                    <Text style={styles.editCardActionText}>Modifier étape &amp; récolte</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Modale d'ajout de parcelle */}
        <Modal visible={modalVisible} animationType="slide" transparent>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Nouvelle Parcelle</Text>
                  <TouchableOpacity onPress={() => !isSubmitting && setModalVisible(false)}>
                    <Feather name="x" size={24} color="#101e0f" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={styles.inputLabel}>Nom de la parcelle / Champ *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="ex: Parcelle Ouest Bafoussam (3 ha)"
                    placeholderTextColor="#889e87"
                    value={parcelName}
                    onChangeText={setParcelName}
                    editable={!isSubmitting}
                  />

                  <Text style={styles.inputLabel}>Culture *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="ex: Tomates, Maïs, Manioc..."
                    placeholderTextColor="#889e87"
                    value={crop}
                    onChangeText={setCrop}
                    editable={!isSubmitting}
                  />

                  <Text style={styles.inputLabel}>Date de Semis (AAAA-MM-JJ) *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="ex: 2026-05-10"
                    placeholderTextColor="#889e87"
                    value={sowingDate}
                    onChangeText={setSowingDate}
                    editable={!isSubmitting}
                  />

                  <Text style={styles.inputLabel}>Date de Récolte Estimée (AAAA-MM-JJ) *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="ex: 2026-08-15"
                    placeholderTextColor="#889e87"
                    value={estimatedHarvestDate}
                    onChangeText={setEstimatedHarvestDate}
                    editable={!isSubmitting}
                  />

                  <Text style={styles.inputLabel}>Stade de croissance initial</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ flexDirection: 'row', marginBottom: 8 }}
                  >
                    {STAGES.map((stg) => (
                      <TouchableOpacity
                        key={stg}
                        style={[styles.chip, stage === stg && styles.chipActive]}
                        onPress={() => setStage(stg)}
                        disabled={isSubmitting}
                      >
                        <Text style={[styles.chipText, stage === stg && styles.chipTextActive]}>
                          {stg}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.inputLabel}>Volume de récolte estimé (kg) *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="ex: 3000"
                    placeholderTextColor="#889e87"
                    keyboardType="numeric"
                    value={estimatedVolumeKg}
                    onChangeText={setEstimatedVolumeKg}
                    editable={!isSubmitting}
                  />

                  <Text style={styles.inputLabel}>
                    Volume réellement récolté (kg) [Optionnel]
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="ex: 2500 (laisser vide si pas encore récolté)"
                    placeholderTextColor="#889e87"
                    keyboardType="numeric"
                    value={actualHarvestVolumeKg}
                    onChangeText={setActualHarvestVolumeKg}
                    editable={!isSubmitting}
                  />

                  <Text style={styles.inputLabel}>
                    Date de récolte réelle (AAAA-MM-JJ) [Optionnel]
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="ex: 2026-08-18"
                    placeholderTextColor="#889e87"
                    value={actualHarvestDate}
                    onChangeText={setActualHarvestDate}
                    editable={!isSubmitting}
                  />

                  <TouchableOpacity
                    style={[styles.modalSubmitButton, isSubmitting && { opacity: 0.7 }]}
                    onPress={handleAddParcel}
                    disabled={isSubmitting}
                    activeOpacity={0.85}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.modalSubmitText}>Enregistrer la Parcelle</Text>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Modale de mise à jour (étape et récolte) */}
        <Modal visible={!!editingParcel} animationType="slide" transparent>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Mise à jour de la Parcelle</Text>
                  <TouchableOpacity onPress={() => !isUpdating && setEditingParcel(null)}>
                    <Feather name="x" size={24} color="#101e0f" />
                  </TouchableOpacity>
                </View>

                {editingParcel && (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#101e0f', marginBottom: 12 }}>
                      {editingParcel.parcelName} ({editingParcel.crop})
                    </Text>

                    <Text style={styles.inputLabel}>Stade de croissance actuel</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ flexDirection: 'row', marginBottom: 12 }}
                    >
                      {STAGES.map((stg) => (
                        <TouchableOpacity
                          key={stg}
                          style={[styles.chip, editStage === stg && styles.chipActive]}
                          onPress={() => setEditStage(stg)}
                          disabled={isUpdating}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              editStage === stg && styles.chipTextActive,
                            ]}
                          >
                            {stg}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <Text style={styles.inputLabel}>Volume réellement récolté (kg)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="ex: 2400"
                      placeholderTextColor="#889e87"
                      keyboardType="numeric"
                      value={editActualVolume}
                      onChangeText={setEditActualVolume}
                      editable={!isUpdating}
                    />

                    <Text style={styles.inputLabel}>Date de récolte réelle (AAAA-MM-JJ)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="ex: 2026-08-20"
                      placeholderTextColor="#889e87"
                      value={editActualDate}
                      onChangeText={setEditActualDate}
                      editable={!isUpdating}
                    />

                    <TouchableOpacity
                      style={[styles.modalSubmitButton, isUpdating && { opacity: 0.7 }]}
                      onPress={handleUpdateParcel}
                      disabled={isUpdating}
                      activeOpacity={0.85}
                    >
                      {isUpdating ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text style={styles.modalSubmitText}>Enregistrer la mise à jour</Text>
                      )}
                    </TouchableOpacity>
                  </ScrollView>
                )}
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
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingVertical: 8,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
  },
  offlineBannerText: { fontSize: 11, color: '#92400e', fontWeight: '700', flex: 1 },
  scrollContent: { padding: Spacing.three, paddingBottom: 80 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { fontSize: 13, color: '#101e0f', fontWeight: '600', marginTop: 12 },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 14,
    padding: 12,
    marginBottom: Spacing.three,
  },
  errorTitle: { fontSize: 12, fontWeight: '800', color: '#b91c1c' },
  errorSubtitle: { fontSize: 11, color: '#7f1d1d', marginTop: 2 },
  retryButton: {
    backgroundColor: '#b91c1c',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginLeft: 8,
  },
  retryButtonText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  alertBanner: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 16,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  alertHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  alertTitle: { fontSize: 12, fontWeight: '800', color: '#b91c1c' },
  alertBody: { fontSize: 12, color: '#7f1d1d', lineHeight: 18, marginBottom: 10 },
  alertAction: {
    flexDirection: 'row',
    backgroundColor: '#b91c1c',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignSelf: 'flex-start',
    alignItems: 'center',
  },
  alertActionText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#101e0f' },
  refreshButton: { flexDirection: 'row', alignItems: 'center', padding: 4 },
  refreshText: { fontSize: 11, color: '#101e0f', fontWeight: '600', marginLeft: 4 },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: Spacing.four,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0d8c3',
    marginVertical: 10,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#101e0f', marginBottom: 6 },
  emptySubtitle: {
    fontSize: 12,
    color: '#5a6258',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  parcelCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: '#e0d8c3',
  },
  parcelCardAlert: { borderColor: '#fca5a5', backgroundColor: '#fffafa' },
  parcelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  parcelName: { fontSize: 15, fontWeight: '800', color: '#101e0f' },
  parcelCropSub: { fontSize: 11, color: '#889e87', fontWeight: '600', marginTop: 1 },
  stageBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stageBadgeText: { fontSize: 11, fontWeight: '800', color: '#15803d' },
  parcelDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f9f6ef',
    padding: 10,
    borderRadius: 12,
    marginBottom: 10,
  },
  detailCol: { alignItems: 'center' },
  detailLabel: { fontSize: 10, color: '#889e87', fontWeight: '600' },
  detailVal: { fontSize: 11, fontWeight: '800', color: '#101e0f', marginTop: 2 },
  volumeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  volumeLabel: { fontSize: 13, color: '#101e0f', fontWeight: '600' },
  volumeVal: { fontSize: 13, fontWeight: '800', color: '#d97834' },
  editCardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1ede0',
  },
  editCardActionText: { fontSize: 11, fontWeight: '700', color: '#d97834' },
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
  chip: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0d8c3',
  },
  chipActive: { backgroundColor: '#101e0f', borderColor: '#101e0f' },
  chipText: { fontSize: 12, color: '#101e0f', fontWeight: '600' },
  chipTextActive: { color: '#f3ecd8', fontWeight: '800' },
  textInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e0d8c3',
    borderRadius: 14,
    padding: 10,
    fontSize: 13,
    color: '#101e0f',
  },
  modalSubmitButton: {
    backgroundColor: '#d97834',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  modalSubmitText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
});
