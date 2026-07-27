import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { protect, isAdmin } from '../middlewares/auth.middleware.js';
import { createGic, listGicsWithStats } from '../controllers/admin.controller.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Administration
 *   description: APIs réservées aux administrateurs pour la gestion de la plateforme
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     GicCreation:
 *       type: object
 *       properties:
 *         nom:
 *           type: string
 *         identifiantREF:
 *           type: string
 *         bassinProductionId:
 *           type: string
 *           format: uuid
 *         activitesPrincipales:
 *           type: string
 *         statutLegalisation:
 *           type: string
 *         logoURL:
 *           type: string
 *           format: uri
 *     LeaderCreation:
 *       type: object
 *       properties:
 *         nom:
 *           type: string
 *         contact:
 *           type: string
 *     CreateGicPayload:
 *       type: object
 *       properties:
 *         gicData:
 *           $ref: '#/components/schemas/GicCreation'
 *         leaderData:
 *           $ref: '#/components/schemas/LeaderCreation'
 */

// Toutes les routes dans ce fichier sont protégées et nécessitent le rôle ADMIN
router.use(protect, isAdmin);

// @route   POST /api/admin/gics
// @desc    Créer un nouveau GIC et son leader
// @access  Private (Admin)
/**
 * @swagger
 * /admin/gics:
 *   post:
 *     summary: Créer un nouveau GIC et son leader
 *     description: Crée un GIC et un agriculteur qui sera désigné comme leader de ce GIC. Accessible uniquement par les administrateurs.
 *     tags: [Administration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateGicPayload'
 *     responses:
 *       201:
 *         description: GIC et son leader créés avec succès.
 *       401:
 *         description: Non autorisé (token manquant ou invalide).
 *       403:
 *         description: Accès refusé (l'utilisateur n'est pas un admin).
 */
router.post(
    '/gics',
    asyncHandler(createGic)
);

// @route   GET /api/admin/gics
// @desc    Lister tous les GICs avec les statistiques de leurs membres
// @access  Private (Admin)
/**
 * @swagger
 * /admin/gics:
 *   get:
 *     summary: Lister tous les GICs et les statistiques de leurs membres
 *     description: Retourne une liste complète de tous les GICs avec le décompte de leurs membres (approuvés, en attente, rejetés). Accessible uniquement par les administrateurs.
 *     tags: [Administration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Une liste de GICs avec les statistiques des membres.
 *       401:
 *         description: Non autorisé (token manquant ou invalide).
 *       403:
 *         description: Accès refusé (l'utilisateur n'est pas un admin).
 */
router.get('/gics', asyncHandler(listGicsWithStats));

export default router;