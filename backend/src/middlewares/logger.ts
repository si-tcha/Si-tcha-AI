import pino from 'pino';
import pinoHttpPkg from 'pino-http';

export const SENSITIVE_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-auth-token"]',
  'req.headers["x-api-key"]',
  'req.body.pin',
  'req.body.password',
  'req.body.token',
  'req.body.otp',
  'req.body.code',
  'req.body.otpCode',
  'req.body.verificationCode',
  'req.body.smsCode',
  'req.body.secret',
  'req.body.refreshToken',
  'res.headers["set-cookie"]',
  'body.pin',
  'body.password',
  'body.token',
  'body.otp',
  'body.code',
  'body.otpCode',
  'body.verificationCode',
  'body.smsCode',
  'body.secret',
  'pin',
  'password',
  'token',
  'otp',
  'otpCode',
  'verificationCode',
  'smsCode',
  'secret',
  'refreshToken',
  'authorization',
  'cookie',
  'databaseUrl',
  'database_url',
  'DATABASE_URL',
  'dbUrl',
  '*.pin',
  '*.password',
  '*.token',
  '*.otp',
  '*.otpCode',
  '*.verificationCode',
  '*.smsCode',
  '*.secret',
  '*.refreshToken',
  '*.databaseUrl',
  '*.database_url',
  '*.DATABASE_URL',
];

export const SENSITIVE_KEY_REGEX =
  /^(password|passwd|pwd|secret|token|pin|otp|refreshtoken|authorization|cookie|apikey|api_key|access_token|databaseurl|database_url|dburl)$/i;

export const SENSITIVE_CODE_KEY_REGEX =
  /^(otpcode|otp_code|verificationcode|verification_code|smscode|sms_code)$/i;

export const SENSITIVE_PHONE_KEY_REGEX =
  /^(phone|phonenumber|phone_number|contact|contactphone|contact_phone|telephone|mobile|tel|phone_num)$/i;

/**
 * Masque fortement un numéro de téléphone pour la journalisation sécurisée (ex: +2376******33 ou 6******33).
 * Règle stricte :
 * - Numéro international (+237 ou 237) : conserve +237, le premier chiffre réseau (2 ou 6), 6 étoiles, et les 2 derniers chiffres (+2376******33).
 * - Numéro local : conserve UNIQUEMENT le premier chiffre réseau (2 ou 6), 6 étoiles, et les 2 derniers chiffres (6******33).
 * - Ne conserve JAMAIS 4 chiffres au début d'un numéro local.
 * - Idempotent sans dépendre d'un simple includes('*') contournable.
 */
export function maskPhone(phone?: string | null): string {
  if (!phone || typeof phone !== 'string') return '';
  const raw = phone.trim();

  // Idempotence stricte : si le numéro est déjà masqué selon le format conforme (+2376******33 ou 6******33)
  if (/^(\+?237)?[26]\*{4,8}\d{2}$/.test(raw)) {
    return raw;
  }

  // Normalisation des encodages URL (%2B, %20, %2D, %2F, %2A, %28, %29) et séparateurs
  const normalized = raw
    .replace(/%2b/gi, '+')
    .replace(/%20/gi, ' ')
    .replace(/%2d/gi, '-')
    .replace(/%2f/gi, '/')
    .replace(/%2a/gi, '*')
    .replace(/%28/gi, '(')
    .replace(/%29/gi, ')');
  const digits = normalized.replace(/\D/g, '');

  // 1. Format international camerounais : 00237, +237 ou 237 suivi de 9 chiffres commençant par 2 ou 6
  if (digits.startsWith('00237') && digits.length === 14 && /^[26]/.test(digits.slice(5))) {
    const core = digits.slice(5);
    return `+237${core[0]}******${core.slice(-2)}`;
  }
  if (digits.startsWith('237') && digits.length === 12 && /^[26]/.test(digits.slice(3))) {
    const core = digits.slice(3);
    return `+237${core[0]}******${core.slice(-2)}`;
  }

  // 2. Format local camerounais : 9 chiffres commençant par 2 ou 6
  // Règle : préserver uniquement le 1er chiffre réseau et les 2 derniers chiffres
  if (digits.length === 9 && /^[26]/.test(digits)) {
    return `${digits[0]}******${digits.slice(-2)}`;
  }

  // Fallback si tronqué ou non conforme
  if (digits.length <= 4) return '***';
  return '***';
}

