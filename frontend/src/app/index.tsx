import React from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { resolveSessionRoute } from '@/auth/sessionRouting';

export default function RootIndex() {
  const { user, authenticated, loading } = useAuth();

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
