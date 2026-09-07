import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ToastProvider } from '@/components/ui/toast';
import { AuthProvider } from '@/context/AuthContext';

import { useEffect } from 'react';
import { setSyncErrorHandler } from '@/services/database';
import { useToast } from '@/components/ui/toast';

function SyncErrorListener() {
  const { showToast } = useToast();
  useEffect(() => {
    setSyncErrorHandler((message?: string) => {
      showToast({ message: message || 'Mode hors-ligne activé.', type: 'warning' });
    });
  }, [showToast]);
  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <ToastProvider>
        <AuthProvider>
          <SyncErrorListener />
          <AnimatedSplashOverlay />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(buyer)" />
            <Stack.Screen name="(seller)" />
          </Stack>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
