import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { canAccessSeller, resolveSessionRoute } from '@/auth/sessionRouting';

export default function SellerLayout() {
  const { user, authenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#064e3b' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!authenticated || !canAccessSeller(user)) {
    const redirectRoute = resolveSessionRoute(user);
    return <Redirect href={redirectRoute as any} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="terrain" />
      <Stack.Screen name="agronomist" />
      <Stack.Screen name="b2b-trade" />
      <Stack.Screen name="growth-log" />
      <Stack.Screen name="sync" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}
