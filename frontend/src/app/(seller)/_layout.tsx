import { Stack } from 'expo-router';

export default function SellerLayout() {
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
