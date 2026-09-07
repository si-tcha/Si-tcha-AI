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

export function parseCorsOrigins(corsOrigin?: string, nodeEnv: string = 'development'): string[] {
  if (!corsOrigin || corsOrigin.trim().length === 0) {
    return [];
  }
  return corsOrigin
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

export function validateConfig(rawEnv: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = (rawEnv.NODE_ENV || 'development') as 'development' | 'test' | 'production';

  const defaultLogLevel = nodeEnv === 'production' ? 'info' : nodeEnv === 'test' ? 'warn' : 'debug';

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

    // 3. CORS configurable par liste blanche, aucun CORS universel en production
    if (!data.CORS_ORIGIN || data.CORS_ORIGIN.trim() === '') {
      throw new Error(
        "[CONFIG ERROR] CORS_ORIGIN est obligatoire en production. Définissez la liste blanche des origines autorisées séparées par des virgules (ex: https://sitcha.app,https://admin.sitcha.app)."
      );
    }
    const origins = parseCorsOrigins(data.CORS_ORIGIN, data.NODE_ENV);
    if (origins.includes('*')) {
      throw new Error(
        "[CONFIG ERROR] CORS_ORIGIN ne peut pas contenir '*' en production. Spécifiez des domaines d'origine explicites."
      );
    }
  }

  const allowedCorsOrigins = parseCorsOrigins(data.CORS_ORIGIN, data.NODE_ENV);

  return {
    ...data,
    allowedCorsOrigins,
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
