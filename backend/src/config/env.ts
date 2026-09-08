import 'dotenv/config';
import { z } from 'zod';

const WEAK_SECRETS = new Set([
  'your-secure-random-secret-here',
  'secret',
  'password',
  'jwt_secret',
  'jwtsecret',
  'change-me',
  'changeme',
  'dev-jwt-secret-placeholder-minimum-32-chars-key',
  '12345678901234567890123456789012',
]);

export interface AppConfig {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
  DIRECT_URL?: string;
  JWT_SECRET: string;
  CORS_ORIGIN?: string;
  allowedCorsOrigins: string[];
  BODY_LIMIT: string;
  TRUST_PROXY: boolean | number | string;
  LOG_LEVEL: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  OTP_PROVIDER: 'disabled' | 'development' | 'test' | 'nexah' | 'africastalking';
  ENABLE_API_DOCS: boolean;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX: number;
  AUTH_RATE_LIMIT_MAX: number;
  OPENWEATHER_API_KEY?: string;
  AGROMONITORING_API_KEY?: string;
  GEMINI_API_KEY?: string;
  MISTRAL_API_KEY?: string;
  NEXAH_USER?: string;
  NEXAH_PASSWORD?: string;
  NEXAH_SENDER_ID?: string;
  NEXAH_API_URL?: string;
  AFRICASTALKING_USERNAME?: string;
  AFRICASTALKING_API_KEY?: string;
}

export function parseTrustProxy(val?: string): boolean | number | string {
  if (!val) return false;
  const lower = val.trim().toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  const num = Number(val);
  if (!Number.isNaN(num)) return num;
  return val.trim();
}

export function parseBodyLimitToBytes(limitStr: string): number {
  const trimmed = limitStr.trim().toLowerCase();
  const match = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/.exec(trimmed);
  if (!match) {
    throw new Error(`[CONFIG ERROR] Format de BODY_LIMIT invalide: '${limitStr}'. Format attendu: '1mb', '500kb', etc.`);
  }
  const num = parseFloat(match[1]);
  if (num <= 0) {
    throw new Error(`[CONFIG ERROR] BODY_LIMIT doit être strictement supérieur à 0 (reçu: '${limitStr}').`);
  }
  const unit = match[2] || 'b';
  const multipliers: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };
  const bytes = num * multipliers[unit];
  if (bytes > 10 * 1024 * 1024) {
    throw new Error(`[CONFIG ERROR] BODY_LIMIT trop élevé: '${limitStr}'. Le maximum raisonnable autorisé est de 10mb.`);
  }
  return bytes;
}

export function parseCorsOrigins(corsOrigin?: string, nodeEnv: string = 'development'): string[] {
  if (!corsOrigin || corsOrigin.trim().length === 0) {
    return [];
  }
  const rawList = corsOrigin
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  // Déduplication
  const uniqueList = Array.from(new Set(rawList));

  if (nodeEnv === 'production') {
    return validateProductionCorsOrigins(uniqueList);
  }

  return uniqueList;
}

export function validateProductionCorsOrigins(origins: string[]): string[] {
  if (origins.length === 0) {
    throw new Error(
      "[CONFIG ERROR] CORS_ORIGIN est obligatoire en production. Définissez la liste blanche des origines HTTPS autorisées."
    );
  }

  if (origins.includes('*')) {
    throw new Error(
      "[CONFIG ERROR] CORS_ORIGIN ne peut pas contenir '*' en production. Spécifiez des domaines d'origine HTTPS explicites."
    );
  }

  const normalized = origins.map((origin) => {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`[CONFIG ERROR] Origine CORS invalide: '${origin}' n'est pas une URL valide.`);
    }

    if (parsed.protocol !== 'https:') {
      throw new Error(`[CONFIG ERROR] Origine CORS invalide: '${origin}' doit impérativement être en HTTPS.`);
    }

    if (parsed.username || parsed.password) {
      throw new Error(`[CONFIG ERROR] Origine CORS invalide: '${origin}' ne doit pas contenir d'identifiants.`);
    }

    if (parsed.pathname !== '/' && parsed.pathname !== '') {
      throw new Error(`[CONFIG ERROR] Origine CORS invalide: '${origin}' ne doit pas contenir de chemin.`);
    }

    if (parsed.search || parsed.hash) {
      throw new Error(`[CONFIG ERROR] Origine CORS invalide: '${origin}' ne doit pas contenir de query ou de fragment.`);
    }

    return parsed.origin;
  });

  return Array.from(new Set(normalized));
}

