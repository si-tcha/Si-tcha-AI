import { Dimensions, Keyboard, KeyboardAvoidingView, Platform, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import React, { useState } from 'react';


import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { apiClient } from '@/services/api';


const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export default function LoginScreen() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [focusedField, setFocusedField] = useState<'name' | 'phone' | null>(null);
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  const handleContinue = async () => {
    if (!fullName.trim() || !phone.trim()) {
      alert('Veuillez remplir tous les champs.');
      return;
    }

    const guessedRole = fullName.toLowerCase().includes('gic') || fullName.toLowerCase().includes('vendeur') || fullName.toLowerCase().includes('jean')
      ? 'seller'
      : 'buyer';

    try {
      const session = await apiClient.login(phone, guessedRole);
      if (session.user.role === 'seller') {
        router.replace(session.user.status === 'active' ? '/(auth)/activation-success' : '/(auth)/activation-pending');
      } else {
        router.replace('/(buyer)/home');
      }
      return;
    } catch {
      // Fallback offline: permet de continuer à utiliser les données locales si le serveur n'est pas joignable.
    }

    if (guessedRole === 'seller') {
      router.replace('/(auth)/activation-success');
    } else {
      router.replace('/(buyer)/home');
    }
  };

  return (
    <SafeAreaView style={styles.outerContainer}>
      <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f3ecd8" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.keyboardView}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.innerContainer}>
            {/* Header avec bouton Retour */}
            <View style={styles.header}>
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <Feather name="arrow-left" size={24} color="#101e0f" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Se connecter</Text>
              <View style={styles.headerPlaceholder} />
            </View>

            {/* Note d'accueil */}
            <View style={styles.noteSection}>
              <Text style={styles.waveEmoji}>👋</Text>
              <Text style={styles.noteText}>
                Entrez vos informations pour accéder à votre compte.
              </Text>
            </View>

            {/* Formulaire de saisie */}
            <View style={styles.formSection}>
              {/* Saisie Nom Complet */}
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

              {/* Saisie Numéro de Téléphone */}
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
            </View>

            {/* Bouton d'action en bas */}
            <View style={styles.footer}>
              <TouchableOpacity onPress={handleContinue} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Continuer</Text>
                <Feather name="arrow-right" size={18} color="#f3ecd8" style={styles.btnIcon} />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: isWeb ? '#e6dfcc' : '#f3ecd8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: CONTAINER_WIDTH,
    height: '100%',
    backgroundColor: '#f3ecd8',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: isWeb ? '#101e0f' : 'transparent',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: isWeb ? 10 : 0,
  },
  containerOld: {
    flex: 1,
    backgroundColor: '#f3ecd8', // Cream background
  },
  keyboardView: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    justifyContent: 'space-between',
    paddingBottom: Spacing.four,
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#e6dfcc', // Slightly darker Cream
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#101e0f', // Dark Green
  },
  headerPlaceholder: {
    width: 44,
  },
  noteSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#e6dfcc60',
    padding: Spacing.three,
    borderRadius: 16,
    marginTop: Spacing.three,
    borderWidth: 1,
    borderColor: '#e6dfcc',
  },
  waveEmoji: {
    fontSize: 24,
  },
  noteText: {
    flex: 1,
    fontSize: 14,
    color: '#101e0f',
    lineHeight: 20,
    fontWeight: '500',
  },
  formSection: {
    flex: 1,
    marginTop: Spacing.five,
    gap: Spacing.four,
  },
  fieldWrapper: {
    gap: Spacing.two,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#101e0f', // Dark Green
    paddingLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e6dfcc',
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    height: 56,
  },
  inputFocused: {
    borderColor: '#101e0f', // Dark Green outline on focus
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#101e0f',
    fontWeight: '500',
  },
  footer: {
    marginTop: Spacing.four,
  },
  primaryButton: {
    backgroundColor: '#101e0f', // Dark Green
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#101e0f',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#f3ecd8', // Cream text
    fontSize: 16,
    fontWeight: '700',
  },
  btnIcon: {
    marginLeft: 8,
  }
});
