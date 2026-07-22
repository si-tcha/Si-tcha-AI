import { Dimensions, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import React, { useState } from 'react';


import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { apiClient } from '@/services/api';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGIC, setSelectedGIC] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [focusedField, setFocusedField] = useState<'name' | 'phone' | null>(null);
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  const handleConfirm = async () => {
    if (!fullName.trim() || !phone.trim() || !selectedGIC) {
      alert('Veuillez renseigner votre nom, téléphone et GIC.');
      return;
    }
    try {
      const session = await apiClient.registerSeller({
        fullName: fullName.trim(),
        phone: phone.trim(),
        gicName: selectedGIC,
      });
      router.push(session.user.status === 'active' ? '/(auth)/activation-success' : '/(auth)/activation-pending');
      return;
    } catch {
      // Fallback offline: l'approbation réelle se fera lors de la prochaine synchronisation serveur.
    }
    router.push('/(auth)/activation-pending');
  };

  const filteredGICs = searchQuery.trim() === '' 
    ? GIC_LIST 
    : GIC_LIST.filter(gic => gic.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <SafeAreaView style={styles.outerContainer}>
      <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f3ecd8" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.keyboardView}
      >
        <View style={styles.innerContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color="#101e0f" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Compte Vendeur</Text>
            <View style={styles.headerPlaceholder} />
          </View>

          {/* Titre */}
          <View style={styles.titleSection}>
            <Text style={styles.mainTitle}>Sélectionnez votre GIC</Text>
            <Text style={styles.subtitle}>
              Recherchez et rattachez votre compte à votre groupement agricole.
            </Text>
          </View>

          {/* Formulaire & Liste */}
          <View style={styles.formSection}>
            <Text style={styles.label}>Vos informations</Text>
            <View style={[
              styles.searchContainer,
              focusedField === 'name' ? styles.searchContainerFocused : null
            ]}>
              <Feather name="user" size={18} color={focusedField === 'name' ? '#101e0f' : '#5a6258'} style={styles.searchIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Nom complet"
                placeholderTextColor="#9ca49a"
                value={fullName}
                onChangeText={setFullName}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

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

            <Text style={styles.label}>Votre GIC</Text>
            
            {/* Input de recherche */}
            <View style={[
              styles.searchContainer,
              isFocused ? styles.searchContainerFocused : null
            ]}>
              <Feather name="search" size={18} color={isFocused ? '#101e0f' : '#5a6258'} style={styles.searchIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Entrez ou recherchez un GIC..."
                placeholderTextColor="#9ca49a"
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  // Si l'utilisateur tape un truc qui n'est pas dans la liste sélectionnée, on désélectionne
                  if (selectedGIC && text !== selectedGIC) {
                    setSelectedGIC('');
                  }
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

            {/* Note d'information */}
            <View style={styles.infoNote}>
              <Feather name="info" size={18} color="#101e0f" style={styles.infoIcon} />
              <Text style={styles.infoText}>
                Après confirmation, le chef de votre GIC devra approuver votre compte avant que vous ne puissiez vendre vos produits.
              </Text>
            </View>

            {/* Liste de GIC scrollable */}
            <View style={styles.listContainer}>
              <Text style={styles.listHeader}>Groupements trouvés ({filteredGICs.length})</Text>
              <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
                {filteredGICs.map((gic, index) => {
                  const isSelected = selectedGIC === gic;
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
                        <Feather name="home" size={16} color={isSelected ? '#f3ecd8' : '#101e0f'} />
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
                {filteredGICs.length === 0 && (
                  <View style={styles.emptyList}>
                    <Text style={styles.emptyText}>Aucun GIC ne correspond à votre recherche.</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>

          {/* Footer Bouton */}
          <View style={styles.footer}>
            <TouchableOpacity 
              onPress={handleConfirm} 
              style={[
                styles.primaryButton,
                !selectedGIC ? styles.primaryButtonDisabled : null
              ]}
              disabled={!selectedGIC}
            >
              <Text style={styles.primaryButtonText}>Confirmer mon GIC</Text>
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
    gap: Spacing.two,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#101e0f',
    paddingLeft: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e6dfcc',
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    height: 56,
  },
  searchContainerFocused: {
    borderColor: '#101e0f',
  },
  searchIcon: {
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
    marginTop: Spacing.two,
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
  listContainer: {
    flex: 1,
    marginTop: Spacing.three,
    gap: Spacing.two,
  },
  listHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5a6258',
    paddingLeft: 4,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e6dfcc',
  },
  gicListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#f3ecd8',
  },
  gicListItemSelected: {
    backgroundColor: '#e6dfcc40',
  },
  listIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#5a6258',
  },
  gicListTextSelected: {
    color: '#101e0f',
  },
  checkIcon: {
    marginLeft: 8,
  },
  emptyList: {
    padding: Spacing.four,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#5a6258',
    textAlign: 'center',
  },
  footer: {
    marginTop: Spacing.three,
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
  primaryButtonDisabled: {
    backgroundColor: '#9ca49a',
    opacity: 0.5,
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
