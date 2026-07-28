import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import healthRouter from './api/routes/health.route';
import apiRouter from './api/routes/api.route';
import { setupSwagger } from './swagger';
import { httpLogger } from './middlewares/logger';
import { apiLimiter } from './middlewares/rateLimiter';
import { errorHandler } from './middlewares/errorHandler';

dotenv.config();

const app: Express = express();

// Middlewares
app.use(httpLogger); // Logging middleware (Pino)
app.use(apiLimiter); // Rate Limiting middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes de l'API
app.use('/api/health', healthRouter);
app.use('/api', apiRouter);

// Swagger Documentation
setupSwagger(app);

app.get('/', (req: Request, res: Response) => {
  res.status(200).send('Hello sur le backend de SI-TCHA AI !');
});

// Gestionnaire global d'erreurs (doit être le dernier middleware)
app.use(errorHandler);

export default app;
