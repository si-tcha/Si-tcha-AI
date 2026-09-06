import { Dimensions, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { apiClient } from '@/services/api';
import { useToast } from '@/components/ui/toast';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export function isValidCameroonPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-\+\(\)]/g, '');
  return (cleaned.length === 9 && /^6[2-9]\d{7}$/.test(cleaned)) ||
         (cleaned.length === 12 && /^2376[2-9]\d{7}$/.test(cleaned));
}

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'phone' | 'pin' | null>(null);
  const router = useRouter();
  const { showToast } = useToast();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/onboarding');
    }
  };

  const handleContinue = async () => {
    if (!phone.trim()) {
      showToast({ message: 'Veuillez entrer votre numéro de téléphone.', type: 'warning' });
      return;
    }
    if (!isValidCameroonPhone(phone)) {
      showToast({ message: 'Numéro de téléphone camerounais invalide (+237 6XX XXX XXX).', type: 'error' });
      return;
    }
    if (!pin || pin.length < 4) {
      showToast({ message: 'Veuillez entrer votre code PIN (4 à 6 chiffres).', type: 'warning' });
      return;
    }

    setIsLoading(true);
    try {
      const session = await apiClient.login(phone, pin, role);

      if (session.requireOtp) {
        showToast({ message: session.message || 'Vérification requise', type: 'info' });
        router.push({ pathname: '/(auth)/otp-verification', params: { phone, role } });
        return;
      }

      if (session.user) {
        showToast({ message: `Bienvenue ${session.user.name} !`, type: 'success' });
        if (session.user.role === 'seller') {
          router.replace(session.user.status === 'active' ? '/(seller)/home' : '/(auth)/activation-pending');
        } else {
          router.replace('/(buyer)/home');
        }
      }
    } catch (error: any) {
      if (error.response?.data?.requireOtp) {
        showToast({ message: error.response.data.message, type: 'warning' });
        router.push({ pathname: '/(auth)/otp-verification', params: { phone, role } });
      } else {
        showToast({ message: error.response?.data?.message || error.message || 'Numéro ou code PIN incorrect.', type: 'error' });
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
      <View style={styles.bgCircle2} />

      <View style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>

              <View style={styles.topSection}>
                <View style={styles.header}>
                  <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color="#f3ecd8" />
                  </TouchableOpacity>
                </View>

                <View style={styles.heroSection}>
                  <Text style={styles.heroTitle}>Content de vous revoir.</Text>
                  <Text style={styles.heroSubtitle}>
                    Connectez-vous à votre espace sécurisé.
                  </Text>
                </View>
              </View>

              <View style={styles.bottomSection}>
                <View style={styles.formCard}>

                  {/* Sélecteur de rôle */}
                  <View style={styles.roleToggle}>
                    <TouchableOpacity
                      style={[styles.roleBtn, role === 'buyer' && styles.roleBtnActive]}
                      onPress={() => setRole('buyer')}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.roleBtnText, role === 'buyer' && styles.roleBtnTextActive]}>Acheteur</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.roleBtn, role === 'seller' && styles.roleBtnActive]}
                      onPress={() => setRole('seller')}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.roleBtnText, role === 'seller' && styles.roleBtnTextActive]}>GIC / Vendeur</Text>
                    </TouchableOpacity>
                  </View>

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
                    <Text style={styles.label}>Code de sécurité (PIN)</Text>
                    <View style={[styles.inputContainer, focusedField === 'pin' && styles.inputFocused]}>
                      <Feather name="lock" size={20} color={focusedField === 'pin' ? '#101e0f' : '#8a9488'} style={styles.inputIcon} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="••••••"
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

                  <TouchableOpacity
                    onPress={handleContinue}
                    style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                    activeOpacity={0.9}
                    disabled={isLoading}
                  >
                    <Text style={styles.primaryButtonText}>
                      {isLoading ? 'Connexion en cours...' : 'Accéder à mon espace'}
                    </Text>
                    {!isLoading && <Feather name="arrow-right" size={20} color="#f3ecd8" style={styles.btnIcon} />}
                  </TouchableOpacity>

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
    width: SCREEN_WIDTH * 1.2,
    height: SCREEN_WIDTH * 1.2,
    borderRadius: SCREEN_WIDTH,
    backgroundColor: '#1a3018',
    top: -SCREEN_WIDTH * 0.4,
    left: -SCREEN_WIDTH * 0.2,
    opacity: 0.7,
  },
  bgCircle2: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.8,
    borderRadius: SCREEN_WIDTH,
    backgroundColor: '#234120',
    top: SCREEN_HEIGHT * 0.1,
    right: -SCREEN_WIDTH * 0.3,
    opacity: 0.5,
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
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(243, 236, 216, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
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
  roleToggle: {
    flexDirection: 'row',
    backgroundColor: '#e2d8c3',
    borderRadius: 12,
    padding: 4,
    marginBottom: 8,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  roleBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#101e0f',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  roleBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8a9488',
  },
  roleBtnTextActive: {
    color: '#101e0f',
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
