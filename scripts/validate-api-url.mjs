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

  // 1. Refus IPv6 loopback (::1), unspecified (::)
  if (
    host === '::1' ||
    host === '0:0:0:0:0:0:0:1' ||
    host === '::' ||
    host === '0:0:0:0:0:0:0:0'
  ) {
    throw new Error(
      'Configuration invalide: EXPO_PUBLIC_API_URL ne peut pas pointer vers une adresse IPv6 loopback ou non-spécifiée en production/preview.'
    );
  }

  // 2. Refus fe80::/10 (link-local, 0xfe80 - 0xfebf) et fc00::/7 (unique-local, 0xfc00 - 0xfdff)
  const firstHextetStr = host.split(':')[0];
  const firstHextetVal = parseInt(firstHextetStr, 16);
  if (!Number.isNaN(firstHextetVal)) {
    // fe80::/10 couvre fe80 à febf (1111 1110 10xx xxxx)
    if (firstHextetVal >= 0xfe80 && firstHextetVal <= 0xfebf) {
      throw new Error(
        'Configuration invalide: EXPO_PUBLIC_API_URL ne peut pas pointer vers une adresse IPv6 link-local fe80::/10 en production/preview.'
      );
    }
    // fc00::/7 couvre fc00 à fdff (1111 110x xxxx xxxx)
    if (firstHextetVal >= 0xfc00 && firstHextetVal <= 0xfdff) {
      throw new Error(
        'Configuration invalide: EXPO_PUBLIC_API_URL ne peut pas pointer vers une adresse IPv6 locale unique fc00::/7 en production/preview.'
      );
    }
  }

  // 3. Refus des adresses IPv4-mapped IPv6 (::ffff:0:0/96)
  if (host.startsWith('::ffff:')) {
    throw new Error(
      'Configuration invalide: EXPO_PUBLIC_API_URL ne peut pas pointer vers une adresse IPv4-mapped IPv6 (::ffff:...) en production/preview.'
    );
  }

  // 4. Extraction et validation des adresses IPv4
  let ipv4Parts = null;
  if (!host.includes(':')) {
    const parts = host.split('.').map(Number);
    if (parts.length === 4 && parts.every((n) => !Number.isNaN(n) && n >= 0 && n <= 255)) {
      ipv4Parts = parts;
    }
  }

  if (ipv4Parts) {
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
