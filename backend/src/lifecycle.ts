import * as http from 'http';
import prisma from './lib/prisma.js';
import { logger, sanitizeErrorForLog } from './middlewares/logger.js';

export interface ShutdownOptions {
  server?: http.Server;
  timeoutMs?: number;
}

export async function gracefulShutdown(options: ShutdownOptions = {}): Promise<void> {
  const { server, timeoutMs = 10000 } = options;
  logger.info('Arrêt propre du serveur en cours...');

  // 1. Fermer le serveur HTTP (ne plus accepter de nouvelles requêtes)
  if (server && server.listening) {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        logger.warn('Délai de fermeture HTTP dépassé, fermeture forcée');
        resolve();
      }, timeoutMs);

      server.close((err) => {
        clearTimeout(timer);
        if (err) {
          logger.error(
            { err: sanitizeErrorForLog(err) },
            'Erreur lors de la fermeture du serveur HTTP'
          );
        } else {
          logger.info('Serveur HTTP fermé avec succès');
        }
        resolve();
      });
    });
  }

  // 2. Déconnexion propre du client Prisma
  try {
    await prisma.$disconnect();
    logger.info('Client Prisma déconnecté avec succès');
  } catch (err) {
    logger.error(
      { err: sanitizeErrorForLog(err) },
      'Erreur lors de la déconnexion de Prisma'
    );
  }
}

export function registerProcessLifecycle(server: http.Server): void {
  let isShuttingDown = false;

  const handleSignal = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ signal }, `Signal ${signal} reçu`);
    try {
      await gracefulShutdown({ server, timeoutMs: 10000 });
      logger.info('Arrêt propre terminé, sortie du processus');
      process.exit(0);
    } catch (err) {
      logger.fatal({ err: sanitizeErrorForLog(err) }, "Échec de l'arrêt propre");
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => handleSignal('SIGTERM'));
  process.on('SIGINT', () => handleSignal('SIGINT'));

  process.on('uncaughtException', (err: Error) => {
    logger.fatal(
      { err: sanitizeErrorForLog(err) },
      'Exception non interceptée (uncaughtException)'
    );
    gracefulShutdown({ server, timeoutMs: 5000 }).finally(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason: unknown) => {
    logger.fatal(
      { reason: sanitizeErrorForLog(reason) },
      'Rejet de promesse non géré (unhandledRejection)'
    );
    gracefulShutdown({ server, timeoutMs: 5000 }).finally(() => process.exit(1));
  });
}
