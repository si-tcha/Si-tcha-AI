import { Router } from 'express';
import { listGics, listPendingMembers, manageMemberStatus } from '../controllers/gic.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { isGicLeader, protect } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: GIC
 *   description: APIs pour la gestion des GICs et de leurs membres
 */

// @route   GET /api/gics
// @desc    Lister tous les GICs pour l'enregistrement d'un agriculteur
// @access  Public
/**
 * @swagger
 * /gics:
 *   get:
 *     summary: Lister tous les GICs
 *     description: Retourne une liste simplifiée de tous les GICs (ID et nom), utile pour les formulaires d'inscription.
 *     tags: [GIC]
 *     responses:
 *       200:
 *         description: Une liste de GICs.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                   nom:
 *                     type: string
 *                 example:
 *                   - id: "c2f9e3c8-691a-4f3b-9b8e-5d7c6a4b3f2d"
 *                     nom: "GIC des Testeurs"
 */
router.get('/', asyncHandler(listGics));

// @route   GET /api/gics/members/pending
// @desc    Lister les membres en attente de validation pour le GIC du leader connecté
// @access  Private (GIC Leader)
/**
 * @swagger
 * /gics/members/pending:
 *   get:
 *     summary: Lister les membres en attente de validation
 *     description: Accessible uniquement par un leader de GIC. Retourne la liste des agriculteurs de son GIC qui ont le statut "EN_ATTENTE".
 *     tags: [GIC]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Une liste de membres en attente.
 *       401:
 *         description: Non autorisé (token manquant ou invalide).
 *       403:
 *         description: Accès refusé (l'utilisateur n'est pas un leader de GIC).
 */
router.get(
    '/members/pending',
    protect,
    isGicLeader,
    asyncHandler(listPendingMembers)
);

// @route   PATCH /api/gics/members/:memberId/status
// @desc    Approuver ou rejeter un membre du GIC
// @access  Private (GIC Leader)
/**
 * @swagger
 * /gics/members/{memberId}/status:
 *   patch:
 *     summary: Approuver ou rejeter un membre
 *     description: Accessible uniquement par un leader de GIC pour gérer les demandes d'adhésion.
 *     tags: [GIC]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: memberId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: ID de l'agriculteur à approuver ou rejeter.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [APPROUVE, REJETE]
 *                 description: Le nouveau statut du membre.
 *     responses:
 *       200:
 *         description: Statut du membre mis à jour avec succès.
 */
router.patch(
    '/members/:memberId/status',
    protect,
    isGicLeader,
    validate(['status']), // Make sure 'status' field is present in the body
    asyncHandler(manageMemberStatus)
);

export default router;