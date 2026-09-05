import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { apiClient, readRole } from '../services/api';

export default function RootIndex() {
  const [isReady, setIsReady] = useState(false);
  const [route, setRoute] = useState<'/onboarding' | '/(buyer)/home' | '/(seller)/home'>('/onboarding');
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      try {
        const role = await readRole();
        if (role === 'buyer') setRoute('/(buyer)/home');
        else if (role === 'seller') setRoute('/(seller)/home');
        else setRoute('/onboarding');
      } catch {
        setRoute('/onboarding');
      } finally {
        setIsReady(true);
      }
    }
    checkAuth();
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#101e0f' }}>
        <ActivityIndicator size="large" color="#d97834" />
      </View>
    );
  }

  return <Redirect href={route} />;
}
