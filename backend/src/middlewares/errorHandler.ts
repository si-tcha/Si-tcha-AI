import { Request, Response, NextFunction } from 'express';
import { logger } from './logger.js';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Gérer les erreurs de parsing JSON du body
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400 && 'body' in err) {
    return res.status(400).json({
      message: 'Format de requête JSON invalide',
    });
  }

  // Gérer les payloads trop volumineux
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({
      message: 'Taille du corps de la requête trop volumineuse',
    });
  }

  // Gérer le rejet CORS
  if (err.message && err.message.includes('CORS')) {
    logger.warn({ origin: req.headers.origin, url: req.originalUrl }, 'CORS Request Blocked');
    return res.status(403).json({
      message: err.message,
    });
  }

  // Gérer les erreurs de validation Zod
  if (err instanceof ZodError) {
    logger.warn({ err }, 'Validation Error');
    return res.status(400).json({
      message: 'Erreur de validation',
      errors: err.issues.map((e: any) => ({ path: e.path.join('.'), message: e.message })),
    });
  }

  // Gérer les erreurs de contrainte unique de Prisma
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    const fields = (err.meta as any)?.target;
    const fieldStr = Array.isArray(fields) ? fields.join(', ') : (fields || 'unique');
    logger.warn({ err }, 'Prisma Unique Constraint Violation');
    return res.status(409).json({
      message: `Un enregistrement avec cette valeur pour '${fieldStr}' existe déjà.`,
    });
  }

  // Gestion générale des erreurs
  const statusCode = typeof err.statusCode === 'number'
    ? err.statusCode
    : typeof err.status === 'number'
    ? err.status
    : (res.statusCode >= 400 ? res.statusCode : 500);

  const isProd = process.env.NODE_ENV === 'production';

  if (statusCode >= 500) {
    logger.error({ err, req }, 'Server Error');
  } else {
    logger.warn({ err }, 'Client Error');
  }

  const safeMessage = isProd && statusCode >= 500
    ? 'Une erreur interne est survenue.'
    : (err.message || 'Erreur interne du serveur');

  // Ne jamais exposer de stack trace ou d'objet brut
  res.status(statusCode).json({
    message: safeMessage,
  });
}
