import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { canAccessBuyer, resolveSessionRoute } from '@/auth/sessionRouting';

export default function BuyerLayout() {
  const { user, authenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#064e3b' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!authenticated || !canAccessBuyer(user)) {
    const redirectRoute = resolveSessionRoute(user);
    return <Redirect href={redirectRoute as any} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="gics" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="prefinancing" />
      <Stack.Screen name="checkout" />
      <Stack.Screen name="alerts" />
    </Stack>
  );
}
