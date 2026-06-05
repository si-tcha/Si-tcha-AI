import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { protect, isAdmin } from '../middlewares/auth.middleware';
import { createGic, listGicsWithStats } from '../controllers/admin.controller';

const router = Router();

// Toutes les routes dans ce fichier sont protégées et nécessitent le rôle ADMIN
router.use(protect, isAdmin);

// @route   POST /api/admin/gics
// @desc    Créer un nouveau GIC et son leader
// @access  Private (Admin)
router.post(
    '/gics',
    asyncHandler(createGic)
);

// @route   GET /api/admin/gics
// @desc    Lister tous les GICs avec les statistiques de leurs membres
// @access  Private (Admin)
router.get('/gics', asyncHandler(listGicsWithStats));

export default router;