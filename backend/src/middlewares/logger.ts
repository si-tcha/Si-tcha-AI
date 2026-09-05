import pino from 'pino';
import pinoHttpPkg from 'pino-http';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV !== 'production'
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
