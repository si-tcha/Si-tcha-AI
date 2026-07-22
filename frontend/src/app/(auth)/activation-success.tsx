import { Dimensions, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React from 'react';


import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');



const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export default function ActivationSuccessScreen() {
  const router = useRouter();

  const handleGoToDashboard = () => {
    // Redirige vers le dashboard du GIC vendeur (Simulation)
    router.replace('/(seller)/home');
  };

  return (
    <SafeAreaView style={styles.outerContainer}>
      <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f3ecd8" />

      {/* Confettis / Décorations d'arrière-plan */}
      <View style={[styles.confetti, { top: '15%', left: '15%', transform: [{ rotate: '15deg' }] }]}><Text style={styles.emoji}>🌱</Text></View>
      <View style={[styles.confetti, { top: '25%', right: '20%', transform: [{ rotate: '-20deg' }] }]}><Text style={styles.emoji}>✨</Text></View>
      <View style={[styles.confetti, { top: '45%', left: '10%', transform: [{ rotate: '45deg' }] }]}><Text style={styles.emoji}>🌽</Text></View>
      <View style={[styles.confetti, { top: '50%', right: '12%', transform: [{ rotate: '-10deg' }] }]}><Text style={styles.emoji}>🥔</Text></View>

      {/* Section Principale */}
      <View style={styles.successSection}>
        <View style={styles.successBadge}>
          <Feather name="check" size={54} color="#f3ecd8" />
        </View>
        
        <Text style={styles.mainTitle}>Compte activé ! 🎉</Text>
        <Text style={styles.subtitle}>
          Votre compte vendeur a été validé avec succès par votre chef GIC. Vous pouvez maintenant commencer à enregistrer vos récoltes et gérer vos dépenses.
        </Text>
      </View>

      {/* Bouton d'action inférieur */}
      <View style={styles.footer}>
        <TouchableOpacity onPress={handleGoToDashboard} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Accéder à mon espace vendeur</Text>
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
    backgroundColor: '#f3ecd8', // Cream
    justifyContent: 'space-between',
    paddingBottom: Spacing.four,
    position: 'relative',
  },
  successSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  successBadge: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#889e87', // Light Green check badge
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#101e0f',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: Spacing.three,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#101e0f', // Dark Green
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#5a6258', // Vert-gris text
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.three,
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
  primaryButtonText: {
    color: '#f3ecd8', // Cream text
    fontSize: 16,
    fontWeight: '700',
  },
  btnIcon: {
    marginLeft: 8,
  },
  confetti: {
    position: 'absolute',
    opacity: 0.7,
  },
  emoji: {
    fontSize: 24,
  }
});
