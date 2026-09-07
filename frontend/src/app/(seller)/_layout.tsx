import { Redirect, Stack } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/context/AuthContext';

export default function SellerLayout() {
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

  if (user.role !== 'seller') {
    if (user.role === 'buyer') {
      return <Redirect href="/(buyer)/home" />;
    }
    return <Redirect href="/(auth)/login" />;
  }

  if (user.status !== 'active' && user.statut !== 'APPROUVE') {
    return <Redirect href="/(auth)/activation-pending" />;
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
