import { Dimensions, KeyboardAvoidingView, Platform, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { apiClient } from '@/services/api';
import { useToast } from '@/components/ui/toast';
import { dbService } from '@/services/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export default function OtpVerificationScreen() {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();
  const { phone, role } = useLocalSearchParams<{ phone: string; role?: 'buyer' | 'seller' }>();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(auth)/login');
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      showToast({ message: 'Le code OTP doit contenir 6 chiffres.', type: 'warning' });
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiClient.verifyOtp(phone || '', code, role);
      if (res.token && res.user) {
        showToast({ message: 'Numéro vérifié avec succès !', type: 'success' });
        // Synchroniser la BDD locale (pour remplir le store local avec le profil)
        await dbService.syncRemoteData();

        if (res.user.role === 'seller') {
          router.replace('/(seller)/home');
        } else {
          router.replace('/(buyer)/home');
        }
      }
    } catch (error: any) {
      showToast({
        message: error.response?.data?.message || 'Erreur lors de la vérification du code.',
        type: 'error'
      });
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
                Un code à 6 chiffres a été envoyé au numéro {phone}.
              </Text>
            </View>

            {/* Formulaire */}
            <View style={styles.formSection}>
              <View style={styles.fieldWrapper}>
                <View style={styles.inputContainer}>
                  <Feather name="key" size={18} color="#101e0f" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="123456"
                    placeholderTextColor="#9ca49a"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={code}
                    onChangeText={setCode}
                  />
                </View>
              </View>
            </View>

            {/* Bouton */}
            <View style={styles.footer}>
              <TouchableOpacity
                onPress={handleVerify}
                style={[styles.primaryButton, isLoading && { opacity: 0.7 }]}
                activeOpacity={0.85}
                disabled={isLoading}
              >
                <Text style={styles.primaryButtonText}>{isLoading ? 'Vérification...' : 'Valider'}</Text>
                <Feather name="check" size={18} color="#f3ecd8" style={styles.btnIcon} />
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
  }
});
