import { Router } from 'express';
import { createBuyerOrder, getOrderOffers } from '../controllers/order.controller.js';
import { isBuyer, protect } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Commandes de produits agricoles par un acheteur authentifié.
 */

/**
 * @swagger
 * /orders/offers:
 *   get:
 *     summary: Lister les offres achetables
 *     description: Retourne les offres avec stock positif et prix configuré. Nécessite un acheteur authentifié.
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Offres disponibles avec leur identifiant, prix et quantité.
 *       401:
 *         description: Jeton absent, invalide ou expiré.
 *       403:
 *         description: Accès réservé aux acheteurs.
 */
router.get('/offers', protect, isBuyer, getOrderOffers);

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Créer une commande à partir d’une offre de récolte
 *     description: Le prix unitaire et le GIC sont lus depuis la base. La quantité disponible est vérifiée mais n’est pas réservée. La réponse contient l’identifiant à fournir ensuite à POST /payments. L’en-tête Idempotency-Key est facultatif et propre à Si-Tcha.
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: false
 *         description: Optionnel. Clé Si-Tcha pour retrouver la même commande lors d’un nouvel envoi identique.
 *         schema:
 *           type: string
 *           maxLength: 128
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [recolteOffreId, quantity]
 *             properties:
 *               recolteOffreId:
 *                 type: string
 *                 format: uuid
 *                 description: Identifiant de l’offre de récolte, et non l’identifiant du produit catalogue.
 *               quantity:
 *                 type: number
 *                 format: double
 *                 minimum: 0
 *                 exclusiveMinimum: true
 *                 description: Quantité demandée dans l’unité du produit, au maximum deux décimales.
 *     responses:
 *       201:
 *         description: Commande créée. Utiliser order.id comme resourceId pour POST /payments.
 *       200:
 *         description: Commande créée ou commande existante retournée si la clé optionnelle a déjà été utilisée.
 *       400:
 *         description: Corps invalide ou clé optionnelle invalide.
 *       401:
 *         description: Jeton absent, invalide ou expiré.
 *       403:
 *         description: Compte acheteur vérifié requis.
 *       404:
 *         description: Offre de récolte introuvable.
 *       409:
 *         description: Stock insuffisant, prix non configuré ou conflit de clé.
 *       422:
 *         description: Montant incompatible avec une collecte XAF entière.
 */
router.post('/', protect, isBuyer, createBuyerOrder);

export default router;
