import { Dimensions, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';

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
    <SafeAreaView style={styles.outerContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#101e0f" />
      <View style={styles.container}>
        
        {/* Section Supérieure Vert Sombre avec Bords Arrondis (50% de la hauteur) */}
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
          <Text style={styles.tagline}>Le marché agricole digital du Cameroun</Text>
        </View>

        {/* Section Inférieure Blanche avec Boutons */}
        <View style={styles.bottomSection}>
          <View style={styles.welcomeTextGroup}>
            <Text style={styles.welcomeTitle}>Bienvenue !</Text>
            <Text style={styles.welcomeSubtitle}>Connectez-vous ou créez un nouveau compte</Text>
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
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: isWeb ? '#222222' : '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: CONTAINER_WIDTH,
    height: '100%',
    backgroundColor: '#ffffff',
    justifyContent: 'space-between',
    alignSelf: 'center',
    shadowColor: isWeb ? '#000000' : 'transparent',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 25,
    elevation: isWeb ? 10 : 0,
    position: 'relative',
    overflow: 'hidden',
  },
  topGreenCard: {
    height: '48%',
    backgroundColor: '#101e0f', // Dark Green
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
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
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1d331b',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#d9783440',
  },
  sproutEmoji: {
    fontSize: 28,
  },
  smallBadgeCircle: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#4a5d4e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1,
  },
  brandSubtitleAi: {
    fontSize: 18,
    fontWeight: '900',
    color: '#d97834', // Accent orange AI
    letterSpacing: 2,
    marginTop: -6,
  },
  tagline: {
    fontSize: 12,
    color: '#889e87',
    fontWeight: '500',
    textAlign: 'center',
  },
  bottomSection: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
  },
  welcomeTextGroup: {
    alignItems: 'center',
    marginTop: Spacing.two,
    gap: 8,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#101e0f',
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: '#777777',
    textAlign: 'center',
  },
  buttonGroup: {
    gap: 12,
    marginBottom: Platform.OS === 'ios' ? Spacing.three : Spacing.two,
  },
  loginButton: {
    backgroundColor: '#d97834', // Orange officiel Figma
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
    fontWeight: '700',
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
    fontWeight: '700',
    fontSize: 16,
  }
});
