import { Router } from 'express';
import {
  createAssignedParcel,
  getAssignedParcel,
  listAssignedParcels,
  streamAssignedSatelliteImage,
} from '../controllers/parcel.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

// Les opérations sont limitées au GIC de l'agriculteur authentifié; la création l'affecte aussi à la parcelle.
/**
 * @swagger
 * tags:
 *   name: Parcelles
 *   description: Données météo, culturales et satellite des parcelles de l'agriculteur connecté.
 */
/**
 * @swagger
 * /parcels:
 *   get:
 *     summary: Lister les parcelles affectées à l'agriculteur connecté
 *     tags: [Parcelles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Parcelles avec météo, sol, prévisions, cycle cultural, alertes et dernier NDVI.
 *       401:
 *         description: Non autorisé.
 *       403:
 *         description: Accès réservé aux agriculteurs.
 */
router.get('/', protect, asyncHandler(listAssignedParcels));

/**
 * @swagger
 * /parcels:
 *   post:
 *     summary: Créer une parcelle à partir des points GPS parcourus par l'agriculteur
 *     description: Le backend ferme l'anneau GeoJSON, crée le polygone AgroMonitoring, puis enregistre la parcelle et affecte son créateur.
 *     tags: [Parcelles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, points]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Parcelle B3
 *               zone:
 *                 type: string
 *                 example: Mbouda Ouest
 *               points:
 *                 type: array
 *                 minItems: 3
 *                 items:
 *                   type: object
 *                   required: [latitude, longitude]
 *                   properties:
 *                     latitude:
 *                       type: number
 *                       example: 5.4712
 *                     longitude:
 *                       type: number
 *                       example: 10.0821
 *     responses:
 *       201:
 *         description: Parcelle enregistrée.
 *       400:
 *         description: Nom ou points GPS invalides.
 *       403:
 *         description: Agriculteur non approuvé.
 *       422:
 *         description: GeoJSON refusé par AgroMonitoring.
 *       502:
 *         description: Service AgroMonitoring indisponible ou réponse invalide.
 */
router.post('/', protect, asyncHandler(createAssignedParcel));

/**
 * @swagger
 * /parcels/{parcelId}:
 *   get:
 *     summary: Obtenir le tableau de bord d'une parcelle affectée
 *     tags: [Parcelles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: parcelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Détail de la parcelle.
 *       404:
 *         description: Parcelle introuvable ou non affectée.
 */
router.get('/:parcelId', protect, asyncHandler(getAssignedParcel));

/**
 * @swagger
 * /parcels/{parcelId}/satellite/{observationId}/image:
 *   get:
 *     summary: Lire une image NDVI ou couleur d'une observation autorisée
 *     tags: [Parcelles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: parcelId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: observationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: product
 *         required: true
 *         schema:
 *           type: string
 *           enum: [ndvi, truecolor]
 *     responses:
 *       200:
 *         description: Image satellite.
 *       404:
 *         description: Parcelle, observation ou image introuvable.
 */
router.get('/:parcelId/satellite/:observationId/image', protect, asyncHandler(streamAssignedSatelliteImage));

export default router;