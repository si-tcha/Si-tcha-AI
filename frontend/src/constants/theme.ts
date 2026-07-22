/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#101e0f', // Dark Green
    background: '#f3ecd8', // Cream
    backgroundElement: '#e6dfcc', // Cream plus foncé pour les conteneurs
    backgroundSelected: '#d9d1be', // Cream sélectionné
    textSecondary: '#5a6258', // Vert-gris de soutien
    primary: '#101e0f', // Dark Green
    secondary: '#889e87', // Light Green
    accent: '#d97834', // Orange
  },
  dark: {
    text: '#f3ecd8', // Cream
    background: '#101e0f', // Dark Green
    backgroundElement: '#182b17', // Dark Green plus clair pour les conteneurs
    backgroundSelected: '#213d20', // Dark Green sélectionné
    textSecondary: '#9ca49a', // Vert-gris de soutien
    primary: '#889e87', // Light Green
    secondary: '#101e0f', // Dark Green
    accent: '#d97834', // Orange
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
