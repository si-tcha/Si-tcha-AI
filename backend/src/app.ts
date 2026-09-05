import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import healthRouter from './api/routes/health.route.js';
import apiRouter from './api/routes/api.route.js';
import adminRouter from './api/routes/admin.route.js';
import gicRouter from './api/routes/gic.route.js';
import weatherRoutes from './api/routes/weather.route.js';
import marketRouter from './api/routes/market.route.js';
import { setupSwagger } from './swagger.js';
import { httpLogger } from './middlewares/logger.js';
import { apiLimiter } from './middlewares/rateLimiter.js';
import { errorHandler } from './middlewares/errorHandler.js';

dotenv.config();

// Support de sérialisation BigInt dans les réponses JSON
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const app: Express = express();
app.disable('etag'); // Prevent 304 Not Modified bugs with React Native fetch

// Middlewares
app.use(httpLogger); // Logging middleware (Pino)
app.use(apiLimiter); // Rate Limiting middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Documentation Swagger
setupSwagger(app);

// Routes de l'API
app.use('/api/health', healthRouter);
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

export default app;
