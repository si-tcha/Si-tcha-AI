import { Dimensions, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
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
  const [step, setStep] = useState(1);

  // Step 1
  const [companyName, setCompanyName] = useState('');
  const [regNumber, setRegNumber] = useState('');

  // Step 2
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'company' | 'phone' | 'reg' | 'pin' | 'confirm' | null>(null);

  const router = useRouter();
  const { showToast } = useToast();

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    } else {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(auth)/register-role');
      }
    }
  };

  const nextStep = () => {
    if (!companyName.trim() || !regNumber.trim()) {
      showToast({ message: "Veuillez remplir les informations de l'entreprise.", type: 'warning' });
      return;
    }
    setStep(2);
  };

  const handleCreateAccount = async () => {
    if (!phone.trim() || !pin.trim()) {
      showToast({ message: 'Veuillez remplir tous les champs.', type: 'warning' });
      return;
    }
    if (!isValidCameroonPhone(phone)) {
      showToast({ message: 'Numéro de téléphone camerounais invalide (+237 6XX XXX XXX).', type: 'error' });
      return;
    }
    if (pin.length < 4 || pin.length > 6) {
      showToast({ message: 'Le code PIN doit contenir entre 4 et 6 chiffres.', type: 'warning' });
      return;
    }
    if (pin !== confirmPin) {
      showToast({ message: 'Les codes PIN ne correspondent pas.', type: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiClient.registerBuyer({
        companyName: companyName.trim(),
        phone: phone.trim(),
        address: regNumber.trim(),
        pin: pin.trim(),
      });

      if (res.requireOtp) {
        showToast({ message: res.message || 'Code envoyé par SMS', type: 'info' });
        router.push({ pathname: '/(auth)/otp-verification', params: { phone: phone.trim(), role: 'buyer' } });
      } else {
        showToast({ message: 'Compte Acheteur créé avec succès !', type: 'success' });
        router.replace('/(buyer)/home');
      }
    } catch (error: any) {
      setPin('');
      setConfirmPin('');
      const requireOtp = Boolean(error?.requireOtp || error?.payload?.requireOtp);
      const message = error?.message || 'Erreur lors de la création du compte.';

      if (requireOtp) {
        showToast({ message, type: 'warning' });
        router.push({ pathname: '/(auth)/otp-verification', params: { phone: phone.trim(), role: 'buyer' } });
      } else {
        showToast({ message, type: 'error' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.outerContainer} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#101e0f" />

      {/* Decorative Background Elements */}
      <View style={styles.bgCircle1} />

      <View style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              <View style={styles.topSection}>
                <View style={styles.header}>
                  <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color="#f3ecd8" />
                  </TouchableOpacity>
                  <View style={styles.stepIndicator}>
                    <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
                    <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
                    <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
                  </View>
                  <View style={{ width: 44 }} />
                </View>

                <View style={styles.heroSection}>
                  <Text style={styles.heroTitle}>Créer un compte</Text>
                  <Text style={styles.heroSubtitle}>
                    {step === 1 ? "Commençons par les informations de votre entreprise." : "Sécurisons votre compte pour finaliser l'inscription."}
                  </Text>
                </View>
              </View>

              <View style={styles.bottomSection}>
                <View style={styles.formCard}>

                  {step === 1 && (
                    <>
                      <View style={styles.fieldWrapper}>
                        <Text style={styles.label}>Nom de l'entreprise</Text>
                        <View style={[styles.inputContainer, focusedField === 'company' && styles.inputFocused]}>
                          <Feather name="briefcase" size={20} color={focusedField === 'company' ? '#101e0f' : '#8a9488'} style={styles.inputIcon} />
                          <TextInput
                            style={styles.textInput}
                            placeholder="Ex: Distributions Nkomo SARL"
                            placeholderTextColor="#a0a89e"
                            value={companyName}
                            onChangeText={setCompanyName}
                            onFocus={() => setFocusedField('company')}
                            onBlur={() => setFocusedField(null)}
                          />
                        </View>
                      </View>

                      <View style={styles.fieldWrapper}>
                        <Text style={styles.label}>Registre de commerce (RCCM)</Text>
                        <View style={[styles.inputContainer, focusedField === 'reg' && styles.inputFocused]}>
                          <Feather name="file-text" size={20} color={focusedField === 'reg' ? '#101e0f' : '#8a9488'} style={styles.inputIcon} />
                          <TextInput
                            style={styles.textInput}
                            placeholder="RC/YAO/2024/B/00123"
                            placeholderTextColor="#a0a89e"
                            value={regNumber}
                            onChangeText={setRegNumber}
                            onFocus={() => setFocusedField('reg')}
                            onBlur={() => setFocusedField(null)}
                          />
                        </View>
                        <Text style={styles.helperText}>Votre RCCM sera vérifié par notre équipe pour activer les achats de gros.</Text>
                      </View>

                      <TouchableOpacity onPress={nextStep} style={styles.primaryButton} activeOpacity={0.9}>
                        <Text style={styles.primaryButtonText}>Étape suivante</Text>
                        <Feather name="arrow-right" size={20} color="#f3ecd8" style={styles.btnIcon} />
                      </TouchableOpacity>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <View style={styles.fieldWrapper}>
                        <Text style={styles.label}>Téléphone</Text>
                        <View style={[styles.inputContainer, focusedField === 'phone' && styles.inputFocused]}>
                          <Feather name="phone" size={20} color={focusedField === 'phone' ? '#101e0f' : '#8a9488'} style={styles.inputIcon} />
                          <TextInput
                            style={styles.textInput}
                            placeholder="+237 6XX XXX XXX"
                            placeholderTextColor="#a0a89e"
                            keyboardType="phone-pad"
                            value={phone}
                            onChangeText={setPhone}
                            onFocus={() => setFocusedField('phone')}
                            onBlur={() => setFocusedField(null)}
                          />
                        </View>
                      </View>

                      <View style={styles.fieldWrapper}>
                        <Text style={styles.label}>Code PIN</Text>
                        <View style={[styles.inputContainer, focusedField === 'pin' && styles.inputFocused]}>
                          <Feather name="lock" size={20} color={focusedField === 'pin' ? '#101e0f' : '#8a9488'} style={styles.inputIcon} />
                          <TextInput
                            style={styles.textInput}
                            placeholder="Créez un code PIN (4-6 chiffres)"
                            placeholderTextColor="#a0a89e"
                            secureTextEntry={!showPin}
                            keyboardType="number-pad"
                            maxLength={6}
                            value={pin}
                            onChangeText={setPin}
                            onFocus={() => setFocusedField('pin')}
                            onBlur={() => setFocusedField(null)}
                          />
                          <TouchableOpacity onPress={() => setShowPin(!showPin)} style={styles.eyeBtn}>
                            <Feather name={showPin ? 'eye-off' : 'eye'} size={20} color="#8a9488" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.fieldWrapper}>
                        <Text style={styles.label}>Confirmez le code PIN</Text>
                        <View style={[styles.inputContainer, focusedField === 'confirm' && styles.inputFocused]}>
                          <Feather name="shield" size={20} color={focusedField === 'confirm' ? '#101e0f' : '#8a9488'} style={styles.inputIcon} />
                          <TextInput
                            style={styles.textInput}
                            placeholder="Confirmez le code PIN"
                            placeholderTextColor="#a0a89e"
                            secureTextEntry={!showPin}
                            keyboardType="number-pad"
                            maxLength={6}
                            value={confirmPin}
                            onChangeText={setConfirmPin}
                            onFocus={() => setFocusedField('confirm')}
                            onBlur={() => setFocusedField(null)}
                          />
                        </View>
                      </View>

                      <TouchableOpacity
                        onPress={handleCreateAccount}
                        style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                        activeOpacity={0.9}
                        disabled={isLoading}
                      >
                        <Text style={styles.primaryButtonText}>
                          {isLoading ? 'Création en cours...' : "Terminer l'inscription"}
                        </Text>
                        {!isLoading && <Feather name="check" size={20} color="#f3ecd8" style={styles.btnIcon} />}
                      </TouchableOpacity>
                    </>
                  )}

                </View>
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
    backgroundColor: '#101e0f',
    alignItems: 'center',
  },
  bgCircle1: {
    position: 'absolute',
    width: SCREEN_WIDTH * 1.5,
    height: SCREEN_WIDTH * 1.5,
    borderRadius: SCREEN_WIDTH,
    backgroundColor: '#1a3018',
    top: -SCREEN_WIDTH * 0.5,
    right: -SCREEN_WIDTH * 0.3,
    opacity: 0.6,
  },
  container: {
    width: CONTAINER_WIDTH,
    height: '100%',
    position: 'relative',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  topSection: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(243, 236, 216, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(243, 236, 216, 0.2)',
  },
  stepDotActive: {
    backgroundColor: '#f3ecd8',
    transform: [{ scale: 1.2 }],
  },
  stepLine: {
    width: 30,
    height: 2,
    backgroundColor: 'rgba(243, 236, 216, 0.2)',
    borderRadius: 1,
  },
  stepLineActive: {
    backgroundColor: '#f3ecd8',
  },
  heroSection: {
    marginTop: Spacing.three,
    gap: 8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#f3ecd8',
    letterSpacing: -1,
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#c2ccbe',
    lineHeight: 22,
    fontWeight: '500',
    paddingRight: 20,
  },
  bottomSection: {
    flex: 1,
    backgroundColor: '#f3ecd8',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: Spacing.four,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  formCard: {
    gap: 16,
    flex: 1,
  },
  fieldWrapper: {
    gap: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2a3b29',
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e2d8c3',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    shadowColor: '#101e0f',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  inputFocused: {
    borderColor: '#4caf50',
    backgroundColor: '#fcfff9',
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#101e0f',
    fontWeight: '700',
    height: '100%',
  },
  helperText: {
    fontSize: 12,
    color: '#5a6258',
    marginLeft: 4,
    marginTop: -4,
    fontWeight: '500',
  },
  eyeBtn: {
    padding: 8,
  },
  primaryButton: {
    backgroundColor: '#101e0f',
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#101e0f',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
    backgroundColor: '#3a4a39',
  },
  primaryButtonText: {
    color: '#f3ecd8',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  btnIcon: {
    marginLeft: 10,
  }
});
