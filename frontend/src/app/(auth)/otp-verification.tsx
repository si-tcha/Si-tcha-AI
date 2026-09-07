import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import React, { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { apiClient, ApiError } from '@/services/api';
import { useToast } from '@/components/ui/toast';
import { dbService } from '@/services/database';
import { useAuth } from '@/context/AuthContext';
import { resolveSellerActivationState } from '@/auth/sessionRouting';
import { OTP_DEFAULT_COOLDOWN_SECONDS } from '@/auth/otpCooldown';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export default function OtpVerificationScreen() {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(OTP_DEFAULT_COOLDOWN_SECONDS);
  const router = useRouter();
  const { showToast } = useToast();
  const { completeOtp } = useAuth();
  const { phone, role } = useLocalSearchParams<{ phone: string; role?: 'buyer' | 'seller' }>();

  const effectiveRole = (role === 'seller' ? 'seller' : 'buyer') as 'buyer' | 'seller';

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(auth)/login');
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    if (!phone) {
      showToast({ message: 'Numéro de téléphone manquant pour le renvoi.', type: 'warning' });
      return;
    }

    setIsResending(true);
    try {
      const res = await apiClient.resendOtp({ phone, role: effectiveRole });
      showToast({ message: res.message || 'Nouveau code OTP envoyé par SMS.', type: 'info' });
      setCooldown(60);
    } catch (error: any) {
      if (error instanceof ApiError && error.status === 429) {
        showToast({
          message: error.message || 'Trop de demandes de code OTP. Veuillez patienter avant de réessayer.',
          type: 'error',
        });
      } else if (error instanceof ApiError && error.status === 503) {
        showToast({
          message: error.message || 'Le service SMS est actuellement indisponible. Veuillez réessayer plus tard.',
          type: 'error',
        });
      } else {
        showToast({
          message: error?.message || 'Erreur lors du renvoi du code OTP.',
          type: 'error',
        });
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      showToast({ message: 'Le code OTP doit contenir 6 chiffres.', type: 'warning' });
      return;
    }

    if (!phone) {
      showToast({ message: 'Numéro de téléphone manquant.', type: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      const res = await completeOtp(phone, code, effectiveRole);
      if (res.token && res.user) {
        showToast({ message: 'Numéro vérifié avec succès !', type: 'success' });
        try {
          await dbService.syncRemoteData();
        } catch {}

        if (res.user.role === 'seller') {
          const state = resolveSellerActivationState(res.user);
          if (state === 'APPROVED') {
            router.replace('/(seller)/home');
          } else if (state === 'REJECTED') {
            showToast({
              message: 'Votre adhésion a été refusée par le responsable du GIC.',
              type: 'error',
            });
            router.replace('/(auth)/activation-pending');
          } else {
            router.replace('/(auth)/activation-pending');
          }
        } else {
          router.replace('/(buyer)/home');
        }
      }
    } catch (error: any) {
      setCode('');
      if (error instanceof ApiError && error.status === 429) {
        showToast({
          message: error.message || 'Trop de tentatives. Veuillez patienter avant de réessayer.',
          type: 'error',
        });
      } else if (error instanceof ApiError && error.status === 503) {
        showToast({
          message: error.message || 'Le service de vérification est temporairement indisponible.',
          type: 'error',
        });
      } else {
        showToast({
          message: error?.message || 'Code OTP incorrect ou expiré.',
          type: 'error',
        });
      }
    } finally {
      setIsLoading(false);
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
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <Feather name="arrow-left" size={22} color="#101e0f" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Vérification</Text>
              <View style={styles.headerPlaceholder} />
            </View>

            {/* Titres */}
            <View style={styles.titleSection}>
              <Text style={styles.mainTitle}>Saisissez le code OTP</Text>
              <Text style={styles.subtitle}>
                Un code à 6 chiffres a été envoyé par SMS au numéro {phone || 'indiqué'}.
              </Text>
            </View>

            {/* Formulaire */}
            <View style={styles.formSection}>
              <View style={styles.fieldWrapper}>
                <View style={styles.inputContainer}>
                  <Feather name="key" size={18} color="#101e0f" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="••••••"
                    placeholderTextColor="#9ca49a"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={code}
                    onChangeText={setCode}
                  />
                </View>
              </View>

              {/* Bouton Renvoyer le code */}
              <View style={styles.resendContainer}>
                <Text style={styles.resendPrompt}>Vous n'avez pas reçu de code ?</Text>
                <TouchableOpacity
                  onPress={handleResend}
                  disabled={cooldown > 0 || isResending}
                  style={[
                    styles.resendButton,
                    (cooldown > 0 || isResending) && styles.resendButtonDisabled,
                  ]}
                  activeOpacity={0.7}
                >
                  {isResending ? (
                    <ActivityIndicator size="small" color="#101e0f" />
                  ) : (
                    <Text
                      style={[
                        styles.resendButtonText,
                        cooldown > 0 && styles.resendButtonTextDisabled,
                      ]}
                    >
                      {cooldown > 0 ? `Renvoyer le code (${cooldown}s)` : 'Renvoyer le code'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Bouton de validation */}
            <View style={styles.footer}>
              <TouchableOpacity
                onPress={handleVerify}
                style={[styles.primaryButton, (isLoading || code.length !== 6) && { opacity: 0.7 }]}
                activeOpacity={0.85}
                disabled={isLoading || code.length !== 6}
              >
                <Text style={styles.primaryButtonText}>
                  {isLoading ? 'Vérification...' : 'Valider'}
                </Text>
                {!isLoading && <Feather name="check" size={18} color="#f3ecd8" style={styles.btnIcon} />}
              </TouchableOpacity>
            </View>
          </View>
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
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.four,
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
    marginTop: Spacing.four,
    gap: 4,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#101e0f',
  },
  subtitle: {
    fontSize: 14,
    color: '#5a6258',
    lineHeight: 20,
    marginTop: 8,
  },
  formSection: {
    marginTop: Spacing.four,
    flex: 1,
  },
  fieldWrapper: {
    gap: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#101e0f',
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    height: 56,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 20,
    letterSpacing: 4,
    color: '#101e0f',
    fontWeight: '700',
  },
  resendContainer: {
    marginTop: 24,
    alignItems: 'center',
    gap: 8,
  },
  resendPrompt: {
    fontSize: 14,
    color: '#5a6258',
    fontWeight: '500',
  },
  resendButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#e6dfcc',
  },
  resendButtonDisabled: {
    opacity: 0.6,
  },
  resendButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#101e0f',
  },
  resendButtonTextDisabled: {
    color: '#7a8478',
  },
  footer: {
    marginTop: 'auto',
  },
  primaryButton: {
    backgroundColor: '#101e0f',
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#f3ecd8',
    fontSize: 16,
    fontWeight: '800',
  },
  btnIcon: {
    marginLeft: 8,
  },
});
