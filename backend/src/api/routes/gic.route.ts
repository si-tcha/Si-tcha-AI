import { Router } from 'express';
import { listGics } from '../controllers/gic.controller';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

// @route   GET /api/gics
// @desc    Lister tous les GICs pour l'enregistrement d'un agriculteur
// @access  Public
router.get('/', asyncHandler(listGics));

export default router;