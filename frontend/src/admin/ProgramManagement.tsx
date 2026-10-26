import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AgriculturalProgram, apiClient, ProgramApplication } from '@/services/api';
import { useToast } from '@/components/ui/toast';

const EMPTY = { nom: '', description: '', criteresEligibilite: '', dateLimite: '', urlLien: '' };
const APPLICATION_LABEL: Record<ProgramApplication['statut'], string> = {
  ASSISTANCE_DEMANDEE: 'Assistance demandée', DOSSIER_EN_COURS: 'Dossier en cours', DOSSIER_DEPOSE: 'Dossier déposé', ACCEPTE: 'Accepté', REFUSE: 'Refusé',
};

export function ProgramManagement() {
  const { showToast } = useToast();
  const [programs, setPrograms] = useState<Array<AgriculturalProgram & { candidatureCount: number }>>([]);
  const [applications, setApplications] = useState<ProgramApplication[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changing, setChanging] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [programList, applicationList] = await Promise.all([apiClient.getAdminPrograms(), apiClient.getAdminProgramApplications()]);
      setPrograms(programList); setApplications(applicationList);
    } catch (error: any) {
      showToast({ message: error?.message || 'Impossible de charger les programmes.', type: 'error' });
    } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (!form.nom.trim() || !form.description.trim() || !form.criteresEligibilite.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(form.dateLimite)) {
      showToast({ message: 'Renseignez le nom, la description, les critères et une date limite YYYY-MM-DD.', type: 'warning' }); return;
    }
    setSaving(true);
    try {
      await apiClient.createAdminProgram({ ...form, statut: 'PUBLIE' });
      setForm(EMPTY); await load();
      showToast({ message: 'Programme publié.', type: 'success' });
    } catch (error: any) { showToast({ message: error?.message || 'Publication impossible.', type: 'error' }); }
    finally { setSaving(false); }
  };

  const setApplicationStatus = async (applicationId: string, statut: ProgramApplication['statut']) => {
    setChanging(applicationId);
    try { await apiClient.updateAdminProgramApplication(applicationId, statut); await load(); showToast({ message: 'Dossier mis à jour.', type: 'success' }); }
    catch (error: any) { showToast({ message: error?.message || 'Mise à jour impossible.', type: 'error' }); }
    finally { setChanging(null); }
  };

  return <View style={styles.wrap}>
    <View style={styles.header}><View><Text style={styles.eyebrow}>PROGRAMMES AGRICOLES</Text><Text style={styles.title}>Publier et accompagner les dossiers</Text><Text style={styles.text}>Les programmes démo sont identifiés. Remplacez-les par des opportunités vérifiées avant toute communication officielle.</Text></View><Pressable style={styles.refresh} onPress={() => void load()}><Feather name="refresh-cw" color="#173017" size={16} /><Text style={styles.refreshText}>Actualiser</Text></Pressable></View>
    <View style={styles.grid}>
      <View style={styles.card}><Text style={styles.cardTitle}>Publier un programme</Text><Field label="Nom" value={form.nom} onChangeText={(nom) => setForm({ ...form, nom })} placeholder="Ex. Appui intrants 2027" /><Field label="Description détaillée" multiline value={form.description} onChangeText={(description) => setForm({ ...form, description })} placeholder="Objectif, aide proposée, public concerné…" /><Field label="Critères d’éligibilité" multiline value={form.criteresEligibilite} onChangeText={(criteresEligibilite) => setForm({ ...form, criteresEligibilite })} placeholder="Conditions à remplir…" /><Field label="Date limite" value={form.dateLimite} onChangeText={(dateLimite) => setForm({ ...form, dateLimite })} placeholder="2027-01-31" /><Field label="Lien ou contact (facultatif)" value={form.urlLien} onChangeText={(urlLien) => setForm({ ...form, urlLien })} placeholder="https://…" /><Pressable disabled={saving} style={[styles.publish, saving && styles.disabled]} onPress={() => void create()}>{saving ? <ActivityIndicator color="#fff8e8" /> : <><Feather name="send" color="#fff8e8" size={16} /><Text style={styles.publishText}>Publier le programme</Text></>}</Pressable></View>
      <View style={styles.card}><Text style={styles.cardTitle}>Programmes disponibles</Text>{loading ? <ActivityIndicator color="#dc7627" /> : programs.length === 0 ? <Text style={styles.muted}>Aucun programme publié.</Text> : programs.map((program) => <View key={program.id} style={styles.program}><View style={styles.programTop}><Text style={styles.programName}>{program.nom}</Text>{program.estDemo ? <Text style={styles.demo}>DÉMO</Text> : null}</View><Text style={styles.programMeta}>Échéance : {program.dateLimite} · {program.candidatureCount} dossier(s)</Text><Text style={styles.programStatus}>{program.statut}</Text></View>)}</View>
    </View>
    <View style={styles.card}><Text style={styles.cardTitle}>Demandes d’assistance et suivi des dossiers</Text>{loading ? <ActivityIndicator color="#dc7627" /> : applications.length === 0 ? <Text style={styles.muted}>Aucun dossier à traiter.</Text> : applications.map((application) => <View key={application.id} style={styles.application}><View style={styles.applicationInfo}><Text style={styles.programName}>{application.agriculteur?.nom} · {application.programme.nom}</Text><Text style={styles.programMeta}>{application.agriculteur?.contact} · {application.agriculteur?.gicNom}</Text>{application.demandeAssistance ? <Text style={styles.request}>« {application.demandeAssistance} »</Text> : null}<Text style={styles.current}>{APPLICATION_LABEL[application.statut]}</Text></View><View style={styles.actions}><Pressable disabled={changing === application.id} style={styles.action} onPress={() => void setApplicationStatus(application.id, 'DOSSIER_EN_COURS')}><Text style={styles.actionText}>Prendre en charge</Text></Pressable><Pressable disabled={changing === application.id} style={[styles.action, styles.actionStrong]} onPress={() => void setApplicationStatus(application.id, 'DOSSIER_DEPOSE')}><Text style={styles.actionStrongText}>Dossier déposé</Text></Pressable></View></View>)}</View>
  </View>;
}

