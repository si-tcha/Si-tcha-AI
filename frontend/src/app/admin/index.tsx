import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/toast';
import { AdminBasin, AdminGicSummary, apiClient } from '@/services/api';
import { AdminGicForm, normalizeAdminPhone, validateAdminGicForm } from '@/admin/validation';

const EMPTY_FORM: AdminGicForm = {
  gicName: '', reference: '', bassinProductionId: '', activities: '', legalStatus: '', logoUrl: '', leaderName: '', leaderPhone: '', leaderPin: '', confirmPin: '',
};

function CountBadge({ value, tone }: { value: number; tone: 'pending' | 'approved' | 'rejected' }) {
  const badgeTone = tone === 'pending' ? styles.count_pending : tone === 'approved' ? styles.count_approved : styles.count_rejected;
  const textTone = tone === 'pending' ? styles.countText_pending : tone === 'approved' ? styles.countText_approved : styles.countText_rejected;
  return <View style={[styles.countBadge, badgeTone]}><Text style={[styles.countText, textTone]}>{value}</Text></View>;
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { user, authenticated, signOut } = useAuth();
  const { showToast } = useToast();
  const [bassins, setBassins] = useState<AdminBasin[]>([]);
  const [gics, setGics] = useState<AdminGicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [form, setForm] = useState<AdminGicForm>(EMPTY_FORM);
  const requestId = useRef(0);

  const load = useCallback(async (refresh = false) => {
    const id = ++requestId.current;
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const [bootstrap, gicList] = await Promise.all([apiClient.getAdminBootstrap(), apiClient.getAdminGics()]);
      if (id !== requestId.current) return;
      setBassins(bootstrap.bassins);
      setGics(gicList);
    } catch (error: any) {
      if (id !== requestId.current) return;
      showToast({ message: error?.message || 'Impossible de charger les données administratives.', type: 'error' });
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [showToast]);

  useEffect(() => {
    if (authenticated && user?.role === 'admin') void load();
    return () => { requestId.current += 1; };
  }, [authenticated, load, user?.role]);

  if (!authenticated || !user) return <Redirect href="/admin/login" />;
  if (user.role !== 'admin') return <AccessDenied onSignOut={() => void signOut()} />;
  if (Platform.OS !== 'web') return <Redirect href="/admin/login" />;

  const update = (key: keyof AdminGicForm, value: string) => setForm((previous) => ({ ...previous, [key]: value }));
  const createGic = async () => {
    const validationError = validateAdminGicForm(form);
    if (validationError) {
      showToast({ message: validationError, type: 'warning' });
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await apiClient.createAdminGic({
        gicData: {
          nom: form.gicName.trim(),
          identifiantREF: form.reference.trim(),
          bassinProductionId: form.bassinProductionId,
          activitesPrincipales: form.activities.trim(),
          statutLegalisation: form.legalStatus.trim(),
          ...(form.logoUrl.trim() ? { logoURL: form.logoUrl.trim() } : {}),
        },
        leaderData: {
          nom: form.leaderName.trim(),
          contact: normalizeAdminPhone(form.leaderPhone)!,
          pin: form.leaderPin,
        },
      });
      setForm(EMPTY_FORM);
      setShowPin(false);
      showToast({ message: `${result.gic.nom} et son leader ont été créés. Remettez le PIN au leader par un canal sûr.`, type: 'success' });
      await load(true);
    } catch (error: any) {
      showToast({ message: error?.message || 'Création du GIC impossible.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const totals = gics.reduce((acc, gic) => ({
    gics: acc.gics + 1,
    pending: acc.pending + gic.members.pending.length,
    approved: acc.approved + gic.members.approved.length,
  }), { gics: 0, pending: 0, approved: 0 });

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <View style={styles.brandRow}><View style={styles.brandIcon}><Feather name="shield" color="#fff8e8" size={22} /></View><View><Text style={styles.brand}>SI-TCHA AI</Text><Text style={styles.brandSub}>Administration terrain</Text></View></View>
          <View style={styles.agentRow}><View><Text style={styles.agentLabel}>AGENT CONNECTÉ</Text><Text style={styles.agentName}>{user.name}</Text></View><Pressable style={styles.logout} onPress={() => void signOut()}><Feather name="log-out" size={18} color="#fff8e8" /><Text style={styles.logoutText}>Quitter</Text></Pressable></View>
        </View>

        <View style={styles.heading}><View><Text style={styles.title}>Pilotage des GIC</Text><Text style={styles.subtitle}>Créez les nouveaux groupements et leur premier responsable, puis suivez les adhésions.</Text></View><Pressable style={[styles.refresh, refreshing && styles.refreshDisabled]} onPress={() => void load(true)} disabled={refreshing}>{refreshing ? <ActivityIndicator color="#173017" /> : <><Feather name="refresh-cw" size={17} color="#173017" /><Text style={styles.refreshText}>Actualiser</Text></>}</Pressable></View>

        <View style={styles.statRow}>
          <Stat icon="layers" label="GIC suivis" value={totals.gics} tone="green" />
          <Stat icon="clock" label="Demandes en attente" value={totals.pending} tone="orange" />
          <Stat icon="users" label="Membres approuvés" value={totals.approved} tone="blue" />
        </View>

        <View style={styles.warning}><Feather name="alert-circle" color="#a45011" size={20} /><Text style={styles.warningText}>Avant de créer un leader : vérifiez son identité, son numéro et son accord. Le PIN choisi ne sera jamais affiché à nouveau par le tableau de bord.</Text></View>

        <View style={styles.grid}>
          <View style={styles.formCard}>
            <Text style={styles.sectionEyebrow}>NOUVEAU GROUPEMENT</Text><Text style={styles.sectionTitle}>Créer un GIC et son premier leader</Text><Text style={styles.sectionText}>Le leader créé est immédiatement approuvé. Les futurs membres devront valider leur OTP puis attendre sa décision.</Text>
            <Field label="Nom du GIC" value={form.gicName} onChangeText={(value) => update('gicName', value)} placeholder="Ex. GIC Agro-Vallée Bafoussam" />
            <Field label="Référence GIC" value={form.reference} onChangeText={(value) => update('reference', value)} placeholder="Ex. GIC-OUEST-2026-001" autoCapitalize="characters" />
            <Text style={styles.fieldLabel}>Bassin de production</Text>
            <View style={styles.bassinList}>{bassins.length === 0 ? <Text style={styles.muted}>Aucun bassin disponible. Contactez le responsable technique.</Text> : bassins.map((bassin) => <Pressable key={bassin.id} onPress={() => update('bassinProductionId', bassin.id)} style={[styles.bassinChoice, form.bassinProductionId === bassin.id && styles.bassinChoiceActive]}><Text style={[styles.bassinName, form.bassinProductionId === bassin.id && styles.bassinNameActive]}>{bassin.nom}</Text><Text style={[styles.bassinRegion, form.bassinProductionId === bassin.id && styles.bassinRegionActive]}>{bassin.region}</Text></Pressable>)}</View>
            <Field label="Activités principales" value={form.activities} onChangeText={(value) => update('activities', value)} placeholder="Ex. Maraîchage, tubercules" multiline />
            <Field label="Statut de légalisation" value={form.legalStatus} onChangeText={(value) => update('legalStatus', value)} placeholder="Ex. Légalisé" />
            <Field label="URL du logo (facultative)" value={form.logoUrl} onChangeText={(value) => update('logoUrl', value)} placeholder="https://…" autoCapitalize="none" />
            <View style={styles.separator} />
            <Text style={styles.subsection}>Premier Leader GIC</Text>
            <Field label="Nom complet" value={form.leaderName} onChangeText={(value) => update('leaderName', value)} placeholder="Nom du responsable" />
            <Field label="Téléphone camerounais" value={form.leaderPhone} onChangeText={(value) => update('leaderPhone', value)} placeholder="695 715 021" keyboardType="phone-pad" />
            <Text style={styles.fieldLabel}>PIN initial (4 à 6 chiffres)</Text>
            <View style={styles.pinRow}><TextInput style={styles.pinInput} value={form.leaderPin} onChangeText={(value) => update('leaderPin', value.replace(/\D/g, ''))} placeholder="••••" placeholderTextColor="#798376" secureTextEntry={!showPin} keyboardType="number-pad" maxLength={6} /><Pressable style={styles.eye} onPress={() => setShowPin((value) => !value)}><Feather name={showPin ? 'eye-off' : 'eye'} color="#4c5c4c" size={19} /></Pressable></View>
            <Field label="Confirmer le PIN" value={form.confirmPin} onChangeText={(value) => update('confirmPin', value.replace(/\D/g, ''))} placeholder="••••" secureTextEntry={!showPin} keyboardType="number-pad" maxLength={6} />
            <Pressable style={[styles.createButton, submitting && styles.createDisabled]} onPress={() => void createGic()} disabled={submitting}>{submitting ? <ActivityIndicator color="#fff8e8" /> : <><Feather name="plus-circle" color="#fff8e8" size={19} /><Text style={styles.createText}>Créer le GIC et le leader</Text></>}</Pressable>
          </View>

          <View style={styles.listCard}>
            <View style={styles.listHeader}><View><Text style={styles.sectionEyebrow}>SUIVI</Text><Text style={styles.sectionTitle}>GIC enregistrés</Text></View><Text style={styles.total}>{gics.length}</Text></View>
            {loading ? <View style={styles.loading}><ActivityIndicator color="#dc7627" /><Text style={styles.muted}>Chargement des GIC…</Text></View> : gics.length === 0 ? <View style={styles.empty}><Feather name="inbox" size={28} color="#82907f" /><Text style={styles.muted}>Aucun GIC enregistré pour le moment.</Text></View> : gics.map((gic) => <GicCard key={gic.id} gic={gic} bassins={bassins} />)}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AccessDenied({ onSignOut }: { onSignOut: () => void }) {
  return <SafeAreaView style={styles.denied}><Feather name="shield-off" size={40} color="#dc7627" /><Text style={styles.deniedTitle}>Accès administrateur requis</Text><Text style={styles.deniedText}>Cette session ne possède pas le rôle agent entreprise.</Text><Pressable style={styles.logout} onPress={onSignOut}><Text style={styles.logoutText}>Se déconnecter</Text></Pressable></SafeAreaView>;
}

function Stat({ icon, label, value, tone }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; value: number; tone: 'green' | 'orange' | 'blue' }) {
  const iconTone = tone === 'orange' ? styles.statIcon_orange : tone === 'blue' ? styles.statIcon_blue : styles.statIcon_green;
  return <View style={styles.stat}><View style={[styles.statIcon, iconTone]}><Feather name={icon} size={18} color={tone === 'orange' ? '#b15313' : tone === 'blue' ? '#22688f' : '#247143'} /></View><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function Field(props: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean; autoCapitalize?: 'none' | 'characters' | 'sentences' | 'words'; secureTextEntry?: boolean; keyboardType?: 'default' | 'phone-pad' | 'number-pad'; maxLength?: number }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{props.label}</Text><TextInput style={[styles.input, props.multiline && styles.textarea]} value={props.value} onChangeText={props.onChangeText} placeholder={props.placeholder} placeholderTextColor="#798376" autoCapitalize={props.autoCapitalize} autoCorrect={false} multiline={props.multiline} secureTextEntry={props.secureTextEntry} keyboardType={props.keyboardType} maxLength={props.maxLength} /></View>;
}

function GicCard({ gic, bassins }: { gic: AdminGicSummary; bassins: AdminBasin[] }) {
  const bassin = bassins.find((item) => item.id === String(gic.bassinProductionId));
  const pendingNames = gic.members.pending.slice(0, 3).map((member) => member.nom).join(', ');
  return <View style={styles.gicCard}><View style={styles.gicTop}><View style={styles.gicIcon}><Feather name="home" color="#2e713f" size={18} /></View><View style={styles.gicIdentity}><Text style={styles.gicName}>{gic.nom}</Text><Text style={styles.gicRef}>{gic.identifiantREF}</Text></View></View><Text style={styles.gicInfo}>{bassin ? `${bassin.nom} · ${bassin.region}` : `Bassin #${gic.bassinProductionId}`}</Text><View style={styles.memberRow}><View style={styles.memberMetric}><CountBadge tone="pending" value={gic.members.pending.length} /><Text style={styles.memberLabel}>En attente</Text></View><View style={styles.memberMetric}><CountBadge tone="approved" value={gic.members.approved.length} /><Text style={styles.memberLabel}>Approuvés</Text></View><View style={styles.memberMetric}><CountBadge tone="rejected" value={gic.members.rejected.length} /><Text style={styles.memberLabel}>Refusés</Text></View></View>{pendingNames ? <Text style={styles.pendingNames}>À traiter par le leader : {pendingNames}{gic.members.pending.length > 3 ? '…' : ''}</Text> : null}</View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4eddd' }, scroll: { paddingBottom: 56 },
  topbar: { minHeight: 84, backgroundColor: '#10230f', paddingHorizontal: 32, paddingVertical: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 20 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, brandIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#dc7627', alignItems: 'center', justifyContent: 'center' }, brand: { color: '#fff8e8', fontWeight: '900', fontSize: 18 }, brandSub: { color: '#adc1ac', fontSize: 12, marginTop: 2 },
  agentRow: { flexDirection: 'row', alignItems: 'center', gap: 14 }, agentLabel: { color: '#9db09b', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textAlign: 'right' }, agentName: { color: '#fff8e8', fontSize: 14, fontWeight: '800', textAlign: 'right', marginTop: 2 }, logout: { backgroundColor: '#30482f', borderRadius: 9, paddingHorizontal: 12, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, logoutText: { color: '#fff8e8', fontWeight: '800', fontSize: 13 },
  heading: { maxWidth: 1220, width: '100%', alignSelf: 'center', paddingHorizontal: 32, paddingTop: 38, paddingBottom: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20 }, title: { fontSize: 32, fontWeight: '900', color: '#152814' }, subtitle: { marginTop: 7, maxWidth: 650, fontSize: 15, lineHeight: 22, color: '#667363' }, refresh: { backgroundColor: '#dce6d5', borderRadius: 10, paddingHorizontal: 13, minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8 }, refreshText: { color: '#173017', fontSize: 13, fontWeight: '800' }, refreshDisabled: { opacity: 0.65 },
  statRow: { maxWidth: 1220, width: '100%', alignSelf: 'center', paddingHorizontal: 32, flexDirection: 'row', gap: 14 }, stat: { flex: 1, minWidth: 150, backgroundColor: '#fffaf0', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e3dbc9' }, statIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }, statIcon_green: { backgroundColor: '#dcefdc' }, statIcon_orange: { backgroundColor: '#f9e2ca' }, statIcon_blue: { backgroundColor: '#d9edf7' }, statValue: { color: '#183118', fontSize: 24, fontWeight: '900' }, statLabel: { color: '#667363', fontSize: 12, marginTop: 3, fontWeight: '700' },
  warning: { maxWidth: 1156, alignSelf: 'center', marginHorizontal: 32, marginTop: 18, backgroundColor: '#fff0d7', borderLeftWidth: 4, borderLeftColor: '#dc7627', borderRadius: 8, padding: 13, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, warningText: { flex: 1, color: '#704115', fontSize: 13, lineHeight: 19, fontWeight: '600' },
  grid: { maxWidth: 1220, width: '100%', alignSelf: 'center', paddingHorizontal: 32, paddingTop: 24, flexDirection: 'row', alignItems: 'flex-start', gap: 20 }, formCard: { flex: 1.15, minWidth: 0, backgroundColor: '#fffaf0', borderRadius: 18, padding: 24, borderWidth: 1, borderColor: '#e3dbc9' }, listCard: { flex: 0.85, minWidth: 0, backgroundColor: '#fffaf0', borderRadius: 18, padding: 24, borderWidth: 1, borderColor: '#e3dbc9' }, sectionEyebrow: { color: '#dc7627', fontSize: 11, letterSpacing: 1, fontWeight: '900' }, sectionTitle: { color: '#173017', fontWeight: '900', fontSize: 21, marginTop: 5 }, sectionText: { color: '#687564', fontSize: 13, lineHeight: 19, marginTop: 7, marginBottom: 16 },
  field: { marginTop: 13 }, fieldLabel: { color: '#30442f', fontSize: 12, fontWeight: '800', marginBottom: 6 }, input: { minHeight: 44, borderRadius: 9, borderWidth: 1, borderColor: '#d9dfd1', backgroundColor: '#fffef9', paddingHorizontal: 12, fontSize: 14, color: '#173017' }, textarea: { minHeight: 76, paddingVertical: 10, textAlignVertical: 'top' }, bassinList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, bassinChoice: { borderWidth: 1, borderColor: '#d9dfd1', backgroundColor: '#fffef9', borderRadius: 9, paddingVertical: 9, paddingHorizontal: 11, minWidth: 108 }, bassinChoiceActive: { borderColor: '#2e713f', backgroundColor: '#e0f0df' }, bassinName: { color: '#30442f', fontSize: 13, fontWeight: '800' }, bassinNameActive: { color: '#1e602e' }, bassinRegion: { color: '#798376', fontSize: 11, marginTop: 2 }, bassinRegionActive: { color: '#3b7547' }, separator: { height: 1, backgroundColor: '#e3dbc9', marginVertical: 22 }, subsection: { color: '#173017', fontWeight: '900', fontSize: 16, marginBottom: 1 }, pinRow: { minHeight: 44, borderRadius: 9, borderWidth: 1, borderColor: '#d9dfd1', backgroundColor: '#fffef9', flexDirection: 'row', alignItems: 'center' }, pinInput: { flex: 1, height: 44, paddingHorizontal: 12, color: '#173017', fontSize: 14 }, eye: { padding: 12 }, createButton: { minHeight: 50, marginTop: 22, backgroundColor: '#dc7627', borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }, createDisabled: { opacity: 0.65 }, createText: { color: '#fff8e8', fontWeight: '900', fontSize: 14 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }, total: { color: '#173017', fontSize: 28, fontWeight: '900', minWidth: 34, textAlign: 'right' }, loading: { minHeight: 140, alignItems: 'center', justifyContent: 'center', gap: 12 }, empty: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 15 }, muted: { color: '#74816f', fontSize: 13, lineHeight: 19, textAlign: 'center' }, gicCard: { backgroundColor: '#fffef9', borderWidth: 1, borderColor: '#e1e5da', borderRadius: 12, padding: 14, marginTop: 10 }, gicTop: { flexDirection: 'row', gap: 10, alignItems: 'center' }, gicIcon: { width: 35, height: 35, borderRadius: 10, backgroundColor: '#e1f0df', alignItems: 'center', justifyContent: 'center' }, gicIdentity: { flex: 1 }, gicName: { color: '#173017', fontSize: 15, fontWeight: '900' }, gicRef: { color: '#788574', fontSize: 11, marginTop: 2 }, gicInfo: { color: '#4f5f4c', fontSize: 12, marginTop: 12 }, memberRow: { flexDirection: 'row', gap: 9, marginTop: 13 }, memberMetric: { flex: 1, alignItems: 'center', gap: 4 }, countBadge: { minWidth: 28, height: 25, paddingHorizontal: 6, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, count_pending: { backgroundColor: '#fff0d7' }, count_approved: { backgroundColor: '#e1f0df' }, count_rejected: { backgroundColor: '#f3e2e1' }, countText: { fontWeight: '900', fontSize: 12 }, countText_pending: { color: '#a45011' }, countText_approved: { color: '#2a743c' }, countText_rejected: { color: '#a13e39' }, memberLabel: { color: '#697667', fontSize: 10, textAlign: 'center' }, pendingNames: { color: '#956019', backgroundColor: '#fff7e7', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 6, fontSize: 11, lineHeight: 16, marginTop: 12 },
  denied: { flex: 1, backgroundColor: '#fff8e8', alignItems: 'center', justifyContent: 'center', padding: 28 }, deniedTitle: { color: '#173017', fontSize: 23, fontWeight: '900', marginTop: 15 }, deniedText: { color: '#667363', textAlign: 'center', marginVertical: 10 },
});
