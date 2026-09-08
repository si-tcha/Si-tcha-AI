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
  'req.body.secret',
  'req.body.refreshToken',
  'res.headers["set-cookie"]',
  'body.pin',
  'body.password',
  'body.token',
  'body.otp',
  'body.code',
  'body.secret',
  'pin',
  'password',
  'token',
  'otp',
  'code',
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
  '*.secret',
  '*.refreshToken',
  '*.databaseUrl',
  '*.database_url',
  '*.DATABASE_URL',
];

/**
 * Nettoie une chaîne de texte de tous les identifiants, mots de passe, tokens et secrets sensibles.
 */
export function sanitizeLogString(str?: string | null): string {
  if (!str || typeof str !== 'string') return '';

  return (
    str
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
        /(password|passwd|pwd|secret|token|pin|otp|apikey|api_key|authorization|cookie)([\s:=]+)[^\s,;&"']+/gi,
        '$1$2[REDACTED]'
      )
      // 5. Masquage de cookies de session
      .replace(/(session(?:_id)?=)[^;\s&]+/gi, '$1[REDACTED_COOKIE]')
  );
}

/**
 * Sérialiseur sécurisé pour les erreurs :
 * Conserve le nom, le code et le statut HTTP tout en éliminant toute fuite
 * de credentials ou tokens dans le message ou la stack trace.
 */
export function sanitizeErrorForLog(err: any): Record<string, unknown> {
  if (!err) {
    return { error: 'Unknown null/undefined error' };
  }

  if (typeof err === 'string') {
    return { message: sanitizeLogString(err) };
  }

  if (err.message && typeof err.message === 'string') {
    err.message = sanitizeLogString(err.message);
  }

  if (err.stack && typeof err.stack === 'string') {
    err.stack = sanitizeLogString(err.stack);
  }

  const sanitized: Record<string, unknown> = {
    name: err.name || 'Error',
    code: err.code,
    statusCode: err.statusCode || err.status,
    message: err.message || 'No error message',
  };

  if (err.stack) {
    sanitized.stack = err.stack;
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
      for (let i = 0; i < inputArgs.length; i++) {
        const arg = inputArgs[i];
        if (typeof arg === 'string') {
          inputArgs[i] = sanitizeLogString(arg);
        } else if (arg && typeof arg === 'object') {
          if (arg instanceof Error) {
            if (arg.message) arg.message = sanitizeLogString(arg.message);
            if (arg.stack) arg.stack = sanitizeLogString(arg.stack);
          } else if (arg.err instanceof Error) {
            if (arg.err.message) arg.err.message = sanitizeLogString(arg.err.message);
            if (arg.err.stack) arg.err.stack = sanitizeLogString(arg.err.stack);
          } else if (arg.error instanceof Error) {
            if (arg.error.message) arg.error.message = sanitizeLogString(arg.error.message);
            if (arg.error.stack) arg.error.stack = sanitizeLogString(arg.error.stack);
          }
          if (typeof arg.msg === 'string') {
            arg.msg = sanitizeLogString(arg.msg);
          }
          if (typeof arg.message === 'string') {
            arg.message = sanitizeLogString(arg.message);
          }
        }
      }
      return method.apply(this, inputArgs);
    },
  },
  formatters: {
    log(obj: Record<string, any>) {
      if (typeof obj.msg === 'string') {
        obj.msg = sanitizeLogString(obj.msg);
      }
      return obj;
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
  },
  customLogLevel: (req: any, res: any, err?: Error) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});
