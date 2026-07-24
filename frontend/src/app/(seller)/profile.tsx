import { Dimensions, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';
import { dbService, GicMember, GicNeed, GicProfile } from '@/services/database';
import { BottomNavBar } from '@/components/ui/bottom-nav-bar';
import { useToast } from '@/components/ui/toast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

const NEED_CATEGORIES = ['Intrants', 'Terres', 'Matériel', 'Financement', 'Transformation'];

export default function SellerProfileScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<GicProfile | null>(null);
  const [members, setMembers] = useState<GicMember[]>([]);
  const [needs, setNeeds] = useState<GicNeed[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingNeedId, setEditingNeedId] = useState<string | null>(null);
  const [needCategory, setNeedCategory] = useState('Intrants');
  const [needDescription, setNeedDescription] = useState('');
  const [surfaceDraft, setSurfaceDraft] = useState('');

  const loadData = async () => {
    await dbService.initDatabase();
    const [p, m, n] = await Promise.all([
      dbService.getGicProfile(),
      dbService.getGicMembers(),
      dbService.getGicNeeds(),
    ]);
    setProfile(p);
    setMembers(m);
    setNeeds(n);
    setSurfaceDraft(String(p.surfaceHa || 12.5));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSurface = async () => {
    const value = parseFloat(surfaceDraft);
    if (Number.isNaN(value) || value <= 0) {
      showToast({ message: 'Veuillez saisir une surface valide.', type: 'warning' });
      return;
    }
    const updated = await dbService.updateGicProfile({ surfaceHa: value });
    setProfile(updated);
    showToast({ message: `Surface mise à jour : ${value} ha`, type: 'success' });
  };

  const handleOpenAddNeed = () => {
    setEditingNeedId(null);
    setNeedCategory('Intrants');
    setNeedDescription('');
    setModalVisible(true);
  };

  const handleEditNeed = (need: GicNeed) => {
    setEditingNeedId(need.id);
    setNeedCategory(need.category);
    setNeedDescription(need.description);
    setModalVisible(true);
  };

  const handleDeleteNeed = async (id: string) => {
    const updated = await dbService.deleteGicNeed(id);
    setNeeds(updated);
    showToast({ message: 'Besoin supprimé.', type: 'info' });
  };

  const handleSaveNeed = async () => {
    if (!needDescription.trim()) {
      showToast({ message: 'Veuillez décrire le besoin.', type: 'warning' });
      return;
    }
    if (editingNeedId) {
      const updated = await dbService.updateGicNeed(editingNeedId, needCategory, needDescription.trim());
      setNeeds(updated);
      showToast({ message: 'Besoin mis à jour !', type: 'success' });
    } else {
      await dbService.addGicNeed(needCategory, needDescription.trim());
      const fresh = await dbService.getGicNeeds();
      setNeeds(fresh);
      showToast({ message: 'Besoin recensé avec succès !', type: 'success' });
    }
    setNeedDescription('');
    setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.outer}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#101e0f" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Feather name="arrow-left" size={20} color="#f3ecd8" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profil Exploitation / GIC</Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {profile && (
            <View style={styles.card}>
              <View style={styles.profileHeaderRow}>
                <View style={styles.gicAvatar}>
                  <Feather name="shield" size={24} color="#d97834" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{profile.name}</Text>
                  <Text style={styles.meta}>REF MINADER · {profile.identifiantREF}</Text>
                </View>
              </View>

              <View style={styles.badgeGrid}>
                <View style={styles.profileBadgeItem}>
                  <Feather name="map-pin" size={12} color="#d97834" />
                  <Text style={styles.profileBadgeText}>{profile.bassin}</Text>
                </View>
                <View style={[styles.profileBadgeItem, { backgroundColor: '#f0fdf4' }]}>
                  <Feather name="check-circle" size={12} color="#15803d" />
                  <Text style={[styles.profileBadgeText, { color: '#15803d' }]}>{profile.statutLegalisation}</Text>
                </View>
              </View>

              <Text style={styles.metaLabel}>Leader Référent : <Text style={styles.metaValue}>{profile.leaderName}</Text></Text>
              <Text style={styles.metaLabel}>Filières Principales : <Text style={styles.metaValue}>{profile.activitesPrincipales}</Text></Text>
              <Text style={styles.reglement}>{profile.reglementInterieur}</Text>

              <View style={styles.surfaceRow}>
                <Text style={styles.label}>Surface exploitée (hectares)</Text>
                <View style={styles.surfaceInputGroup}>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={surfaceDraft}
                    onChangeText={setSurfaceDraft}
                    placeholderTextColor="#9ca49a"
                  />
                  <TouchableOpacity style={styles.smallBtn} onPress={handleSaveSurface} activeOpacity={0.8}>
                    <Text style={styles.smallBtnText}>Mettre à jour</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Membres du GIC ({members.length})</Text>
            <Feather name="users" size={16} color="#101e0f" />
          </View>
          <View style={styles.listCard}>
            {members.map((m) => (
              <View key={m.id} style={styles.listItem}>
                <View>
                  <Text style={styles.itemTitle}>{m.name}</Text>
                  <Text style={styles.itemSub}>{m.phone}</Text>
                </View>
                {m.isLeader ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Leader GIC</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Besoins Recensés ({needs.length})</Text>
            <TouchableOpacity onPress={handleOpenAddNeed}>
              <Feather name="plus-circle" size={20} color="#d97834" />
            </TouchableOpacity>
          </View>
          <View style={styles.listCard}>
            {needs.length === 0 ? (
              <View style={styles.listItem}>
                <Text style={styles.itemSub}>Aucun besoin recensé pour le moment.</Text>
              </View>
            ) : (
              needs.map((n) => (
                <View key={n.id} style={styles.listItem}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.itemTitle}>{n.category}</Text>
                    <Text style={styles.itemSub}>{n.description}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity onPress={() => handleEditNeed(n)}>
                      <Feather name="edit-2" size={16} color="#15803d" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteNeed(n.id)}>
                      <Feather name="trash-2" size={16} color="#d97834" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>

        <Modal visible={modalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingNeedId ? 'Modifier le besoin GIC' : 'Nouveau besoin GIC'}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Feather name="x" size={22} color="#101e0f" />
                </TouchableOpacity>
              </View>
              <Text style={styles.label}>Catégorie</Text>
              <View style={styles.pills}>
                {NEED_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setNeedCategory(cat)}
                    style={[styles.pill, needCategory === cat && styles.pillActive]}
                  >
                    <Text style={[styles.pillText, needCategory === cat && styles.pillTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Description du besoin</Text>
              <TextInput
                style={styles.modalInput}
                multiline
                numberOfLines={3}
                value={needDescription}
                onChangeText={setNeedDescription}
                placeholder="Décrivez clairement votre besoin (ex: 20 sacs engrais NPK)..."
                placeholderTextColor="#788876"
              />
              <TouchableOpacity style={styles.submitBtn} onPress={handleSaveNeed} activeOpacity={0.85}>
                <Text style={styles.submitText}>{editingNeedId ? 'Enregistrer les modifications' : 'Enregistrer le besoin'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <BottomNavBar role="seller" />
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
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#f3ecd8' },
  scroll: { padding: Spacing.four, gap: Spacing.three },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    padding: Spacing.four,
    gap: 8,
  },
  profileHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  gicAvatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#101e0f', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#101e0f' },
  meta: { fontSize: 11, color: '#889e87', fontWeight: '600' },
  badgeGrid: { flexDirection: 'row', gap: 8, marginVertical: 4 },
  profileBadgeItem: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff7ed', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  profileBadgeText: { fontSize: 11, fontWeight: '700', color: '#d97834' },
  metaLabel: { fontSize: 12, color: '#5a6258', fontWeight: '600' },
  metaValue: { color: '#101e0f', fontWeight: '800' },
  reglement: { marginTop: 4, fontSize: 11, color: '#5a6258', lineHeight: 17 },
  surfaceRow: { marginTop: 10, gap: 6 },
  label: { fontSize: 12, fontWeight: '700', color: '#101e0f' },
  surfaceInputGroup: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: '#f9f6ef',
    borderWidth: 1.5,
    borderColor: '#e6dfcc',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 46,
    color: '#101e0f',
    fontSize: 14,
    fontWeight: '600',
  },
  smallBtn: {
    backgroundColor: '#101e0f',
    paddingHorizontal: 16,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnText: { color: '#f3ecd8', fontWeight: '800', fontSize: 12 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#101e0f' },
  listCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3ecd8',
  },
  itemTitle: { fontSize: 14, fontWeight: '700', color: '#101e0f' },
  itemSub: { fontSize: 11, color: '#5a6258', marginTop: 2 },
  badge: { backgroundColor: '#d9783420', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#d97834' },
  modalOverlay: { flex: 1, backgroundColor: '#101e0f70', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: Spacing.four,
    gap: 12,
    borderTopWidth: 2,
    borderTopColor: '#d97834',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#101e0f' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    backgroundColor: '#f9f6ef',
    borderWidth: 1,
    borderColor: '#e6dfcc',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pillActive: { backgroundColor: '#d97834', borderColor: '#d97834' },
  pillText: { fontSize: 12, fontWeight: '600', color: '#5a6258' },
  pillTextActive: { color: '#ffffff', fontWeight: '800' },
  modalInput: {
    backgroundColor: '#f9f6ef',
    borderWidth: 1.5,
    borderColor: '#d97834',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#101e0f',
    fontSize: 14,
    fontWeight: '700',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: '#101e0f',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  submitText: { color: '#f3ecd8', fontWeight: '800' },
});
