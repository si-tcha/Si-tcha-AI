// src/api/routes/weather.route.ts
import { Router } from 'express';
import { getWeatherDashboard } from '../controllers/weather.controller.js';
import { protect, requireActive } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Météo & Sol
 *   description: APIs pour la récupération des données météorologiques, du sol et des alertes associées pour les producteurs.
 */

/**
 * @swagger
 * /weather/dashboard:
 *   get:
 *     summary: Récupérer le tableau de bord météo pour le producteur
 *     description: >
 *       Retourne les dernières données météorologiques, les données du sol, et les alertes récentes
 *       pour le GIC du producteur connecté. Accessible uniquement par les utilisateurs avec le rôle 'seller'.
 *     tags: [Météo & Sol]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Données du tableau de bord récupérées avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Données du tableau de bord météo récupérées avec succès."
 *                 data:
 *                   type: object
 *                   properties:
 *                     meteo:
 *                       type: object
 *                       description: "Dernière mesure météo disponible. Peut être null si aucune donnée n'a encore été synchronisée."
 *                     sol:
 *                       type: object
 *                       description: "Dernière mesure du sol disponible. Peut être null si aucune donnée n'a encore été synchronisée."
 *                     alertes:
 *                       type: array
 *                       items:
 *                         type: object
 *                       description: "Liste des alertes météo des dernières 24 heures."
 *       401:
 *         description: Non autorisé (token manquant ou invalide).
 *       403:
 *         description: Accès refusé (l'utilisateur n'est pas un producteur approuvé).
 *       500:
 *         description: Erreur interne du serveur.
 */
// Route : GET /api/weather/dashboard
// Accès : Protégé (Nécessite un token Producteur valide et actif)
router.get('/dashboard', protect, requireActive, asyncHandler(getWeatherDashboard));

export default router;