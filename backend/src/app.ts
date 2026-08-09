import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import healthRouter from './api/routes/health.route.js';
import authRouter from './api/routes/auth.route.js';
import gicRouter from './api/routes/gic.route.js';
import adminRouter from './api/routes/admin.route.js'; // Ajout de la route admin
import weatherRoutes from './api/routes/weather.route.js';
import marketRouter from './api/routes/market.route.js'; // Ajout de la route marché
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.js';
import { errorHandler } from './api/middlewares/errorHandler.middleware.js';

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
app.use('/api/weather', weatherRoutes);
app.use('/api/market', marketRouter); // Enregistrement de la route marché

app.get('/', (req: Request, res: Response) => {
  res.status(200).send('Hello sur le backend de SI-TCHA AI !');
});

// IMPORTANT : Le gestionnaire d'erreurs doit être le dernier middleware ajouté.
app.use(errorHandler);

export default app;