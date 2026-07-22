import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register-role" />
      <Stack.Screen name="register-seller" />
      <Stack.Screen name="register-buyer" />
      <Stack.Screen name="activation-pending" />
      <Stack.Screen name="activation-success" />
    </Stack>
  );
}
