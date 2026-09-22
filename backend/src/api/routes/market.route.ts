// src/api/routes/market.route.ts
import { Router } from 'express';
import { getMarketDashboard, getDonneesMarche } from '../controllers/donneeMarche.controller.js';
import { protect, requireActive, requireRole } from '../middlewares/auth.middleware.js';
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
 *       selon le rôle canonique de l'utilisateur (seller, buyer ou admin).
 *     tags: [Marché]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Données du tableau de bord récupérées avec succès.
 *       401:
 *         description: Non autorisé (token manquant ou invalide).
 *       403:
 *         description: Compte inactif ou non vérifié.
 *       500:
 *         description: Erreur interne du serveur.
 */
router.get('/dashboard', protect, requireActive, requireRole('seller', 'buyer', 'admin'), asyncHandler(getMarketDashboard));

/**
 * @swagger
 * /market:
 *   get:
 *     summary: Lister toutes les données de marché brutes
 *     description: Retourne une liste de toutes les entrées de données de marché, triées par date. Accessible aux utilisateurs connectés et actifs.
 *     tags: [Marché]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Une liste de données de marché.
 *       401:
 *         description: Non autorisé.
 *       403:
 *         description: Compte inactif ou non vérifié.
 */
router.get('/', protect, requireActive, requireRole('seller', 'buyer', 'admin'), asyncHandler(getDonneesMarche));

export default router;