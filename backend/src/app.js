import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import healthRouter from './api/routes/health.route';
import apiRouter from './api/routes/api.route';
dotenv.config();
const app = express();
// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Routes de l'API
app.use('/api/health', healthRouter);
app.use('/api', apiRouter);
app.get('/', (req, res) => {
    res.status(200).send('Hello sur le backend de SI-TCHA AI !');
});
export default app;
