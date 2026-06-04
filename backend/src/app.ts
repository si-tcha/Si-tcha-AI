import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import healthRouter from './api/routes/health.route';
import authRouter from './api/routes/auth.route';
import gicRouter from './api/routes/gic.route';

dotenv.config();

const app: Express = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes de l'API
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/gics', gicRouter);

app.get('/', (req: Request, res: Response) => {
  res.status(200).send('Hello sur le backend de SI-TCHA AI !');
});

export default app;