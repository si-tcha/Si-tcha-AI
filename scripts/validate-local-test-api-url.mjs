#!/usr/bin/env node

/**
 * Valide l'URL embarquée dans un APK de test interne déclenché manuellement.
 * Contrairement aux builds preview/production, une adresse HTTP privée du LAN
 * est permise afin qu'un téléphone physique puisse joindre le backend local.
 */
export function validateLocalTestApiUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    throw new Error('Configuration manquante: api_url est absente ou vide.');
  }

  const trimmed = rawUrl.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Configuration invalide: api_url '${rawUrl}' n'est pas une URL valide.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error("Configuration invalide: api_url doit utiliser le protocole HTTP ou HTTPS.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Configuration invalide: api_url ne doit pas contenir d'identifiants.");
  }
  if (parsed.search || parsed.hash || trimmed.includes('?') || trimmed.includes('#')) {
    throw new Error("Configuration invalide: api_url ne doit pas contenir de query string ou de fragment.");
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, '');
  if (normalizedPath !== '/api') {
    throw new Error(`Configuration invalide: api_url doit avoir exactement le chemin '/api' (reçu: '${parsed.pathname}').`);
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host === '::'
  ) {
    throw new Error("Configuration invalide: api_url doit être joignable depuis le téléphone et ne peut pas utiliser une adresse de boucle locale.");
  }

  return `${parsed.protocol}//${parsed.host}/api`;
}

const isMain = process.argv[1]?.endsWith('validate-local-test-api-url.mjs');
if (isMain) {
  try {
    const validated = validateLocalTestApiUrl(process.argv[2] || process.env.EXPO_PUBLIC_API_URL);
    console.log(`[VALIDATION SUCCEEDED] URL API de test interne validée : ${validated}`);
    process.exit(0);
  } catch (error) {
    console.error(`[VALIDATION FAILED] ${error.message}`);
    process.exit(1);
  }
}
