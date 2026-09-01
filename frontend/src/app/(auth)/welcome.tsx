import { Dimensions, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export default function WelcomeScreen() {
  const router = useRouter();

  const handleLogin = () => {
    router.push('/(auth)/login');
  };

  const handleRegister = () => {
    router.push('/(auth)/register-role');
  };

  return (
    <View style={styles.outerContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#101e0f" />
      
      {/* SafeAreaView englobe le tout avec fond sombre #101e0f pour la barre de statut */}
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.container}>
          
          {/* Section Supérieure Vert Sombre avec Bords Arrondis */}
          <View style={styles.topGreenCard}>
            <View style={styles.logoBadgeContainer}>
              <View style={styles.logoBadge}>
                <Text style={styles.sproutEmoji}>🌱</Text>
                <View style={styles.smallBadgeCircle}>
                  <Text style={styles.smallBadgeText}>S</Text>
                </View>
              </View>
              <Text style={styles.brandTitle}>SI-TCHA</Text>
              <Text style={styles.brandSubtitleAi}>AI</Text>
            </View>
            <Text style={styles.tagline}>Le marché agricole digital du Cameroun & CEMAC</Text>
          </View>

          {/* Section Inférieure Crème avec Boutons */}
          <View style={styles.bottomSection}>
            <View style={styles.welcomeTextGroup}>
              <Text style={styles.welcomeTitle}>Bienvenue !</Text>
              <Text style={styles.welcomeSubtitle}>Connectez-vous ou créez votre compte sur la plateforme</Text>
            </View>

            <View style={styles.buttonGroup}>
              {/* Bouton Se connecter (Orange) */}
              <TouchableOpacity 
                onPress={handleLogin} 
                style={styles.loginButton}
                activeOpacity={0.85}
              >
                <Text style={styles.loginButtonText}>Se connecter</Text>
              </TouchableOpacity>

              {/* Bouton Créer un compte (Contour sombre) */}
              <TouchableOpacity 
                onPress={handleRegister} 
                style={styles.registerButton}
                activeOpacity={0.85}
              >
                <Text style={styles.registerButtonText}>Créer un compte</Text>
              </TouchableOpacity>
            </View>
          </View>

        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#101e0f', // Fond #101e0f pour combler le haut et la status bar
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    backgroundColor: '#101e0f',
    alignItems: 'center',
  },
  container: {
    width: CONTAINER_WIDTH,
    height: '100%',
    backgroundColor: '#f3ecd8',
    justifyContent: 'space-between',
    alignSelf: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  topGreenCard: {
    height: '50%',
    backgroundColor: '#101e0f',
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    gap: 16,
  },
  logoBadgeContainer: {
    alignItems: 'center',
    gap: 4,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#1d331b',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#d97834',
  },
  sproutEmoji: {
    fontSize: 30,
  },
  smallBadgeCircle: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#d97834',
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#f3ecd8',
    letterSpacing: 1,
  },
  brandSubtitleAi: {
    fontSize: 18,
    fontWeight: '900',
    color: '#d97834',
    letterSpacing: 2,
    marginTop: -6,
  },
  tagline: {
    fontSize: 12,
    color: '#889e87',
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomSection: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    justifyContent: 'space-between',
    backgroundColor: '#f3ecd8',
  },
  welcomeTextGroup: {
    alignItems: 'center',
    marginTop: Spacing.two,
    gap: 8,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#101e0f',
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: '#5a6258',
    textAlign: 'center',
    fontWeight: '500',
  },
  buttonGroup: {
    gap: 12,
    marginBottom: Platform.OS === 'ios' ? Spacing.three : Spacing.two,
  },
  loginButton: {
    backgroundColor: '#d97834',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#d97834',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  loginButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
  },
  registerButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#101e0f',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerButtonText: {
    color: '#101e0f',
    fontWeight: '800',
    fontSize: 16,
  }
});
