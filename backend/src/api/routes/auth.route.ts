import { Router } from 'express';
import { login, registerAcheteur, registerAgriculteur, verifyAccount, logout } from '../controllers/auth.controller';
import { validate } from '../middlewares/validation.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

// @route   POST /api/auth/register/acheteur
// @desc    Enregistrer un nouvel acheteur
// @access  Public
router.post(
    '/register/acheteur',
    validate(['nom', 'nomEntreprise', 'nui', 'secteur_activite', 'contact']),
    asyncHandler(registerAcheteur)
);

// @route   POST /api/auth/register/agriculteur
// @desc    Enregistrer un nouvel agriculteur (en attente d'approbation)
// @access  Public
router.post(
    '/register/agriculteur',
    validate(['nom', 'contact', 'gicId']),
    asyncHandler(registerAgriculteur)
);

// @route   POST /api/auth/verify
// @desc    Vérifier un compte avec un code SMS
// @access  Public
router.post(
    '/verify',
    validate(['contact', 'code']),
    asyncHandler(verifyAccount)
);

// @route   POST /api/auth/login
// @desc    Connecter un agriculteur ou un acheteur
// @access  Public
router.post(
    '/login',
    validate(['nom', 'contact']),
    asyncHandler(login)
);

// @route   POST /api/auth/logout
// @desc    Déconnecter un utilisateur
// @access  Private
router.post('/logout', protect, logout);


export default router;