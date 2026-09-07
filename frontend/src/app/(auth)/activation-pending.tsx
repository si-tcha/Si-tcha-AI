import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Dimensions,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/toast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

export default function ActivationPendingScreen() {
  const router = useRouter();
  const { user, refreshUser, signOut } = useAuth();
  const { showToast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const freshUser = await refreshUser();
      if (freshUser?.status === 'active' || freshUser?.statut === 'APPROUVE') {
        router.replace('/(auth)/activation-success');
      }
    } catch {
      // Ignorer les erreurs silencieuses lors du polling en arrière-plan
    }
  }, [refreshUser, router]);

  // Vérification au montage
  useEffect(() => {
    if (user?.status === 'active' || user?.statut === 'APPROUVE') {
      router.replace('/(auth)/activation-success');
    }
  }, [user, router]);

  // Polling propre toutes les 20 secondes avec nettoyage au démontage
  useEffect(() => {
    const interval = setInterval(() => {
      checkStatus();
    }, 20000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  // Rafraîchissement lors du retour de l'application au premier plan
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        checkStatus();
      }
    });
    return () => subscription.remove();
  }, [checkStatus]);

  // Rafraîchissement manuel par l'utilisateur
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const freshUser = await refreshUser();
      if (freshUser?.status === 'active' || freshUser?.statut === 'APPROUVE') {
        showToast({ message: 'Votre compte a été validé !', type: 'success' });
        router.replace('/(auth)/activation-success');
      } else if (freshUser?.status === 'rejected' || freshUser?.statut === 'REJETE') {
        showToast({ message: 'Votre demande a été refusée par le responsable du GIC.', type: 'error' });
      } else {
        showToast({ message: 'Votre demande est toujours en attente de validation.', type: 'info' });
      }
    } catch {
      showToast({ message: 'Impossible de vérifier le statut. Vérifiez votre connexion.', type: 'error' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  const isRejected = user?.status === 'rejected' || user?.statut === 'REJETE';

  return (
    <SafeAreaView style={styles.outerContainer}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f3ecd8" />

        {isRejected ? (
          /* Vue spécifique en cas de rejet par le GIC */
          <View style={styles.rejectedSection}>
            <View style={styles.rejectedIconBg}>
              <Feather name="x-circle" size={54} color="#d9534f" />
            </View>
            <Text style={styles.rejectedTitle}>Demande refusée</Text>
            <Text style={styles.rejectedDesc}>
              Votre demande d'adhésion au GIC a été refusée par son responsable. Veuillez contacter directement le chef de votre groupement pour régulariser votre situation.
            </Text>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <Feather name="log-out" size={18} color="#f3ecd8" />
              <Text style={styles.logoutButtonText}>Se déconnecter</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Vue normale en cours de traitement */
          <>
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
              <View style={styles.stepItem}>
                <View style={styles.stepIconBg}>
                  <Feather name="phone-call" size={20} color="#101e0f" />
                </View>
                <View style={styles.stepTextWrapper}>
                  <Text style={styles.stepTitle}>Contactez votre chef GIC</Text>
                  <Text style={styles.stepDesc}>
                    Informez-le de votre demande d'inscription pour qu'il valide votre profil.
                  </Text>
                </View>
              </View>

              <View style={styles.stepItem}>
                <View style={styles.stepIconBg}>
                  <Feather name="check-circle" size={20} color="#101e0f" />
                </View>
                <View style={styles.stepTextWrapper}>
                  <Text style={styles.stepTitle}>Validation automatique</Text>
                  <Text style={styles.stepDesc}>
                    L'application s'actualisera dès que le chef aura validé votre accès.
                  </Text>
                </View>
              </View>
            </View>

            {/* Pied de page: Actualisation manuelle et Déconnexion */}
            <View style={styles.footer}>
              <TouchableOpacity
                onPress={handleManualRefresh}
                style={[styles.refreshButton, isRefreshing && { opacity: 0.7 }]}
                disabled={isRefreshing}
                activeOpacity={0.8}
              >
                {isRefreshing ? (
                  <ActivityIndicator size="small" color="#101e0f" />
                ) : (
                  <>
                    <Feather name="rotate-cw" size={16} color="#101e0f" />
                    <Text style={styles.refreshButtonText}>Vérifier le statut</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={handleLogout} style={styles.secondaryLogoutBtn} activeOpacity={0.8}>
                <Text style={styles.secondaryLogoutText}>Se déconnecter</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
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
    color: '#101e0f',
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  subtitle: {
    fontSize: 14,
    color: '#5a6258',
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
    gap: 12,
  },
  refreshButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#101e0f',
    shadowColor: '#101e0f',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  refreshButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#101e0f',
  },
  secondaryLogoutBtn: {
    paddingVertical: 8,
  },
  secondaryLogoutText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7a8478',
    textDecorationLine: 'underline',
  },
  rejectedSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  rejectedIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fde8e8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  rejectedTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#c53030',
    textAlign: 'center',
  },
  rejectedDesc: {
    fontSize: 14,
    color: '#5a6258',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.two,
  },
  logoutButton: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#101e0f',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  logoutButtonText: {
    color: '#f3ecd8',
    fontSize: 15,
    fontWeight: '700',
  },
});
