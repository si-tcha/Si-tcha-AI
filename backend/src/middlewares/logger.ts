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
  '*.pin',
  '*.password',
  '*.token',
  '*.otp',
  '*.secret',
  '*.refreshToken',
];

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : process.env.NODE_ENV === 'test' ? 'warn' : 'info'),
  redact: {
    paths: SENSITIVE_PATHS,
    censor: '[REDACTED]',
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
  customLogLevel: (req: any, res: any, err?: Error) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});