export function validateConfig(rawEnv: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = (rawEnv.NODE_ENV || 'development') as 'development' | 'test' | 'production';
  const defaultLogLevel = nodeEnv === 'production' ? 'info' : nodeEnv === 'test' ? 'warn' : 'debug';

  // Swagger docs : activé par défaut en dev, désactivé par défaut en prod et test
  const defaultEnableDocs = nodeEnv === 'development';

  const defaultRateLimitMax = nodeEnv === 'production' ? 100 : 5000;
  const defaultAuthRateLimitMax = nodeEnv === 'production' ? 20 : 1000;

  const schema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z
      .string()
      .default(
        nodeEnv === 'production'
          ? ''
          : 'postgresql://postgres:postgres@localhost:5432/sitcha_db?schema=public'
      ),
    DIRECT_URL: z.string().optional(),
    JWT_SECRET: z.string().default(
      nodeEnv === 'production'
        ? ''
        : 'dev-jwt-secret-placeholder-minimum-32-chars-key'
    ),
    CORS_ORIGIN: z.string().optional(),
    BODY_LIMIT: z.string().default('1mb'),
    TRUST_PROXY: z.string().optional(),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default(defaultLogLevel),
    OTP_PROVIDER: z
      .enum(['disabled', 'development', 'test', 'nexah', 'africastalking'])
      .default('disabled'),
    ENABLE_API_DOCS: z
      .string()
      .optional()
      .transform((val) => {
        if (val === undefined) return defaultEnableDocs;
        return val.trim().toLowerCase() === 'true' || val.trim() === '1';
      }),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(defaultRateLimitMax),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(defaultAuthRateLimitMax),
    OPENWEATHER_API_KEY: z.string().optional(),
    AGROMONITORING_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    MISTRAL_API_KEY: z.string().optional(),
    NEXAH_USER: z.string().optional(),
    NEXAH_PASSWORD: z.string().optional(),
    NEXAH_SENDER_ID: z.string().optional(),
    NEXAH_API_URL: z.string().optional(),
    AFRICASTALKING_USERNAME: z.string().optional(),
    AFRICASTALKING_API_KEY: z.string().optional(),
  });

  const parsed = schema.safeParse(rawEnv);
  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`[CONFIG ERROR] Validation échouée pour l'environnement:\n${errorDetails}`);
  }

  const data = parsed.data;

  // Validation du BODY_LIMIT
  parseBodyLimitToBytes(data.BODY_LIMIT);

  // Règles strictes en environnement de PRODUCTION
  if (data.NODE_ENV === 'production') {
    // 1. DATABASE_URL obligatoire
    if (!data.DATABASE_URL || data.DATABASE_URL.trim() === '') {
      throw new Error(
        "[CONFIG ERROR] DATABASE_URL est obligatoire en production et ne peut pas être vide."
      );
    }

    // 2. JWT_SECRET obligatoire et robuste
    if (!data.JWT_SECRET || data.JWT_SECRET.trim() === '') {
      throw new Error(
        "[CONFIG ERROR] JWT_SECRET est obligatoire en production et ne peut pas être vide."
      );
    }
    if (WEAK_SECRETS.has(data.JWT_SECRET.toLowerCase())) {
      throw new Error(
        "[CONFIG ERROR] JWT_SECRET utilise une valeur par défaut ou faible interdite en production."
      );
    }
    if (data.JWT_SECRET.length < 32) {
      throw new Error(
        "[CONFIG ERROR] JWT_SECRET est trop faible pour la production (longueur minimale de 32 caractères requise)."
      );
    }

    // 3. CORS en production
    if (!data.CORS_ORIGIN || data.CORS_ORIGIN.trim() === '') {
      throw new Error(
        "[CONFIG ERROR] CORS_ORIGIN est obligatoire en production. Définissez la liste blanche des origines autorisées séparées par des virgules (ex: https://sitcha.app,https://admin.sitcha.app)."
      );
    }

    // 4. OTP_PROVIDER en production : interdiction de 'development' et 'test'
    if (data.OTP_PROVIDER === 'development' || data.OTP_PROVIDER === 'test') {
      throw new Error(
        `[CONFIG ERROR] OTP_PROVIDER='${data.OTP_PROVIDER}' est strictement interdit en production. Seul 'disabled' est autorisé dans cette version.`
      );
    }
  }

  const allowedCorsOrigins = parseCorsOrigins(data.CORS_ORIGIN, data.NODE_ENV);

  return {
    ...data,
    allowedCorsOrigins,
    ENABLE_API_DOCS: data.ENABLE_API_DOCS,
    TRUST_PROXY: parseTrustProxy(data.TRUST_PROXY),
  };
}

let currentConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!currentConfig) {
    currentConfig = validateConfig();
  }
  return currentConfig;
}

export function resetConfigForTesting(): void {
  currentConfig = null;
}
