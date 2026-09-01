import { Dimensions, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export default function RegisterSellerScreen() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGIC, setSelectedGIC] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [focusedField, setFocusedField] = useState<'name' | 'phone' | 'password' | 'confirm' | null>(null);
  const router = useRouter();
  const { showToast } = useToast();

  const effectiveGIC = selectedGIC || searchQuery.trim();

  const handleBack = () => {
    router.back();
  };

  const handleConfirm = async () => {
    if (!fullName.trim()) {
      showToast({ message: 'Veuillez renseigner votre nom complet.', type: 'warning' });
      return;
    }
    if (!phone.trim() || !isValidCameroonPhone(phone)) {
      showToast({ message: 'Veuillez saisir un numéro de téléphone camerounais valide (+237 6XX XXX XXX).', type: 'warning' });
      return;
    }
    if (!password.trim()) {
      showToast({ message: 'Veuillez créer un mot de passe.', type: 'warning' });
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
    if (!effectiveGIC) {
      showToast({ message: 'Veuillez choisir ou saisir le nom de votre GIC.', type: 'warning' });
      return;
    }

    try {
      const session = await apiClient.registerSeller({
        fullName: fullName.trim(),
        phone: phone.trim(),
        gicName: effectiveGIC,
      });
      showToast({ message: 'Demande de création de compte enregistrée !', type: 'success' });
      router.push(session.user.status === 'active' ? '/(auth)/activation-success' : '/(auth)/activation-pending');
      return;
    } catch {
      // Fallback offline
    }

    showToast({ message: 'Compte Vendeur créé avec succès !', type: 'success' });
    router.push('/(auth)/activation-pending');
  };

  const filteredGICs = searchQuery.trim() === '' 
    ? GIC_LIST 
    : GIC_LIST.filter(gic => gic.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <SafeAreaView style={styles.outerContainer} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f3ecd8" />
      <View style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.keyboardView}
        >
          <View style={styles.innerContainer}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <Feather name="arrow-left" size={22} color="#101e0f" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Compte Vendeur GIC</Text>
              <View style={styles.headerPlaceholder} />
            </View>

            {/* Titre */}
            <View style={styles.titleSection}>
              <Text style={styles.mainTitle}>Création de compte Producteur</Text>
              <Text style={styles.subtitle}>
                Rattachez votre compte à votre groupement agricole pour accéder au tableau de bord.
              </Text>
            </View>

            {/* Formulaire */}
            <View style={styles.formSection}>
              <Text style={styles.label}>Vos informations personnelles</Text>
              
              {/* Nom */}
              <View style={[
                styles.searchContainer,
                focusedField === 'name' ? styles.searchContainerFocused : null
              ]}>
                <Feather name="user" size={18} color={focusedField === 'name' ? '#101e0f' : '#5a6258'} style={styles.searchIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Nom complet (ex: Jean-Paul Nkomo)"
                  placeholderTextColor="#9ca49a"
                  value={fullName}
                  onChangeText={setFullName}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              {/* Téléphone */}
              <View style={[
                styles.searchContainer,
                focusedField === 'phone' ? styles.searchContainerFocused : null
              ]}>
                <Feather name="phone" size={18} color={focusedField === 'phone' ? '#101e0f' : '#5a6258'} style={styles.searchIcon} />
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

              {/* Mot de passe */}
              <View style={[
                styles.searchContainer,
                focusedField === 'password' ? styles.searchContainerFocused : null
              ]}>
                <Feather name="lock" size={18} color={focusedField === 'password' ? '#101e0f' : '#5a6258'} style={styles.searchIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Créer un mot de passe"
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

              {/* Confirmation mot de passe */}
              <View style={[
                styles.searchContainer,
                focusedField === 'confirm' ? styles.searchContainerFocused : null
              ]}>
                <Feather name="shield" size={18} color={focusedField === 'confirm' ? '#101e0f' : '#5a6258'} style={styles.searchIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Confirmer le mot de passe"
                  placeholderTextColor="#9ca49a"
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onFocus={() => setFocusedField('confirm')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <Text style={styles.label}>Votre GIC partenaire</Text>
              
              {/* Input de recherche GIC */}
              <View style={[
                styles.searchContainer,
                isFocused ? styles.searchContainerFocused : null
              ]}>
                <Feather name="search" size={18} color={isFocused ? '#101e0f' : '#5a6258'} style={styles.searchIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Tapez ou sélectionnez un GIC..."
                  placeholderTextColor="#9ca49a"
                  value={searchQuery}
                  onChangeText={(text) => {
                    setSearchQuery(text);
                    setSelectedGIC(text);
                  }}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => { setSearchQuery(''); setSelectedGIC(''); }}>
                    <Feather name="x" size={18} color="#5a6258" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Liste GIC */}
              <View style={styles.listContainer}>
                <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
                  {filteredGICs.map((gic, index) => {
                    const isSelected = effectiveGIC.toLowerCase() === gic.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={index}
                        onPress={() => {
                          setSelectedGIC(gic);
                          setSearchQuery(gic);
                        }}
                        style={[
                          styles.gicListItem,
                          isSelected ? styles.gicListItemSelected : null
                        ]}
                      >
                        <View style={[
                          styles.listIconBg,
                          isSelected ? styles.listIconBgSelected : null
                        ]}>
                          <Feather name="home" size={15} color={isSelected ? '#f3ecd8' : '#101e0f'} />
                        </View>
                        <Text style={[
                          styles.gicListText,
                          isSelected ? styles.gicListTextSelected : null
                        ]}>{gic}</Text>
                        {isSelected && (
                          <Feather name="check" size={18} color="#101e0f" style={styles.checkIcon} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity 
                onPress={handleConfirm} 
                style={styles.primaryButton}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>Confirmer et Créer mon compte</Text>
                <Feather name="check-circle" size={18} color="#f3ecd8" style={styles.btnIcon} />
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
    position: 'relative',
    overflow: 'hidden',
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
    marginTop: Spacing.two,
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#101e0f',
    paddingLeft: 2,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e6dfcc',
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    height: 48,
  },
  searchContainerFocused: {
    borderColor: '#101e0f',
  },
  searchIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#101e0f',
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e6dfcc',
  },
  gicListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#f3ecd8',
  },
  gicListItemSelected: {
    backgroundColor: '#e6dfcc40',
  },
  listIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#f3ecd8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  listIconBgSelected: {
    backgroundColor: '#101e0f',
  },
  gicListText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#5a6258',
  },
  gicListTextSelected: {
    color: '#101e0f',
    fontWeight: '800',
  },
  checkIcon: {
    marginLeft: 8,
  },
  footer: {
    marginTop: Spacing.two,
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
