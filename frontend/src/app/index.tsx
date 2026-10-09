import React from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { resolveSessionRoute } from '@/auth/sessionRouting';

export default function RootIndex() {
  const { user, authenticated, loading } = useAuth();

  // Le dashboard Render réutilise le même bundle Expo que l'application
  // mobile. Cette variable, définie uniquement sur le Static Site admin,
  // évite que son URL racine ouvre l'onboarding destiné aux utilisateurs.
  const isAdminDashboard = process.env.EXPO_PUBLIC_APP_SURFACE?.trim().toLowerCase() === 'admin';

  if (isAdminDashboard) {
    return <Redirect href="/admin/login" />;
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#064e3b' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!authenticated || !user) {
    return <Redirect href="/onboarding" />;
  }

  const targetRoute = resolveSessionRoute(user);
  return <Redirect href={targetRoute as any} />;
}
