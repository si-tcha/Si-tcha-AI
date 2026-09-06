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
  // Catch Zod validation errors
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

  // General error handling
  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  const message = err.message || 'Erreur interne du serveur';

  if (statusCode >= 500) {
    logger.error({ err, req }, 'Server Error');
  } else {
    logger.warn({ err }, 'Client Error');
  }

  res.status(statusCode).json({
    message: process.env.NODE_ENV === 'production' && statusCode >= 500
      ? 'Une erreur interne est survenue.'
      : message,
  });
}
