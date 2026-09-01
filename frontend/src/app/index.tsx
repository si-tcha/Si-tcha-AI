import { Redirect } from 'expo-router';

export default function RootIndex() {
  // Redirige par défaut vers l'onboarding pour le prototype
  return <Redirect href="/onboarding" />;
}
