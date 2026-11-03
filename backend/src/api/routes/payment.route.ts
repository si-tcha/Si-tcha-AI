import { Router } from 'express';
import {
  confirmPaymentWithOtp,
  findPaymentForResource,
  getPaymentStatus,
  initiatePayment,
  listMethods,
  requestPaymentOtp,
} from '../controllers/payment.controller.js';
import { isBuyer, protect } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Paiements entrants AfribaPay sandbox, réservés aux acheteurs authentifiés.
 */

/**
 * @swagger
 * /payments/methods:
 *   get:
 *     summary: Lister les moyens de paiement disponibles au Cameroun
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: countryCode
 *         required: false
 *         description: Code pays ISO 3166-1 alpha-2. Les paiements actuellement activés sont limités au Cameroun.
 *         schema:
 *           type: string
 *           pattern: '^[A-Za-z]{2}$'
 *           example: CM
 *     responses:
 *       200:
 *         description: Pays, devise et opérateurs disponibles.
 *       401:
 *         description: Jeton absent, invalide ou expiré.
 *       403:
 *         description: Compte acheteur requis.
 *       503:
 *         description: Intégration sandbox désactivée ou non configurée.
 */
router.get('/methods', protect, isBuyer, listMethods);

/**
 * @swagger
 * /payments:
 *   get:
 *     summary: Reprendre le dernier paiement d’une commande ou d’un préfinancement
 *     description: Permet de retrouver une opération après fermeture ou interruption de l’application.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: resourceType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [ORDER, PREFINANCEMENT]
 *       - in: query
 *         name: resourceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paiement le plus récent appartenant à l’acheteur, ou null.
 *       401:
 *         description: Jeton absent, invalide ou expiré.
 *       403:
 *         description: Compte acheteur requis.
 */
router.get('/', protect, isBuyer, findPaymentForResource);

/**
 * @swagger
 * /payments:
 *   post:
 *     summary: Créer un paiement entrant pour une commande ou un préfinancement existant
 *     description: Le montant et la devise sont calculés côté serveur. Les paramètres de paiement ne sont jamais acceptés du client. AfribaPay identifie le payin avec order_id et reference_id; le backend réutilise un paiement actif du même dossier pour éviter un second lancement.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [resourceType, resourceId, countryCode, operator, phoneNumber]
 *             properties:
 *               resourceType:
 *                 type: string
 *                 enum: [ORDER, PREFINANCEMENT]
 *               resourceId:
 *                 type: string
 *               countryCode:
 *                 type: string
 *                 example: CM
 *               operator:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *                 description: Numéro à débiter; le PIN Mobile Money n’est jamais demandé.
 *     responses:
 *       202:
 *         description: Paiement lancé en sandbox et en attente de confirmation du statut.
 *       200:
 *         description: Paiement déjà associé à ce dossier, retourné sans lancer un nouveau payin.
 *       400:
 *         description: Demande invalide ou opérateur non disponible.
 *       403:
 *         description: Compte acheteur non vérifié ou accès refusé.
 *       404:
 *         description: Commande ou préfinancement absent ou appartenant à un autre compte.
 *       409:
 *         description: Un paiement existant empêche un nouvel essai. Vérifier son statut avant de poursuivre.
 */
router.post('/', protect, isBuyer, initiatePayment);

/**
 * @swagger
 * /payments/otp:
 *   post:
 *     summary: Demander un code OTP pour un opérateur qui l’exige
 *     description: Le montant est calculé côté serveur; seul le statut AWAITING_OTP est créé, sans paiement.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [resourceType, resourceId, countryCode, operator, phoneNumber]
 *             properties:
 *               resourceType:
 *                 type: string
 *                 enum: [ORDER, PREFINANCEMENT]
 *               resourceId:
 *                 type: string
 *               countryCode:
 *                 type: string
 *               operator:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *     responses:
 *       202:
 *         description: Code demandé; aucun débit n’a encore été lancé.
 *       400:
 *         description: L’opérateur n’exige pas l’OTP ou les données sont invalides.
 *       401:
 *         description: Jeton absent, invalide ou expiré.
 */
router.post('/otp', protect, isBuyer, requestPaymentOtp);

/**
 * @swagger
 * /payments/{paymentId}/confirm:
 *   post:
 *     summary: Confirmer un paiement en attente d’OTP
 *     description: Le code OTP est utilisé uniquement pour cette requête; il n’est jamais stocké ni journalisé.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phoneNumber, otpCode]
 *             properties:
 *               phoneNumber:
 *                 type: string
 *               otpCode:
 *                 type: string
 *     responses:
 *       202:
 *         description: Paiement lancé et en attente de confirmation AfribaPay.
 *       400:
 *         description: Numéro ou code OTP invalide.
 *       401:
 *         description: Jeton absent, invalide ou expiré.
 *       404:
 *         description: Paiement absent ou appartenant à un autre compte.
 *       409:
 *         description: Paiement n’attendant pas d’OTP ou confirmation déjà lancée.
 */
router.post('/:paymentId/confirm', protect, isBuyer, confirmPaymentWithOtp);

/**
 * @swagger
 * /payments/{paymentId}/status:
 *   get:
 *     summary: Vérifier le statut AfribaPay d’un paiement
 *     description: Un statut fournisseur indisponible renvoie UNKNOWN; il ne transforme pas le paiement en échec.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paiement et statut actuel (AWAITING_OTP, PENDING, SUCCESS, FAILED ou UNKNOWN).
 *       401:
 *         description: Jeton absent, invalide ou expiré.
 *       403:
 *         description: Compte acheteur requis.
 *       404:
 *         description: Paiement absent ou appartenant à un autre compte.
 */
router.get('/:paymentId/status', protect, isBuyer, getPaymentStatus);

export default router;
