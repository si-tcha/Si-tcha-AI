import { Dimensions, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import React, { useState } from 'react';


import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';


const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export default function RegisterBuyerScreen() {
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [focusedField, setFocusedField] = useState<'company' | 'phone' | 'reg' | null>(null);
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  const handleCreateAccount = () => {
    if (!companyName.trim() || !phone.trim() || !regNumber.trim()) {
      alert('Veuillez remplir tous les champs.');
      return;
    }
    // Redirige directement vers la page d'accueil de l'acheteur (Simulation)
    router.replace('/(buyer)/home');
  };

  return (
    <SafeAreaView style={styles.outerContainer}>
      <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f3ecd8" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color="#101e0f" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Compte Acheteur</Text>
            <View style={styles.headerPlaceholder} />
          </View>

          {/* Titres */}
          <View style={styles.titleSection}>
            <Text style={styles.mainTitle}>Votre Entreprise</Text>
            <Text style={styles.subtitle}>
              Entrez les informations de votre entreprise pour acheter en gros.
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
              <Text style={styles.label}>Registre de commerce</Text>
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

            {/* Note d'information */}
            <View style={styles.infoNote}>
              <Feather name="info" size={18} color="#101e0f" style={styles.infoIcon} />
              <Text style={styles.infoText}>
                Votre registre de commerce est nécessaire pour vérifier votre statut d'acheteur professionnel et valider votre compte.
              </Text>
            </View>
          </View>

          {/* Bouton d'action */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={handleCreateAccount} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Créer mon compte</Text>
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
    backgroundColor: '#f3ecd8', // Cream
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
    backgroundColor: '#e6dfcc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#101e0f',
  },
  headerPlaceholder: {
    width: 44,
  },
  titleSection: {
    marginTop: Spacing.two,
    gap: Spacing.one,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#101e0f',
  },
  subtitle: {
    fontSize: 14,
    color: '#5a6258',
    lineHeight: 20,
  },
  formSection: {
    flex: 1,
    marginTop: Spacing.four,
    gap: Spacing.three,
  },
  fieldWrapper: {
    gap: Spacing.two,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#101e0f',
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
    borderColor: '#101e0f',
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
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#e6dfcc40',
    padding: Spacing.three,
    borderRadius: 16,
    marginTop: Spacing.one,
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
  },
  primaryButton: {
    backgroundColor: '#101e0f',
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
    color: '#f3ecd8',
    fontSize: 16,
    fontWeight: '700',
  },
  btnIcon: {
    marginLeft: 8,
  }
});
