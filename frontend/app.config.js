const { expo } = require('./app.config.base.json');

// Expo injecte `extra` dans le manifest embarqué au moment de l'export web ou
// natif. Cette passerelle est nécessaire pour les hébergements statiques : une
// variable Render n'existe plus dans le navigateur après la compilation.
const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

module.exports = {
  ...expo,
  extra: {
    ...expo.extra,
    ...(apiUrl ? { apiUrl } : {}),
  },
};
