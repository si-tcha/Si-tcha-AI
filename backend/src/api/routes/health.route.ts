import { Router } from 'express';
import { getHealthStatus, getReadinessStatus } from '../controllers/health.controller.js';

const router = Router();

// Healthcheck de processus / Liveness probe
router.get('/', getHealthStatus);
router.get('/live', getHealthStatus);

// Readiness probe (vérifie la connectivité Prisma / DB)
router.get('/ready', getReadinessStatus);

export default router;