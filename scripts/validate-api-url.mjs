#!/usr/bin/env node

/**
 * Script de validation stricte de l'URL API (EXPO_PUBLIC_API_URL).
 * Utilisé dans la CI (.github/workflows/build-apk.yml) et les scripts de validation.
 * En stricte cohérence avec frontend/src/services/api.ts (validateProductionApiUrl).
 */

export function validateApiUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    throw new Error('Configuration manquante: EXPO_PUBLIC_API_URL est absente ou vide.');
  }

  const trimmed = rawUrl.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Configuration invalide: EXPO_PUBLIC_API_URL '${rawUrl}' n'est pas une URL valide.`);
  }

  // Protocole HTTPS obligatoire (refus de HTTP, ws, ftp, etc.)
  if (parsed.protocol !== 'https:') {
    throw new Error(
      `Configuration invalide: EXPO_PUBLIC_API_URL doit impérativement utiliser le protocole HTTPS en production/preview (protocole reçu: '${parsed.protocol}').`
    );
  }

  // Refus de credentials intégrés (username / password)
  if (parsed.username || parsed.password) {
    throw new Error(
      "Configuration invalide: EXPO_PUBLIC_API_URL ne doit pas contenir d'identifiants (username/password)."
    );
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();

  // Refus de localhost et domaines *.localhost
  if (host === 'localhost' || host.endsWith('.localhost')) {
    throw new Error('Configuration invalide: EXPO_PUBLIC_API_URL ne peut pas pointer vers localhost en production/preview.');
  }

  // Refus IPv6 loopback (::1), unspecified (::) et link-local / unique-local
  if (
    host === '::1' ||
    host === '0:0:0:0:0:0:0:1' ||
    host === '::' ||
    host === '0:0:0:0:0:0:0:0' ||
    host.startsWith('fe80:') ||
    host.startsWith('fc00:') ||
    host.startsWith('fd00:')
  ) {
    throw new Error(
      'Configuration invalide: EXPO_PUBLIC_API_URL ne peut pas pointer vers une adresse IPv6 locale ou réservée en production/preview.'
    );
  }

  // Vérification IPv4 (y compris IPv4-mapped IPv6 ::ffff:...)
  const ipv4String = host.startsWith('::ffff:') ? host.slice(7) : host;
  const ipv4Parts = ipv4String.split('.').map(Number);

  if (
    ipv4Parts.length === 4 &&
    ipv4Parts.every((n) => !Number.isNaN(n) && n >= 0 && n <= 255)
  ) {
    const [a, b] = ipv4Parts;
    // 0.0.0.0/8
    if (a === 0) {
      throw new Error('Configuration invalide: EXPO_PUBLIC_API_URL ne peut pas pointer vers 0.0.0.0.');
    }
    // 127.0.0.0/8
    if (a === 127) {
      throw new Error('Configuration invalide: EXPO_PUBLIC_API_URL ne peut pas pointer vers la boucle locale 127.0.0.0/8.');
    }
    // 10.0.0.0/8 (couvre 10.0.2.2 émulateur Android)
    if (a === 10) {
      throw new Error('Configuration invalide: EXPO_PUBLIC_API_URL ne peut pas pointer vers le réseau privé 10.0.0.0/8 (y compris 10.0.2.2).');
    }
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) {
      throw new Error('Configuration invalide: EXPO_PUBLIC_API_URL ne peut pas pointer vers le réseau privé 172.16.0.0/12.');
    }
    // 192.168.0.0/16
    if (a === 192 && b === 168) {
      throw new Error('Configuration invalide: EXPO_PUBLIC_API_URL ne peut pas pointer vers le réseau privé 192.168.0.0/16.');
    }
    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) {
      throw new Error("Configuration invalide: EXPO_PUBLIC_API_URL ne peut pas pointer vers l'adresse link-local 169.254.0.0/16.");
    }
  }

  return trimmed.replace(/\/+$/, '');
}

// Exécution CLI directe
const isMain = process.argv[1] && (process.argv[1].endsWith('validate-api-url.mjs') || process.argv[1].endsWith('validate-api-url.js'));
if (isMain) {
  const urlArg = process.argv[2] || process.env.EXPO_PUBLIC_API_URL;
  try {
    const validated = validateApiUrl(urlArg);
    console.log(`[VALIDATION SUCCEEDED] EXPO_PUBLIC_API_URL validée avec succès : ${validated}`);
    process.exit(0);
  } catch (err) {
    console.error(`[VALIDATION FAILED] ${err.message}`);
    process.exit(1);
  }
}
