import { Dimensions, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { apiClient } from '@/services/api';
import { useToast } from '@/components/ui/toast';
import { isValidCameroonPhone } from './login';

const GIC_LIST = [
  "GIC Agro-Vallée Bafoussam",
  "GIC Champs Verts Yaoundé",
  "GIC Producteurs du Centre",
  "GIC Coopérative Maraîchère Douala",
  "GIC Terres Fertiles Ouest",
  "GIC Semences du Littoral",
  "GIC Agri-Sud Cameroun",
  "GIC Coopérative des Exploitants",
  "GIC Récoltes du Nord",
  "GIC Fermes Associées CEMAC",
  "GIC Maraîchers de l'Adamaoua",
  "GIC Cultures Vivrières Bangangté"
];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export default function RegisterSellerScreen() {
  const [step, setStep] = useState(1);

  // Step 1
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  
  // Step 2
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGIC, setSelectedGIC] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'name' | 'phone' | 'pin' | 'confirm' | 'search' | null>(null);
  
  const router = useRouter();
  const { showToast } = useToast();
  
  const effectiveGIC = selectedGIC || searchQuery.trim();

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
    if (!fullName.trim() || !phone.trim() || !pin.trim()) {
      showToast({ message: 'Veuillez remplir toutes vos informations.', type: 'warning' });
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
    setStep(2);
  };

  const handleConfirm = async () => {
    if (!effectiveGIC) {
      showToast({ message: 'Veuillez choisir ou saisir le nom de votre GIC.', type: 'warning' });
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiClient.registerSeller({
        fullName: fullName.trim(),
        phone: phone.trim(),
        gicName: effectiveGIC,
        pin: pin.trim(),
      });
      
      if (res.requireOtp) {
        showToast({ message: res.message || 'Code envoyé par SMS', type: 'info' });
        router.push({ pathname: '/(auth)/otp-verification', params: { phone: phone.trim(), role: 'seller' } });
      } else if (res.user) {
        showToast({ message: 'Demande de création de compte enregistrée !', type: 'success' });
        router.push(res.user.status === 'active' ? '/(auth)/activation-success' : '/(auth)/activation-pending');
      }
    } catch (error: any) {
      showToast({ message: error.response?.data?.message || 'Erreur lors de la création du compte.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredGICs = searchQuery.trim() === '' 
    ? GIC_LIST 
    : GIC_LIST.filter(gic => gic.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <SafeAreaView style={styles.outerContainer} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#101e0f" />
      
      {/* Decorative Background Elements */}
      <View style={styles.bgCircle1} />
      
      <View style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={{ flex: 1 }}>
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
                  <Text style={styles.heroTitle}>Compte Agriculteur</Text>
                  <Text style={styles.heroSubtitle}>
                    {step === 1 ? "Commençons par vos informations personnelles." : "Rattachez-vous à votre groupement agricole (GIC)."}
                  </Text>
                </View>
              </View>

              <View style={styles.bottomSection}>
                <View style={styles.formCard}>
                  
                  {step === 1 && (
                    <>
                      <View style={styles.fieldWrapper}>
                        <Text style={styles.label}>Nom complet</Text>
                        <View style={[styles.inputContainer, focusedField === 'name' && styles.inputFocused]}>
                          <Feather name="user" size={20} color={focusedField === 'name' ? '#101e0f' : '#8a9488'} style={styles.inputIcon} />
                          <TextInput
                            style={styles.textInput}
                            placeholder="Ex: Jean-Paul Nkomo"
                            placeholderTextColor="#a0a89e"
                            value={fullName}
                            onChangeText={setFullName}
                            onFocus={() => setFocusedField('name')}
                            onBlur={() => setFocusedField(null)}
                          />
                        </View>
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

                      <TouchableOpacity onPress={nextStep} style={styles.primaryButton} activeOpacity={0.9}>
                        <Text style={styles.primaryButtonText}>Étape suivante</Text>
                        <Feather name="arrow-right" size={20} color="#f3ecd8" style={styles.btnIcon} />
                      </TouchableOpacity>
                    </>
                  )}

                  {step === 2 && (
                    <View style={{ flex: 1 }}>
                      <View style={styles.fieldWrapper}>
                        <Text style={styles.label}>Rechercher votre GIC</Text>
                        <View style={[styles.inputContainer, focusedField === 'search' && styles.inputFocused]}>
                          <Feather name="search" size={20} color={focusedField === 'search' ? '#101e0f' : '#8a9488'} style={styles.inputIcon} />
                          <TextInput
                            style={styles.textInput}
                            placeholder="Tapez le nom de votre GIC..."
                            placeholderTextColor="#a0a89e"
                            value={searchQuery}
                            onChangeText={(text) => {
                              setSearchQuery(text);
                              setSelectedGIC(text);
                            }}
                            onFocus={() => setFocusedField('search')}
                            onBlur={() => setFocusedField(null)}
                          />
                          {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => { setSearchQuery(''); setSelectedGIC(''); }} style={{ padding: 4 }}>
                              <Feather name="x" size={20} color="#8a9488" />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>

                      <View style={styles.listWrapper}>
                        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                          {filteredGICs.map((gic, index) => {
                            const isSelected = effectiveGIC.toLowerCase() === gic.toLowerCase();
                            return (
                              <TouchableOpacity
                                key={index}
                                onPress={() => {
                                  setSelectedGIC(gic);
                                  setSearchQuery(gic);
                                  Keyboard.dismiss();
                                }}
                                style={[styles.gicListItem, isSelected && styles.gicListItemSelected]}
                              >
                                <View style={[styles.listIconBg, isSelected && styles.listIconBgSelected]}>
                                  <Feather name="home" size={16} color={isSelected ? '#f3ecd8' : '#2a3b29'} />
                                </View>
                                <Text style={[styles.gicListText, isSelected && styles.gicListTextSelected]}>{gic}</Text>
                                {isSelected && <Feather name="check-circle" size={20} color="#101e0f" />}
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>

                      <TouchableOpacity 
                        onPress={handleConfirm} 
                        style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled, { marginTop: 16 }]} 
                        activeOpacity={0.9}
                        disabled={isLoading}
                      >
                        <Text style={styles.primaryButtonText}>
                          {isLoading ? 'Création en cours...' : "Terminer l'inscription"}
                        </Text>
                        {!isLoading && <Feather name="check" size={20} color="#f3ecd8" style={styles.btnIcon} />}
                      </TouchableOpacity>
                    </View>
                  )}
                  
                </View>
              </View>
            </ScrollView>
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
  eyeBtn: {
    padding: 8,
  },
  listWrapper: {
    flex: 1,
    maxHeight: 260,
    marginTop: 16,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e2d8c3',
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  gicListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3ecd8',
  },
  gicListItemSelected: {
    backgroundColor: '#e6dfcc40',
  },
  listIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#f3ecd8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  listIconBgSelected: {
    backgroundColor: '#101e0f',
  },
  gicListText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#5a6258',
  },
  gicListTextSelected: {
    color: '#101e0f',
    fontWeight: '800',
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
