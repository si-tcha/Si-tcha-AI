import { Router } from 'express';
import { listGics, listPendingMembers, manageMemberStatus } from '../controllers/gic.controller';
import { asyncHandler } from '../../utils/asyncHandler';
import { isGicLeader, protect } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';

const router = Router();

// @route   GET /api/gics
// @desc    Lister tous les GICs pour l'enregistrement d'un agriculteur
// @access  Public
router.get('/', asyncHandler(listGics));

// @route   GET /api/gics/members/pending
// @desc    Lister les membres en attente de validation pour le GIC du leader connecté
// @access  Private (GIC Leader)
router.get(
    '/members/pending',
    protect,
    isGicLeader,
    asyncHandler(listPendingMembers)
);

// @route   PATCH /api/gics/members/:memberId/status
// @desc    Approuver ou rejeter un membre du GIC
// @access  Private (GIC Leader)
router.patch(
    '/members/:memberId/status',
    protect,
    isGicLeader,
    validate(['status']), // Make sure 'status' field is present in the body
    asyncHandler(manageMemberStatus)
);

export default router;