import React, { useEffect } from 'react';
import { useColorScheme, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ToastProvider, useToast } from '@/components/ui/toast';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { setSyncErrorHandler } from '@/services/database';

function SyncErrorListener() {
  const { showToast } = useToast();
  useEffect(() => {
    setSyncErrorHandler((message?: string) => {
      showToast({ message: message || 'Mode hors-ligne activé.', type: 'warning' });
    });
  }, [showToast]);
  return null;
}

function NavigationRoot() {
  const { isOffline, token, restoreSession, signOut } = useAuth();

  // Mode hors-ligne avec session locale existante
  if (isOffline && token) {
    return (
      <View style={styles.offlineContainer}>
        <View style={styles.iconCircle}>
          <Ionicons name="cloud-offline-outline" size={54} color="#ef4444" />
        </View>
        <Text style={styles.offlineTitle}>Connexion impossible</Text>
        <Text style={styles.offlineSubtitle}>
          Impossible d’établir la communication avec les serveurs SI-TCHA. Vérifiez votre réseau mobile ou Wi-Fi et réessayez.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => restoreSession()} activeOpacity={0.8}>
          <Ionicons name="refresh-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
          <Text style={styles.retryText}>Réessayer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutButton} onPress={() => signOut()} activeOpacity={0.7}>
          <Text style={styles.logoutText}>Changer de compte</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(buyer)" />
      <Stack.Screen name="(seller)" />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <ToastProvider>
        <AuthProvider>
          <SyncErrorListener />
          <AnimatedSplashOverlay />
          <NavigationRoot />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  offlineContainer: {
    flex: 1,
    backgroundColor: '#064e3b',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  offlineTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
  },
  offlineSubtitle: {
    fontSize: 15,
    color: '#d1fae5',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    maxWidth: 320,
    marginBottom: 16,
  },
  retryText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  logoutButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  logoutText: {
    color: '#6ee7b7',
    fontSize: 14,
    fontWeight: '500',
  },
});
