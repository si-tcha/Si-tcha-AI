import { Stack } from 'expo-router';

export default function SellerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="terrain" />
      <Stack.Screen name="sync" />
    </Stack>
  );
}
