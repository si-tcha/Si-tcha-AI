import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import healthRouter from './api/routes/health.route';
import authRouter from './api/routes/auth.route';
import gicRouter from './api/routes/gic.route';
import adminRouter from './api/routes/admin.route'; // Ajout de la route admin
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';
import { errorHandler } from './api/middlewares/errorHandler.middleware';

dotenv.config();

const app: Express = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Route pour la documentation Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes de l'API
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/gics', gicRouter);
app.use('/api/admin', adminRouter); // Enregistrement de la route admin

app.get('/', (req: Request, res: Response) => {
  res.status(200).send('Hello sur le backend de SI-TCHA AI !');
});

// IMPORTANT : Le gestionnaire d'erreurs doit être le dernier middleware ajouté.
app.use(errorHandler);

export default app;