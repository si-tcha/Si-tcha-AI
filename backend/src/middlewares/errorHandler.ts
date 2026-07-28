import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { ZodError } from 'zod';

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

  // General error handling
  const statusCode = err.statusCode || 500;
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
