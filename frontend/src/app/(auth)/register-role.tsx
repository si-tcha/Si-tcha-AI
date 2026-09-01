import { Dimensions, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { useToast } from '@/components/ui/toast';

type Role = 'buyer' | 'seller' | null;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
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
      <StatusBar barStyle="dark-content" backgroundColor="#f3ecd8" />

      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Feather name="arrow-left" size={22} color="#101e0f" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Inscription</Text>
          <View style={styles.headerPlaceholder} />
        </View>

        {/* Titres principaux */}
        <View style={styles.titleSection}>
          <View style={styles.topBadge}>
            <Text style={styles.topBadgeText}>👤 PROFIL UTILISATEUR</Text>
          </View>
          <Text style={styles.mainTitle}>Quel est votre rôle principal ?</Text>
          <Text style={styles.subtitle}>
            Choisissez votre profil pour personnaliser vos outils et votre expérience sur SI-TCHA AI.
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
            activeOpacity={0.85}
          >
            <View style={styles.roleHeaderRow}>
              <View style={[
                styles.iconWrapper,
                selectedRole === 'buyer' ? styles.iconWrapperActive : null
              ]}>
                <Feather 
                  name="shopping-bag" 
                  size={24} 
                  color={selectedRole === 'buyer' ? '#f3ecd8' : '#101e0f'} 
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.roleTag}>
                  <Text style={styles.roleTagText}>🛒 ACHETEUR & GROSSISTE</Text>
                </View>
                <Text style={styles.roleCardTitle}>Acheteur de Récoltes</Text>
              </View>
              <View style={[
                styles.radioButton,
                selectedRole === 'buyer' ? styles.radioButtonActive : null
              ]}>
                {selectedRole === 'buyer' && <View style={styles.radioButtonInner} />}
              </View>
            </View>

            <Text style={styles.roleCardDesc}>
              Achetez en gros auprès des coopératives agricoles certifiées avec paiement Mobile Money sécurisé.
            </Text>

            {/* Puces de fonctionnalités */}
            <View style={styles.featurePillsRow}>
              <View style={styles.featurePill}>
                <Text style={styles.featurePillText}>✓ Direct GIC</Text>
              </View>
              <View style={styles.featurePill}>
                <Text style={styles.featurePillText}>✓ Préfinancement</Text>
              </View>
              <View style={styles.featurePill}>
                <Text style={styles.featurePillText}>✓ Reçus QR</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Option 2: Vendeur (GIC) */}
          <TouchableOpacity 
            onPress={() => setSelectedRole('seller')}
            style={[
              styles.roleCard,
              selectedRole === 'seller' ? styles.roleCardActive : null
            ]}
            activeOpacity={0.85}
          >
            <View style={styles.roleHeaderRow}>
              <View style={[
                styles.iconWrapper,
                selectedRole === 'seller' ? styles.iconWrapperActive : null
              ]}>
                <Feather 
                  name="sun" 
                  size={24} 
                  color={selectedRole === 'seller' ? '#f3ecd8' : '#101e0f'} 
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={[styles.roleTag, { backgroundColor: '#fff7ed' }]}>
                  <Text style={[styles.roleTagText, { color: '#d97834' }]}>🌾 PRODUCTEUR & LEADER GIC</Text>
                </View>
                <Text style={styles.roleCardTitle}>Vendeur & Exploitant GIC</Text>
              </View>
              <View style={[
                styles.radioButton,
                selectedRole === 'seller' ? styles.radioButtonActive : null
              ]}>
                {selectedRole === 'seller' && <View style={styles.radioButtonInner} />}
              </View>
            </View>

            <Text style={styles.roleCardDesc}>
              Publiez vos stocks, calculez votre coût de revient réel et gérez votre exploitation hors-ligne.
            </Text>

            {/* Puces de fonctionnalités */}
            <View style={styles.featurePillsRow}>
              <View style={styles.featurePill}>
                <Text style={styles.featurePillText}>✓ Calculateur Coûts</Text>
              </View>
              <View style={styles.featurePill}>
                <Text style={styles.featurePillText}>✓ Agronome IA</Text>
              </View>
              <View style={styles.featurePill}>
                <Text style={styles.featurePillText}>✓ Mode Offline</Text>
              </View>
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
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Continuer vers l'inscription</Text>
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
    backgroundColor: '#f3ecd8',
    alignItems: 'center',
  },
  container: {
    width: CONTAINER_WIDTH,
    height: '100%',
    backgroundColor: '#f3ecd8',
    position: 'relative',
    justifyContent: 'space-between',
    paddingBottom: Platform.OS === 'ios' ? 16 : 12,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
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
    paddingHorizontal: Spacing.four,
    marginTop: 4,
    gap: 6,
  },
  topBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#101e0f',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  topBadgeText: {
    color: '#d97834',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#101e0f',
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 13,
    color: '#5a6258',
    lineHeight: 18,
    fontWeight: '500',
  },
  optionsContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: 16,
  },
  roleCard: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e6dfcc',
    borderRadius: 22,
    padding: 16,
    gap: 12,
    shadowColor: '#101e0f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  roleCardActive: {
    borderColor: '#101e0f',
    backgroundColor: '#ffffff',
    shadowOpacity: 0.12,
  },
  roleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#f3ecd8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapperActive: {
    backgroundColor: '#101e0f',
  },
  roleTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#f3ecd8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 2,
  },
  roleTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#101e0f',
  },
  roleCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#101e0f',
  },
  roleCardDesc: {
    fontSize: 12,
    color: '#5a6258',
    lineHeight: 18,
    fontWeight: '500',
  },
  featurePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  featurePill: {
    backgroundColor: '#f3ecd8',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  featurePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#101e0f',
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
    fontSize: 15,
    fontWeight: '800',
  },
  btnIcon: {
    marginLeft: 8,
  }
});
