import { Dimensions, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { apiClient } from '@/services/api';
import { useToast } from '@/components/ui/toast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export function isValidCameroonPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-\+\(\)]/g, '');
  return (cleaned.length === 9 && /^6[2-9]\d{7}$/.test(cleaned)) ||
         (cleaned.length === 11 && /^2376[2-9]\d{7}$/.test(cleaned));
}

export default function LoginScreen() {
  const [role, setRole] = useState<'seller' | 'buyer'>('seller');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'name' | 'phone' | 'password' | null>(null);
  const router = useRouter();
  const { showToast } = useToast();

  const handleBack = () => {
    router.back();
  };

  const handleContinue = async () => {
    if (!fullName.trim() || !phone.trim() || !password.trim()) {
      showToast({ message: 'Veuillez remplir tous les champs obligatoires.', type: 'warning' });
      return;
    }

    if (!isValidCameroonPhone(phone)) {
      showToast({ message: 'Numéro de téléphone camerounais invalide (+237 6XX XXX XXX).', type: 'error' });
      return;
    }

    if (password.length < 4) {
      showToast({ message: 'Le mot de passe doit contenir au moins 4 caractères.', type: 'warning' });
      return;
    }

    try {
      const session = await apiClient.login(phone, role);
      showToast({ message: `Connexion réussie ! Welcome ${session.user.name}`, type: 'success' });
      if (session.user.role === 'seller') {
        router.replace(session.user.status === 'active' ? '/(auth)/activation-success' : '/(auth)/activation-pending');
      } else {
        router.replace('/(buyer)/home');
      }
    } catch (err: any) {
      showToast({ 
        message: err?.message || 'Compte introuvable ou mot de passe incorrect. Veuillez vérifier ou créer un compte.', 
        type: 'error' 
      });
    }
  };

  return (
    <SafeAreaView style={styles.outerContainer} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f3ecd8" />
      <View style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.keyboardView}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
              
              {/* Header avec bouton Retour */}
              <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                  <Feather name="arrow-left" size={22} color="#101e0f" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Se connecter</Text>
                <View style={styles.headerPlaceholder} />
              </View>

              {/* Sélecteur de Rôle Explicite */}
              <View style={styles.roleTabRow}>
                <TouchableOpacity 
                  style={[styles.roleTab, role === 'seller' && styles.roleTabActive]}
                  onPress={() => setRole('seller')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.roleTabText, role === 'seller' && styles.roleTabTextActive]}>
                    🌾 Vendeur GIC
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.roleTab, role === 'buyer' && styles.roleTabActive]}
                  onPress={() => setRole('buyer')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.roleTabText, role === 'buyer' && styles.roleTabTextActive]}>
                    🛒 Acheteur / Grossiste
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Note d'information du rôle */}
              <View style={styles.noteSection}>
                <Text style={styles.waveEmoji}>👋</Text>
                <Text style={styles.noteText}>
                  {role === 'seller' 
                    ? 'Accédez à votre espace producteur, vos récoltes et vos calculs de coûts.'
                    : 'Accédez à la marketplace, vos paniers et le préfinancement de récoltes.'}
                </Text>
              </View>

              {/* Formulaire de saisie */}
              <View style={styles.formSection}>
                {/* Nom Complet */}
                <View style={styles.fieldWrapper}>
                  <Text style={styles.label}>Nom complet</Text>
                  <View style={[
                    styles.inputContainer,
                    focusedField === 'name' ? styles.inputFocused : null
                  ]}>
                    <Feather name="user" size={18} color={focusedField === 'name' ? '#101e0f' : '#5a6258'} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Ex: Jean-Paul Nkomo"
                      placeholderTextColor="#9ca49a"
                      value={fullName}
                      onChangeText={setFullName}
                      onFocus={() => setFocusedField('name')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                </View>

                {/* Numéro de Téléphone */}
                <View style={styles.fieldWrapper}>
                  <Text style={styles.label}>Numéro de téléphone camerounais</Text>
                  <View style={[
                    styles.inputContainer,
                    focusedField === 'phone' ? styles.inputFocused : null
                  ]}>
                    <Feather name="phone" size={18} color={focusedField === 'phone' ? '#101e0f' : '#5a6258'} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="+237 6XX XXX XXX"
                      placeholderTextColor="#9ca49a"
                      keyboardType="phone-pad"
                      value={phone}
                      onChangeText={setPhone}
                      onFocus={() => setFocusedField('phone')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                </View>

                {/* Mot de Passe / Code PIN */}
                <View style={styles.fieldWrapper}>
                  <Text style={styles.label}>Mot de passe / Code PIN</Text>
                  <View style={[
                    styles.inputContainer,
                    focusedField === 'password' ? styles.inputFocused : null
                  ]}>
                    <Feather name="lock" size={18} color={focusedField === 'password' ? '#101e0f' : '#5a6258'} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Entrez votre mot de passe"
                      placeholderTextColor="#9ca49a"
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                      <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color="#5a6258" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Bouton d'action en bas */}
              <View style={styles.footer}>
                <TouchableOpacity onPress={handleContinue} style={styles.primaryButton} activeOpacity={0.85}>
                  <Text style={styles.primaryButtonText}>Se connecter</Text>
                  <Feather name="arrow-right" size={18} color="#f3ecd8" style={styles.btnIcon} />
                </TouchableOpacity>
              </View>

            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#f3ecd8',
    alignItems: 'center',
  },
  container: {
    width: CONTAINER_WIDTH,
    height: '100%',
    backgroundColor: '#f3ecd8',
    position: 'relative',
    overflow: 'hidden',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    justifyContent: 'space-between',
    paddingBottom: Spacing.four,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#e6dfcc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#101e0f',
  },
  headerPlaceholder: {
    width: 40,
  },
  roleTabRow: {
    flexDirection: 'row',
    backgroundColor: '#e6dfcc',
    borderRadius: 16,
    padding: 4,
    marginTop: 8,
    gap: 4,
  },
  roleTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  roleTabActive: {
    backgroundColor: '#101e0f',
  },
  roleTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5a6258',
  },
  roleTabTextActive: {
    color: '#f3ecd8',
  },
  noteSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    padding: Spacing.three,
    borderRadius: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e6dfcc',
  },
  waveEmoji: {
    fontSize: 22,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: '#101e0f',
    lineHeight: 18,
    fontWeight: '600',
  },
  formSection: {
    flex: 1,
    marginTop: Spacing.four,
    gap: Spacing.three,
  },
  fieldWrapper: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#101e0f',
    paddingLeft: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e6dfcc',
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    height: 52,
  },
  inputFocused: {
    borderColor: '#101e0f',
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#101e0f',
    fontWeight: '600',
  },
  footer: {
    marginTop: Spacing.four,
    marginBottom: Platform.OS === 'ios' ? 12 : 8,
  },
  primaryButton: {
    backgroundColor: '#101e0f',
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#101e0f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#f3ecd8',
    fontSize: 16,
    fontWeight: '800',
  },
  btnIcon: {
    marginLeft: 8,
  }
});
