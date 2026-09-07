import { Redirect, Stack } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/context/AuthContext';

export default function BuyerLayout() {
  const { user, authenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#101e0f' }}>
        <ActivityIndicator size="large" color="#d97834" />
      </View>
    );
  }

  if (!authenticated || !user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (user.role !== 'buyer') {
    if (user.role === 'seller') {
      return (
        <Redirect
          href={
            user.status === 'active' || user.statut === 'APPROUVE'
              ? '/(seller)/home'
              : '/(auth)/activation-pending'
          }
        />
      );
    }
    return <Redirect href="/(auth)/login" />;
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