/**
 * Nettoie une chaîne de texte de tous les identifiants, mots de passe, tokens et secrets sensibles.
 * Détecte et masque les numéros camerounais sous toutes leurs variantes (international, local, espaces, tirets, URLs).
 */
export function sanitizeLogString(str?: string | null): string {
  if (!str || typeof str !== 'string') return '';

  let res = str
    // 1. Masquage des URLs de connexion de bases de données (Postgres, MySQL, MongoDB, Redis, etc.)
    .replace(
      /([a-zA-Z0-9+.-]+:\/\/[^:\s/@]+):([^@\s/]+)@/g,
      '$1:[REDACTED_SECRET]@'
    )
    // 2. Masquage des Bearer tokens
    .replace(/(bearer\s+)[a-zA-Z0-9_\-.]+/gi, '$1[REDACTED_TOKEN]')
    // 3. Masquage des JWT (3 parties séparées par des points)
    .replace(/eyJ[a-zA-Z0-9_\-]+\.eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/g, '[REDACTED_JWT]')
    // 4. Masquage des assignations de secrets sensibles (password=..., token=..., pin=..., otp=..., secret=...)
    .replace(
      /(password|passwd|pwd|secret|token|pin|otp|otpcode|verificationcode|smscode|apikey|api_key|authorization|cookie)([\s:=]+)[^\s,;&"']+/gi,
      '$1$2[REDACTED]'
    )
    // 5. Masquage de cookies de session
    .replace(/(session(?:_id)?=)[^;\s&]+/gi, '$1[REDACTED_COOKIE]');

  // Séparateurs de numéros de téléphone autorisés (espaces, tirets, points, slashs, astérisques, parenthèses et URL-encodés)
  const SEP = '(?:[\\s.\\-_/*()]|%20|%2D|%2F|%2A|%28|%29)';

  // 6. Masquage des numéros de téléphone camerounais internationaux (+237, 00237 ou 237 avec séparateurs et URL-encodages)
  const intlRegex = new RegExp(
    `(?<!\\d)(?:\\+|%2B|00)?237${SEP}*[26](?:${SEP}*\\d){8}(?!\\d)`,
    'gi'
  );
  res = res.replace(intlRegex, (match) => maskPhone(match));

  // 7. Masquage des numéros de téléphone camerounais locaux (9 chiffres commençant par 2 ou 6, avec séparateurs et URL-encodages)
  const localRegex = new RegExp(
    `(?<![\\w\\d])([26])(?:${SEP}*\\d){8}(?![\\w\\d])`,
    'gi'
  );
  res = res.replace(localRegex, (match) => maskPhone(match));

  return res;
}

/**
 * Assainit de façon strictement récursive n'importe quel objet ou tableau
 * SANS JAMAIS muter les objets ou tableaux originaux.
 */
export function sanitizeDataRecursively(
  data: any,
  pathStack = new Set<any>(),
  currentPath = ''
): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return sanitizeLogString(data);
  }

  if (typeof data !== 'object') {
    return data;
  }

  // Protection contre les références circulaires réelles sur le chemin actif de parcours
  if (pathStack.has(data)) {
    return '[CIRCULAR]';
  }

  if (data instanceof Date) {
    return new Date(data.getTime());
  }

  if (data instanceof RegExp) {
    return data;
  }

  if (data instanceof Error) {
    return sanitizeErrorForLog(data);
  }

  const nextStack = new Set(pathStack);
  nextStack.add(data);

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeDataRecursively(item, nextStack, currentPath));
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const fullPath = currentPath ? `${currentPath}.${key}` : key;
    const lowerKey = key.toLowerCase();

    // 1. Secrets et codes d'authentification stricts (OTP, PIN, tokens, secrets)
    if (SENSITIVE_KEY_REGEX.test(key) || SENSITIVE_CODE_KEY_REGEX.test(key)) {
      result[key] = '[REDACTED]';
    }
    // 2. Clé 'code' dans un payload de corps de requête (req.body.code, body.code)
    else if (
      lowerKey === 'code' &&
      (currentPath === 'body' ||
        currentPath.endsWith('.body') ||
        currentPath === 'req.body' ||
        currentPath.endsWith('.req.body'))
    ) {
      result[key] = '[REDACTED]';
    }
    // 3. Numéros de téléphone et variantes de contact : masquage sans divulgation du numéro complet
    else if (SENSITIVE_PHONE_KEY_REGEX.test(key)) {
      if (typeof value === 'string') {
        result[key] = maskPhone(value);
      } else if (value && typeof value === 'object') {
        result[key] = sanitizeDataRecursively(value, nextStack, fullPath);
      } else {
        result[key] = value;
      }
    }
    // 4. Autres champs : assainissement récursif en préservant les codes techniques (err.code, P2002, invalid_type, etc.)
    else {
      result[key] = sanitizeDataRecursively(value, nextStack, fullPath);
    }
  }

  return result;
}

