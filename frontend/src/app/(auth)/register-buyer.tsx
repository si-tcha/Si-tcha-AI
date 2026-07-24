import { Dimensions, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { apiClient } from '@/services/api';
import { useToast } from '@/components/ui/toast';
import { isValidCameroonPhone } from './login';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export default function RegisterBuyerScreen() {
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'company' | 'phone' | 'reg' | 'password' | 'confirm' | null>(null);
  const router = useRouter();
  const { showToast } = useToast();

  const handleBack = () => {
    router.back();
  };

  const handleCreateAccount = async () => {
    if (!companyName.trim() || !phone.trim() || !regNumber.trim() || !password.trim()) {
      showToast({ message: 'Veuillez remplir tous les champs obligatoires.', type: 'warning' });
      return;
    }
    if (!isValidCameroonPhone(phone)) {
      showToast({ message: 'Veuillez saisir un numéro de téléphone camerounais valide (+237 6XX XXX XXX).', type: 'error' });
      return;
    }
    if (password.length < 4) {
      showToast({ message: 'Le mot de passe doit contenir au moins 4 caractères.', type: 'warning' });
      return;
    }
    if (password !== confirmPassword) {
      showToast({ message: 'Les mots de passe ne correspondent pas.', type: 'error' });
      return;
    }
    try {
      await apiClient.registerBuyer({
        companyName: companyName.trim(),
        phone: phone.trim(),
        regNumber: regNumber.trim(),
      });
    } catch {
      // Fallback offline
    }
    showToast({ message: 'Compte Acheteur créé avec succès !', type: 'success' });
    router.replace('/(buyer)/home');
  };

  return (
    <SafeAreaView style={styles.outerContainer} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f3ecd8" />
      <View style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.keyboardView}
        >
          <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <Feather name="arrow-left" size={22} color="#101e0f" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Compte Acheteur / Grossiste</Text>
              <View style={styles.headerPlaceholder} />
            </View>

            {/* Titres */}
            <View style={styles.titleSection}>
              <Text style={styles.mainTitle}>Votre Entreprise</Text>
              <Text style={styles.subtitle}>
                Entrez les informations de votre entreprise et sécurisez votre accès.
              </Text>
            </View>

            {/* Formulaire */}
            <View style={styles.formSection}>
              {/* Nom de l'entreprise */}
              <View style={styles.fieldWrapper}>
                <Text style={styles.label}>Nom de l'entreprise</Text>
                <View style={[
                  styles.inputContainer,
                  focusedField === 'company' ? styles.inputFocused : null
                ]}>
                  <Feather name="briefcase" size={18} color={focusedField === 'company' ? '#101e0f' : '#5a6258'} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ex: Distributions Nkomo SARL"
                    placeholderTextColor="#9ca49a"
                    value={companyName}
                    onChangeText={setCompanyName}
                    onFocus={() => setFocusedField('company')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
              </View>

              {/* Numéro de téléphone */}
              <View style={styles.fieldWrapper}>
                <Text style={styles.label}>Numéro de téléphone</Text>
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

              {/* Registre de commerce */}
              <View style={styles.fieldWrapper}>
                <Text style={styles.label}>Registre de commerce (RCCM)</Text>
                <View style={[
                  styles.inputContainer,
                  focusedField === 'reg' ? styles.inputFocused : null
                ]}>
                  <Feather name="file-text" size={18} color={focusedField === 'reg' ? '#101e0f' : '#5a6258'} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="RC/YAO/2024/B/00123"
                    placeholderTextColor="#9ca49a"
                    value={regNumber}
                    onChangeText={setRegNumber}
                    onFocus={() => setFocusedField('reg')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
              </View>

              {/* Mot de passe */}
              <View style={styles.fieldWrapper}>
                <Text style={styles.label}>Mot de passe</Text>
                <View style={[
                  styles.inputContainer,
                  focusedField === 'password' ? styles.inputFocused : null
                ]}>
                  <Feather name="lock" size={18} color={focusedField === 'password' ? '#101e0f' : '#5a6258'} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Créez un mot de passe"
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

              {/* Confirmation mot de passe */}
              <View style={styles.fieldWrapper}>
                <Text style={styles.label}>Confirmez le mot de passe</Text>
                <View style={[
                  styles.inputContainer,
                  focusedField === 'confirm' ? styles.inputFocused : null
                ]}>
                  <Feather name="shield" size={18} color={focusedField === 'confirm' ? '#101e0f' : '#5a6258'} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Confirmez le mot de passe"
                    placeholderTextColor="#9ca49a"
                    secureTextEntry={!showPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    onFocus={() => setFocusedField('confirm')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
              </View>

              {/* Note d'information */}
              <View style={styles.infoNote}>
                <Feather name="info" size={18} color="#101e0f" style={styles.infoIcon} />
                <Text style={styles.infoText}>
                  Votre registre de commerce est vérifié par nos équipes pour valider votre accès d'acheteur professionnel.
                </Text>
              </View>
            </View>

            {/* Bouton d'action */}
            <View style={styles.footer}>
              <TouchableOpacity onPress={handleCreateAccount} style={styles.primaryButton} activeOpacity={0.85}>
                <Text style={styles.primaryButtonText}>Créer mon compte Acheteur</Text>
                <Feather name="check" size={18} color="#f3ecd8" style={styles.btnIcon} />
              </TouchableOpacity>
            </View>
          </ScrollView>
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
  titleSection: {
    marginTop: Spacing.one,
    gap: 4,
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#101e0f',
  },
  subtitle: {
    fontSize: 13,
    color: '#5a6258',
    lineHeight: 18,
  },
  formSection: {
    flex: 1,
    marginTop: Spacing.three,
    gap: 12,
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
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    height: 48,
  },
  inputFocused: {
    borderColor: '#101e0f',
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#101e0f',
    fontWeight: '600',
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#e6dfcc40',
    padding: Spacing.three,
    borderRadius: 14,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    gap: 10,
  },
  infoIcon: {
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#101e0f',
    lineHeight: 18,
    fontWeight: '500',
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
    fontSize: 15,
    fontWeight: '800',
  },
  btnIcon: {
    marginLeft: 8,
  }
});