function Field({ label, value, onChangeText, placeholder, multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#7b8578" multiline={multiline} style={[styles.input, multiline && styles.textarea]} /></View>;
}

const styles = StyleSheet.create({
  wrap: { maxWidth: 1156, width: '100%', alignSelf: 'center', marginTop: 24, gap: 16 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }, eyebrow: { color: '#dc7627', fontWeight: '900', fontSize: 11, letterSpacing: 1 }, title: { color: '#173017', fontSize: 22, fontWeight: '900', marginTop: 4 }, text: { color: '#667363', fontSize: 13, lineHeight: 18, marginTop: 6, maxWidth: 680 }, refresh: { backgroundColor: '#dce6d5', paddingHorizontal: 12, minHeight: 40, borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 7 }, refreshText: { color: '#173017', fontWeight: '800', fontSize: 12 }, grid: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' }, card: { flex: 1, backgroundColor: '#fffaf0', borderWidth: 1, borderColor: '#e3dbc9', borderRadius: 14, padding: 18 }, cardTitle: { color: '#173017', fontSize: 17, fontWeight: '900', marginBottom: 5 }, field: { marginTop: 10 }, label: { color: '#30442f', fontWeight: '800', fontSize: 12, marginBottom: 5 }, input: { minHeight: 42, borderRadius: 8, borderWidth: 1, borderColor: '#d9dfd1', backgroundColor: '#fffef9', paddingHorizontal: 10, color: '#173017' }, textarea: { minHeight: 65, paddingTop: 8, textAlignVertical: 'top' }, publish: { minHeight: 45, borderRadius: 9, backgroundColor: '#dc7627', marginTop: 16, flexDirection: 'row', gap: 7, justifyContent: 'center', alignItems: 'center' }, publishText: { color: '#fff8e8', fontWeight: '900' }, disabled: { opacity: 0.6 }, muted: { color: '#74816f', fontSize: 13, marginTop: 10 }, program: { borderTopWidth: 1, borderColor: '#e8e0d0', paddingVertical: 11 }, programTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, programName: { color: '#173017', fontWeight: '900', fontSize: 14, flex: 1 }, demo: { color: '#9b5716', backgroundColor: '#fff0d7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, fontWeight: '900', fontSize: 10 }, programMeta: { color: '#687564', fontSize: 12, marginTop: 4 }, programStatus: { color: '#2e713f', fontWeight: '800', fontSize: 11, marginTop: 4 }, application: { borderTopWidth: 1, borderColor: '#e8e0d0', paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, applicationInfo: { flex: 1 }, request: { color: '#6b552f', fontSize: 12, fontStyle: 'italic', marginTop: 6 }, current: { color: '#a45011', fontSize: 12, fontWeight: '900', marginTop: 6 }, actions: { flexDirection: 'row', gap: 8, alignItems: 'center' }, action: { borderWidth: 1, borderColor: '#b17634', borderRadius: 8, paddingHorizontal: 10, minHeight: 36, justifyContent: 'center' }, actionText: { color: '#8a4d10', fontSize: 11, fontWeight: '800' }, actionStrong: { backgroundColor: '#28733e', borderColor: '#28733e' }, actionStrongText: { color: '#fff8e8', fontSize: 11, fontWeight: '900' },
});