/**
 * Sérialiseur sécurisé pour les erreurs :
 * Conserve le nom, le code et le statut HTTP tout en éliminant toute fuite
 * de credentials ou tokens dans le message ou la stack trace.
 * IMPORTANT : Ne mute JAMAIS l'objet Error original.
 */
export function sanitizeErrorForLog(err: any): Record<string, unknown> {
  if (!err) {
    return { error: 'Unknown null/undefined error' };
  }

  if (typeof err === 'string') {
    return { message: sanitizeLogString(err) };
  }

  // Ne JAMAIS muter l'objet Error original
  const sanitized: Record<string, unknown> = {
    name: err.name || 'Error',
    code: err.code,
    statusCode: err.statusCode || err.status,
    message: sanitizeLogString(err.message || 'No error message'),
  };

  if (err.stack) {
    sanitized.stack = sanitizeLogString(err.stack);
  }

  if (err.syscall) {
    sanitized.syscall = err.syscall;
  }
  if (err.errno !== undefined) {
    sanitized.errno = err.errno;
  }

  // Métadonnées utiles pour Prisma (sans exposer de raw query ni de credentials)
  if (err.code && typeof err.code === 'string' && err.code.startsWith('P')) {
    sanitized.prismaCode = err.code;
    if (err.meta) {
      sanitized.metaTarget = (err.meta as any).target;
      sanitized.metaModel = (err.meta as any).modelName;
    }
  }

  return sanitized;
}

export const logger = pino({
  level:
    process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === 'production'
      ? 'info'
      : process.env.NODE_ENV === 'test'
      ? 'warn'
      : 'info'),
  redact: {
    paths: SENSITIVE_PATHS,
    censor: '[REDACTED]',
  },
  serializers: {
    err: sanitizeErrorForLog,
    error: sanitizeErrorForLog,
  },
  hooks: {
    logMethod(inputArgs: any[], method: any) {
      // Cloner et assainir de manière récursive sans jamais muter les arguments originaux
      const sanitizedArgs = inputArgs.map((arg) => {
        if (typeof arg === 'string') {
          return sanitizeLogString(arg);
        }
        if (arg instanceof Error) {
          // Laisser le serializer s'en occuper sans muter l'erreur originale
          return arg;
        }
        if (arg && typeof arg === 'object') {
          return sanitizeDataRecursively(arg);
        }
        return arg;
      });

      // Si l'appel est logger.error(err) avec une Error seule,
      // Pino utiliserait err.message original pour le champ "msg".
      // On passe explicitement le message assaini sans muter err.
      if (inputArgs.length === 1 && inputArgs[0] instanceof Error) {
        return method.call(this, { err: inputArgs[0] }, sanitizeLogString(inputArgs[0].message));
      }

      return method.apply(this, sanitizedArgs);
    },
  },
  formatters: {
    log(obj: Record<string, any>) {
      return sanitizeDataRecursively(obj);
    },
  },
  transport:
    process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        }
      : undefined,
});

const pinoHttp = ((pinoHttpPkg as any).default || pinoHttpPkg) as typeof import('pino-http');

export const httpLogger = (pinoHttp as any)({
  logger,
  autoLogging: true,
  serializers: {
    err: sanitizeErrorForLog,
    req: (req: any) => ({
      requestId: req.id || req.raw?.id,
      method: req.method,
      url: req.url || req.raw?.originalUrl,
      ip: req.remoteAddress || req.raw?.ip,
    }),
    res: (res: any) => ({
      statusCode: res.statusCode,
    }),
  },
  customLogLevel: (req: any, res: any, err?: Error) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});
