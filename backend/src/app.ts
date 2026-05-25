import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import healthRouter from './api/routes/health.route';

dotenv.config();

const app: Express = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes de l'API
app.use('/api/health', healthRouter);

app.get('/', (req: Request, res: Response) => {
  res.status(200).send('Hello sur le backend de SI-TCHA AI !');
});

export default app;