import { Request, Response } from 'express';
import prisma from '../../lib/prisma.js';
import { logger } from '../../middlewares/logger.js';

/**
 * Healthcheck de processus (Liveness)
 * Vérifie simplement que le serveur Express tourne et répond.
 */
export const getHealthStatus = (req: Request, res: Response) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
  });
};

/**
 * Readiness probe
 * Vérifie que les dépendances indispensables (notamment la base de données PostgreSQL via Prisma)
 * sont réellement disponibles pour servir le trafic utilisateur.
 */
export const getReadinessStatus = async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({
      status: 'UP',
      database: 'UP',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ err: error }, 'Readiness probe failed: base de données inaccessible');
    return res.status(503).json({
      status: 'DOWN',
      database: 'DOWN',
      timestamp: new Date().toISOString(),
      error: 'Base de données inaccessible',
    });
  }
};