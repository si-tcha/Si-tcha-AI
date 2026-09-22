import expoConfig from 'eslint-config-expo/flat.js';

export default [
  ...expoConfig,
  {
    ignores: ['dist/**', 'dist-web/**', 'node_modules/**', '.expo/**', 'tests/**'],
  },
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      // Les coordinateurs sont des stores externes stables conservés dans des refs,
      // et les guards de contexte doivent être invalidés dès le rendu pour empêcher
      // toute fuite visuelle A -> B avant l'exécution d'un effet.
      'react-hooks/refs': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
];
