import { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { AppConfig } from '../config/env.js';

export function securityHeaders(nodeEnv: string = 'development') {
  return (req: Request, res: Response, next: NextFunction) => {
    // Supprimer la signature Express
    res.removeHeader('X-Powered-By');

    // Headers de protection standard recommandés par l'OWASP
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    // HSTS uniquement en production ou si la connexion est sécurisée
    if (nodeEnv === 'production' || req.secure) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // CSP de base permettant le fonctionnement de Swagger UI et des clients mobiles
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;"
    );

    next();
  };
}

export function createCorsMiddleware(config: AppConfig) {
  if (config.NODE_ENV === 'production') {
    return cors({
      origin: (origin, callback) => {
        // Les requêtes sans Origin (ex: applications mobiles React Native, curl, cron) sont autorisées
        if (!origin) {
          return callback(null, true);
        }

        if (config.allowedCorsOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error('Origine non autorisée par la politique CORS de production'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    });
  }

  // En développement / test
  return cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }
      if (config.allowedCorsOrigins.length > 0) {
        if (config.allowedCorsOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Origine non autorisée par la politique CORS'));
      }
      // En développement libre, autoriser l'origine
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });
}
