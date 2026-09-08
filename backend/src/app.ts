import 'dotenv/config';
import express, { Express, Request, Response } from 'express';
import healthRouter from './api/routes/health.route.js';
import apiRouter from './api/routes/api.route.js';
import adminRouter from './api/routes/admin.route.js';
import gicRouter from './api/routes/gic.route.js';
import weatherRoutes from './api/routes/weather.route.js';
import marketRouter from './api/routes/market.route.js';
import { setupSwagger } from './swagger.js';
import { httpLogger } from './middlewares/logger.js';
import { createApiLimiter } from './middlewares/rateLimiter.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { securityHeaders, createCorsMiddleware } from './middlewares/security.js';
import { getConfig, AppConfig } from './config/env.js';

// Support de sérialisation BigInt dans les réponses JSON
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

export function createApp(config: AppConfig = getConfig()): Express {
  const app: Express = express();
  app.disable('etag'); // Prevent 304 Not Modified bugs with React Native fetch
  app.disable('x-powered-by');

  // Configuration explicite de trust proxy pour reverse proxy
  if (config.TRUST_PROXY !== false && config.TRUST_PROXY !== undefined) {
    app.set('trust proxy', config.TRUST_PROXY);
  }

  // Middlewares de sécurité de base
  app.use(securityHeaders(config.NODE_ENV));
  app.use(httpLogger); // Logging structuré (Pino avec masquage des données sensibles)
  app.use(createCorsMiddleware(config)); // CORS configurable par liste blanche

  // 1. Sondes de santé d'infrastructure (Liveness & Readiness)
  // Montées OBLIGATOIREMENT avant le rate limiter métier pour rester toujours accessibles aux probes
  app.use('/api/health', healthRouter);

  // 2. Limiteur de requêtes global pour l'API métier
  app.use(
    createApiLimiter({
      max: config.RATE_LIMIT_MAX,
      windowMs: config.RATE_LIMIT_WINDOW_MS,
    })
  );

  // 3. Traitement des corps de requêtes avec limite bornée
  app.use(express.json({ limit: config.BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: config.BODY_LIMIT }));

  // 4. Documentation Swagger (activée selon ENABLE_API_DOCS)
  setupSwagger(app, config.ENABLE_API_DOCS);

  // 5. Routes de l'API métier
  app.use('/api/admin', adminRouter);
  app.use('/api/gics', gicRouter);
  app.use('/api/weather', weatherRoutes);
  app.use('/api/market', marketRouter);
  app.use('/api', apiRouter);

  app.get('/', (req: Request, res: Response) => {
    res.status(200).send('Hello sur le backend de SI-TCHA AI !');
  });

  // Gestionnaire global d'erreurs (doit être le dernier middleware)
  app.use(errorHandler);

  return app;
}

const defaultApp = createApp();
export default defaultApp;
