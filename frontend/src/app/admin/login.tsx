import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/toast';

export default function AdminLoginScreen() {
  const router = useRouter();
  const { user, authenticated, signInAdmin } = useAuth();
  const { showToast } = useToast();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (authenticated && user?.role === 'admin') return <Redirect href="/admin" />;

  if (Platform.OS !== 'web') {
    return (
      <SafeAreaView style={styles.nativeOnly}>
        <Feather name="monitor" size={42} color="#dc7627" />
        <Text style={styles.nativeTitle}>Espace agent disponible sur le web</Text>
        <Text style={styles.nativeText}>Le tableau de bord administratif doit être ouvert dans un navigateur sécurisé de l’entreprise, pas dans l’application mobile des producteurs.</Text>
        <Pressable style={styles.backButton} onPress={() => router.replace('/(auth)/welcome')}>
          <Text style={styles.backButtonText}>Retour à l’application</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const submit = async () => {
    if (!account.trim() || !password) {
      showToast({ message: 'Saisissez votre identifiant et votre mot de passe agent.', type: 'warning' });
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const session = await signInAdmin(account.trim(), password);
      if (session.obsolete) return;
      router.replace('/admin');
    } catch (error: any) {
      setPassword('');
      showToast({ message: error?.message || 'Connexion administrateur impossible.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.shell}>
        <View style={styles.brandRow}>
          <View style={styles.brandIcon}><Feather name="shield" size={24} color="#fff8e8" /></View>
          <View><Text style={styles.brand}>SI-TCHA AI</Text><Text style={styles.brandSub}>Portail agent entreprise</Text></View>
        </View>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>ACCÈS RÉSERVÉ</Text>
          <Text style={styles.title}>Gérer les GIC et leurs leaders.</Text>
          <Text style={styles.subtitle}>Utilisez uniquement un compte administrateur remis par l’entreprise. Aucun compte agent ne peut être créé publiquement.</Text>
          <Text style={styles.label}>Identifiant agent</Text>
          <TextInput style={styles.input} value={account} onChangeText={setAccount} autoCapitalize="none" autoCorrect={false} placeholder="Nom ou contact administrateur" placeholderTextColor="#778173" editable={!submitting} />
          <Text style={styles.label}>Mot de passe</Text>
          <View style={styles.passwordRow}>
            <TextInput style={styles.passwordInput} value={password} onChangeText={setPassword} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} onSubmitEditing={submit} placeholder="Mot de passe" placeholderTextColor="#778173" editable={!submitting} />
            <Pressable onPress={() => setVisible((value) => !value)} style={styles.eye} accessibilityLabel="Afficher ou masquer le mot de passe"><Feather name={visible ? 'eye-off' : 'eye'} size={20} color="#547055" /></Pressable>
          </View>
          <Pressable style={[styles.submit, submitting && styles.disabled]} onPress={submit} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff8e8" /> : <><Text style={styles.submitText}>Ouvrir le tableau de bord</Text><Feather name="arrow-right" size={20} color="#fff8e8" /></>}
          </Pressable>
        </View>
        <Text style={styles.footer}>Les opérations créent des comptes réels. Vérifiez l’identité du leader avant validation.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#10230f', justifyContent: 'center', padding: 24 },
  shell: { width: '100%', maxWidth: 470, alignSelf: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  brandIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#dc7627', alignItems: 'center', justifyContent: 'center' },
  brand: { color: '#fff8e8', fontWeight: '900', fontSize: 20 },
  brandSub: { color: '#adc1ac', fontSize: 13, marginTop: 2 },
  card: { backgroundColor: '#fff8e8', borderRadius: 24, padding: 28, gap: 10, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, elevation: 8 },
  eyebrow: { color: '#dc7627', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#142614', fontSize: 28, fontWeight: '900', lineHeight: 34 },
  subtitle: { color: '#5c685b', fontSize: 14, lineHeight: 21, marginBottom: 12 },
  label: { color: '#2b3b2a', fontSize: 13, fontWeight: '800', marginTop: 4 },
  input: { borderWidth: 1, borderColor: '#d8ddcf', backgroundColor: '#fffdf7', minHeight: 48, borderRadius: 10, paddingHorizontal: 13, color: '#172617', fontSize: 15 },
  passwordRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#d8ddcf', backgroundColor: '#fffdf7', borderRadius: 10 },
  passwordInput: { flex: 1, minHeight: 48, paddingHorizontal: 13, color: '#172617', fontSize: 15 },
  eye: { padding: 14 },
  submit: { minHeight: 52, borderRadius: 12, marginTop: 16, backgroundColor: '#dc7627', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  submitText: { color: '#fff8e8', fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.65 },
  footer: { color: '#adc1ac', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 18 },
  nativeOnly: { flex: 1, backgroundColor: '#fff8e8', padding: 32, justifyContent: 'center', alignItems: 'center' },
  nativeTitle: { color: '#132813', fontSize: 23, fontWeight: '900', marginTop: 16, textAlign: 'center' },
  nativeText: { color: '#596758', fontSize: 15, lineHeight: 22, marginTop: 12, textAlign: 'center' },
  backButton: { backgroundColor: '#132813', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 13, marginTop: 26 },
  backButtonText: { color: '#fff8e8', fontWeight: '800' },
});
