import { Stack } from 'expo-router';

export default function BuyerLayout() {
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
