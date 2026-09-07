import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/context/AuthContext';

export default function RootIndex() {
  const { user, authenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#101e0f' }}>
        <ActivityIndicator size="large" color="#d97834" />
      </View>
    );
  }

  if (!authenticated || !user) {
    return <Redirect href="/onboarding" />;
  }

  if (user.role === 'buyer') {
    return <Redirect href="/(buyer)/home" />;
  }

  if (user.role === 'seller') {
    if (user.status === 'active' || user.statut === 'APPROUVE') {
      return <Redirect href="/(seller)/home" />;
    }
    return <Redirect href="/(auth)/activation-pending" />;
  }

  return <Redirect href="/onboarding" />;
}
