import { Dimensions, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';
import { dbService, GicMember, GicNeed, GicProfile } from '@/services/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

const NEED_CATEGORIES = ['Intrants', 'Terres', 'Matériel', 'Financement', 'Transformation'];

export default function SellerProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<GicProfile | null>(null);
  const [members, setMembers] = useState<GicMember[]>([]);
  const [needs, setNeeds] = useState<GicNeed[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [needCategory, setNeedCategory] = useState('Intrants');
  const [needDescription, setNeedDescription] = useState('');
  const [surfaceDraft, setSurfaceDraft] = useState('');

  useEffect(() => {
    const load = async () => {
      await dbService.initDatabase();
      const [p, m, n] = await Promise.all([
        dbService.getGicProfile(),
        dbService.getGicMembers(),
        dbService.getGicNeeds(),
      ]);
      setProfile(p);
      setMembers(m);
      setNeeds(n);
      setSurfaceDraft(String(p.surfaceHa));
    };
    load();
  }, []);

  const handleSaveSurface = async () => {
    const value = parseFloat(surfaceDraft);
    if (Number.isNaN(value) || value <= 0) {
      alert('Surface invalide.');
      return;
    }
    const updated = await dbService.updateGicProfile({ surfaceHa: value });
    setProfile(updated);
    alert('Surface mise à jour.');
  };

  const handleAddNeed = async () => {
    if (!needDescription.trim()) {
      alert('Décrivez le besoin.');
      return;
    }
    const need = await dbService.addGicNeed(needCategory, needDescription.trim());
    setNeeds((prev) => [need, ...prev]);
    setNeedDescription('');
    setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.outer}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f3ecd8" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Feather name="arrow-left" size={22} color="#101e0f" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profil GIC</Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {profile && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{profile.name}</Text>
              <Text style={styles.meta}>REF · {profile.identifiantREF}</Text>
              <Text style={styles.meta}>Bassin · {profile.bassin}</Text>
              <Text style={styles.meta}>Statut · {profile.statutLegalisation}</Text>
              <Text style={styles.meta}>Leader · {profile.leaderName}</Text>
              <Text style={styles.meta}>Activités · {profile.activitesPrincipales}</Text>
              <Text style={styles.reglement}>{profile.reglementInterieur}</Text>

              <View style={styles.surfaceRow}>
                <Text style={styles.label}>Surface (ha)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={surfaceDraft}
                  onChangeText={setSurfaceDraft}
                  placeholderTextColor="#9ca49a"
                />
                <TouchableOpacity style={styles.smallBtn} onPress={handleSaveSurface}>
                  <Text style={styles.smallBtnText}>Sauver</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Membres</Text>
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
                    <Text style={styles.badgeText}>Leader</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Besoins recensés</Text>
            <TouchableOpacity onPress={() => setModalVisible(true)}>
              <Feather name="plus-circle" size={20} color="#d97834" />
            </TouchableOpacity>
          </View>
          <View style={styles.listCard}>
            {needs.length === 0 ? (
              <View style={styles.listItem}>
                <Text style={styles.itemSub}>Aucun besoin enregistré.</Text>
              </View>
            ) : (
              needs.map((n) => (
                <View key={n.id} style={styles.listItem}>
                  <View>
                    <Text style={styles.itemTitle}>{n.category}</Text>
                    <Text style={styles.itemSub}>{n.description}</Text>
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
                <Text style={styles.modalTitle}>Nouveau besoin</Text>
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
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                multiline
                value={needDescription}
                onChangeText={setNeedDescription}
                placeholder="Ex: 20 sacs NPK manquants"
                placeholderTextColor="#9ca49a"
              />
              <TouchableOpacity style={styles.submitBtn} onPress={handleAddNeed}>
                <Text style={styles.submitText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: isWeb ? '#e6dfcc' : '#f3ecd8', alignItems: 'center' },
  container: { width: CONTAINER_WIDTH, height: '100%', backgroundColor: '#f3ecd8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#e6dfcc',
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#101e0f' },
  scroll: { padding: Spacing.four, gap: Spacing.three },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    padding: Spacing.four,
    gap: 6,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#101e0f' },
  meta: { fontSize: 12, color: '#5a6258', fontWeight: '600' },
  reglement: { marginTop: 8, fontSize: 12, color: '#101e0f', lineHeight: 18 },
  surfaceRow: { marginTop: 12, gap: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#101e0f' },
  input: {
    backgroundColor: '#f9f6ef',
    borderWidth: 1,
    borderColor: '#e6dfcc',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    color: '#101e0f',
  },
  smallBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#101e0f',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  smallBtnText: { color: '#f3ecd8', fontWeight: '700', fontSize: 12 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#101e0f' },
  listCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
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
  badge: { backgroundColor: '#889e8730', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#101e0f' },
  modalOverlay: { flex: 1, backgroundColor: '#101e0f60', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#f3ecd8',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.four,
    gap: 10,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#101e0f' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6dfcc',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pillActive: { backgroundColor: '#d97834', borderColor: '#d97834' },
  pillText: { fontSize: 12, fontWeight: '600', color: '#5a6258' },
  pillTextActive: { color: '#f3ecd8' },
  submitBtn: {
    backgroundColor: '#101e0f',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  submitText: { color: '#f3ecd8', fontWeight: '700' },
});
