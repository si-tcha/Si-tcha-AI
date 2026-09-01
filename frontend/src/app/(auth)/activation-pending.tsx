import { ActivityIndicator, Dimensions, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React, { useEffect } from 'react';


import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';


const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export default function ActivationPendingScreen() {
  const router = useRouter();

  // Pour la simulation de prototype: on redirige automatiquement après 6 secondes vers l'écran d'activation validée,
  // ou l'utilisateur peut cliquer sur le bouton pour aller plus vite.
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSimulateActivation();
    }, 6000);
    return () => clearTimeout(timer);
  }, []);

  const handleSimulateActivation = () => {
    router.replace('/(auth)/activation-success');
  };

  return (
    <SafeAreaView style={styles.outerContainer}>
      <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f3ecd8" />

      {/* Partie Haute: Loader animé stylisé */}
      <View style={styles.loaderSection}>
        <View style={styles.loaderCircle}>
          <Text style={styles.wheatEmoji}>🌾</Text>
          <ActivityIndicator size="large" color="#d97834" style={styles.spinner} />
        </View>
        <Text style={styles.mainTitle}>Activation en cours...</Text>
        <Text style={styles.subtitle}>
          Votre demande est en cours de traitement par le chef de votre GIC.
        </Text>
      </View>

      {/* Partie Centrale: Étapes d'activation */}
      <View style={styles.stepsSection}>
        {/* Étape 1 */}
        <View style={styles.stepItem}>
          <View style={styles.stepIconBg}>
            <Feather name="phone-call" size={20} color="#101e0f" />
          </View>
          <View style={styles.stepTextWrapper}>
            <Text style={styles.stepTitle}>Contactez votre chef GIC</Text>
            <Text style={styles.stepDesc}>
              Informez-le de votre demande d'inscription pour accélérer la validation de votre profil.
            </Text>
          </View>
        </View>

        {/* Étape 2 */}
        <View style={styles.stepItem}>
          <View style={styles.stepIconBg}>
            <Feather name="check-circle" size={20} color="#101e0f" />
          </View>
          <View style={styles.stepTextWrapper}>
            <Text style={styles.stepTitle}>Validation automatique</Text>
            <Text style={styles.stepDesc}>
              L'application vous redirigera automatiquement dès que le chef aura validé votre accès.
            </Text>
          </View>
        </View>
      </View>

      {/* Pied de page: Bouton pour simuler rapidement */}
      <View style={styles.footer}>
        <TouchableOpacity onPress={handleSimulateActivation} style={styles.simulateButton}>
          <Text style={styles.simulateButtonText}>Simuler la validation du chef (Prototype)</Text>
          <Feather name="fast-forward" size={16} color="#5a6258" />
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
  },
  loaderSection: {
    flex: 1.2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  loaderCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#e6dfcc',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#101e0f',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  wheatEmoji: {
    fontSize: 48,
    zIndex: 2,
  },
  spinner: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    zIndex: 1,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#101e0f', // Dark Green
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  subtitle: {
    fontSize: 14,
    color: '#5a6258', // Vert-gris
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.three,
  },
  stepsSection: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
    gap: Spacing.four,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    gap: 12,
  },
  stepIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f3ecd8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepTextWrapper: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#101e0f',
  },
  stepDesc: {
    fontSize: 12,
    color: '#5a6258',
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
  },
  simulateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#e6dfcc40',
    borderWidth: 1,
    borderColor: '#e6dfcc',
  },
  simulateButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5a6258',
  }
});
