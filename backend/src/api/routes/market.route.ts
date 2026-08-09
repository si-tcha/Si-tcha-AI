// src/api/routes/market.route.ts
import { Router } from 'express';
import { getMarketDashboard, getDonneesMarche } from '../controllers/donneeMarche.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Marché
 *   description: APIs pour la consultation des données du marché agricole
 */

/**
 * @swagger
 * /market/dashboard:
 *   get:
 *     summary: Récupérer le tableau de bord du marché avec tendances et conseils
 *     description: >
 *       Retourne les dernières données de marché pour chaque produit/bassin,
 *       enrichies d'une tendance (hausse, baisse, stable) et d'un conseil personnalisé
 *       selon le rôle de l'utilisateur (Agriculteur ou Acheteur).
 *     tags: [Marché]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Données du tableau de bord récupérées avec succès.
 *       401:
 *         description: Non autorisé (token manquant ou invalide).
 *       500:
 *         description: Erreur interne du serveur.
 */
router.get('/dashboard', protect, asyncHandler(getMarketDashboard));

/**
 * @swagger
 * /market:
 *   get:
 *     summary: Lister toutes les données de marché brutes
 *     description: Retourne une liste de toutes les entrées de données de marché, triées par date. Accessible aux utilisateurs connectés.
 *     tags: [Marché]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Une liste de données de marché.
 *       401:
 *         description: Non autorisé.
 */
router.get('/', protect, asyncHandler(getDonneesMarche));


export default router;