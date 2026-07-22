import { Dimensions, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React, { useState } from 'react';


import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';

type Role = 'buyer' | 'seller' | null;


const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export default function RegisterRoleScreen() {
  const [selectedRole, setSelectedRole] = useState<Role>(null);
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  const handleContinue = () => {
    if (!selectedRole) {
      alert('Veuillez choisir un rôle pour continuer.');
      return;
    }

    if (selectedRole === 'buyer') {
      router.push('/(auth)/register-buyer');
    } else {
      router.push('/(auth)/register-seller');
    }
  };

  return (
    <SafeAreaView style={styles.outerContainer}>
      <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f3ecd8" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#101e0f" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Créer un compte</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {/* Titres principaux */}
      <View style={styles.titleSection}>
        <Text style={styles.mainTitle}>Choisissez votre rôle</Text>
        <Text style={styles.subtitle}>
          Sélectionnez le profil qui correspond le mieux à vos activités.
        </Text>
      </View>

      {/* Options de rôles */}
      <View style={styles.optionsContainer}>
        {/* Option 1: Acheteur */}
        <TouchableOpacity 
          onPress={() => setSelectedRole('buyer')}
          style={[
            styles.roleCard,
            selectedRole === 'buyer' ? styles.roleCardActive : null
          ]}
          activeOpacity={0.8}
        >
          <View style={[
            styles.iconWrapper,
            selectedRole === 'buyer' ? styles.iconWrapperActive : null
          ]}>
            <Feather 
              name="shopping-cart" 
              size={28} 
              color={selectedRole === 'buyer' ? '#f3ecd8' : '#101e0f'} 
            />
          </View>
          <View style={styles.roleTextWrapper}>
            <Text style={styles.roleCardTitle}>Je suis Acheteur</Text>
            <Text style={styles.roleCardDesc}>
              J'achète des produits agricoles en gros auprès des GIC.
            </Text>
          </View>
          <View style={[
            styles.radioButton,
            selectedRole === 'buyer' ? styles.radioButtonActive : null
          ]}>
            {selectedRole === 'buyer' && <View style={styles.radioButtonInner} />}
          </View>
        </TouchableOpacity>

        {/* Option 2: Vendeur (GIC) */}
        <TouchableOpacity 
          onPress={() => setSelectedRole('seller')}
          style={[
            styles.roleCard,
            selectedRole === 'seller' ? styles.roleCardActive : null
          ]}
          activeOpacity={0.8}
        >
          <View style={[
            styles.iconWrapper,
            selectedRole === 'seller' ? styles.iconWrapperActive : null
          ]}>
            <Feather 
              name="home" 
              size={28} 
              color={selectedRole === 'seller' ? '#f3ecd8' : '#101e0f'} 
            />
          </View>
          <View style={styles.roleTextWrapper}>
            <Text style={styles.roleCardTitle}>Je suis Vendeur (GIC)</Text>
            <Text style={styles.roleCardDesc}>
              Je vends et gère les produits agricoles via mon groupement (GIC).
            </Text>
          </View>
          <View style={[
            styles.radioButton,
            selectedRole === 'seller' ? styles.radioButtonActive : null
          ]}>
            {selectedRole === 'seller' && <View style={styles.radioButtonInner} />}
          </View>
        </TouchableOpacity>
      </View>

      {/* Pied de page et Bouton Continuer */}
      <View style={styles.footer}>
        <TouchableOpacity 
          onPress={handleContinue} 
          style={[
            styles.primaryButton,
            !selectedRole ? styles.primaryButtonDisabled : null
          ]}
          disabled={!selectedRole}
        >
          <Text style={styles.primaryButtonText}>Continuer</Text>
          <Feather name="arrow-right" size={18} color="#f3ecd8" style={styles.btnIcon} />
        </TouchableOpacity>
      </View>
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
    justifyContent: 'space-between',
    paddingBottom: Spacing.four,
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
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
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.two,
    alignItems: 'center',
    gap: Spacing.two,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#101e0f',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#5a6258',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.three,
  },
  optionsContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e6dfcc',
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.three,
    position: 'relative',
    shadowColor: '#101e0f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  roleCardActive: {
    borderColor: '#101e0f', // Highlighted with Dark Green
    backgroundColor: '#ffffff',
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#f3ecd8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapperActive: {
    backgroundColor: '#101e0f', // Dark Green background for active icon
  },
  roleTextWrapper: {
    flex: 1,
    gap: 4,
  },
  roleCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#101e0f',
  },
  roleCardDesc: {
    fontSize: 12,
    color: '#5a6258',
    lineHeight: 18,
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#e6dfcc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonActive: {
    borderColor: '#101e0f',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#101e0f',
  },
  footer: {
    paddingHorizontal: Spacing.four,
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
  primaryButtonDisabled: {
    backgroundColor: '#9ca49a',
    opacity: 0.5,
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
