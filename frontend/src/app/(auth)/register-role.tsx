import { Dimensions, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { useToast } from '@/components/ui/toast';

type Role = 'buyer' | 'seller' | null;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export default function RegisterRoleScreen() {
  const [selectedRole, setSelectedRole] = useState<Role>(null);
  const router = useRouter();
  const { showToast } = useToast();

  const handleBack = () => {
    router.back();
  };

  const handleContinue = () => {
    if (!selectedRole) {
      showToast({ message: 'Veuillez choisir un profil pour continuer.', type: 'warning' });
      return;
    }

    if (selectedRole === 'buyer') {
      router.push('/(auth)/register-buyer');
    } else {
      router.push('/(auth)/register-seller');
    }
  };

  return (
    <SafeAreaView style={styles.outerContainer} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#101e0f" />

      {/* Decorative Background Elements */}
      <View style={styles.bgCircle1} />

      <View style={styles.container}>
        {/* Header */}
        <View style={styles.topSection}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color="#f3ecd8" />
            </TouchableOpacity>
          </View>

          <View style={styles.heroSection}>
            <View style={styles.topBadge}>
              <Text style={styles.topBadgeText}>PROFIL UTILISATEUR</Text>
            </View>
            <Text style={styles.heroTitle}>Choisissez votre rôle</Text>
            <Text style={styles.heroSubtitle}>
              Personnalisez votre expérience selon que vous êtes acheteur ou producteur.
            </Text>
          </View>
        </View>

        {/* Options de rôles */}
        <View style={styles.bottomSection}>
          <View style={styles.optionsContainer}>
            {/* Option 1: Acheteur */}
            <TouchableOpacity 
              onPress={() => setSelectedRole('buyer')}
              style={[styles.roleCard, selectedRole === 'buyer' && styles.roleCardActive]}
              activeOpacity={0.9}
            >
              <View style={styles.roleHeaderRow}>
                <View style={[styles.iconWrapper, selectedRole === 'buyer' && styles.iconWrapperActive]}>
                  <Feather name="shopping-bag" size={24} color={selectedRole === 'buyer' ? '#f3ecd8' : '#2a3b29'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleCardTitle}>Acheteur de Récoltes</Text>
                  <Text style={styles.roleCardDesc}>Achetez en gros auprès des coopératives agricoles certifiées.</Text>
                </View>
                <View style={[styles.radioButton, selectedRole === 'buyer' && styles.radioButtonActive]}>
                  {selectedRole === 'buyer' && <View style={styles.radioButtonInner} />}
                </View>
              </View>
            </TouchableOpacity>

            {/* Option 2: Vendeur (GIC) */}
            <TouchableOpacity 
              onPress={() => setSelectedRole('seller')}
              style={[styles.roleCard, selectedRole === 'seller' && styles.roleCardActive]}
              activeOpacity={0.9}
            >
              <View style={styles.roleHeaderRow}>
                <View style={[styles.iconWrapper, selectedRole === 'seller' && styles.iconWrapperActive]}>
                  <Feather name="sun" size={24} color={selectedRole === 'seller' ? '#f3ecd8' : '#2a3b29'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleCardTitle}>Agriculteur & GIC</Text>
                  <Text style={styles.roleCardDesc}>Publiez vos stocks, gérez vos coûts et votre groupement.</Text>
                </View>
                <View style={[styles.radioButton, selectedRole === 'seller' && styles.radioButtonActive]}>
                  {selectedRole === 'seller' && <View style={styles.radioButtonInner} />}
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Pied de page et Bouton Continuer */}
          <View style={styles.footer}>
            <TouchableOpacity 
              onPress={handleContinue} 
              style={[styles.primaryButton, !selectedRole && styles.primaryButtonDisabled]}
              disabled={!selectedRole}
              activeOpacity={0.9}
            >
              <Text style={styles.primaryButtonText}>Continuer l'inscription</Text>
              <Feather name="arrow-right" size={20} color="#f3ecd8" style={styles.btnIcon} />
            </TouchableOpacity>
          </View>
        </View>
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
    left: -SCREEN_WIDTH * 0.3,
    opacity: 0.6,
  },
  container: {
    width: CONTAINER_WIDTH,
    height: '100%',
    position: 'relative',
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
    marginTop: Spacing.five,
    gap: 12,
  },
  topBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(243, 236, 216, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(243, 236, 216, 0.3)',
  },
  topBadgeText: {
    color: '#f3ecd8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 34,
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
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: Spacing.four,
    paddingTop: 40,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    justifyContent: 'space-between',
  },
  optionsContainer: {
    gap: 20,
  },
  roleCard: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e2d8c3',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#101e0f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  roleCardActive: {
    borderColor: '#101e0f',
    backgroundColor: '#fcfff9',
  },
  roleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#f3ecd8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapperActive: {
    backgroundColor: '#101e0f',
  },
  roleCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#101e0f',
    marginBottom: 4,
  },
  roleCardDesc: {
    fontSize: 13,
    color: '#5a6258',
    lineHeight: 18,
    fontWeight: '500',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d2c8b3',
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
    marginTop: 20,
  },
  primaryButton: {
    backgroundColor: '#101e0f',
    height: 64,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#101e0f',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  primaryButtonDisabled: {
    backgroundColor: '#9ca49a',
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
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
