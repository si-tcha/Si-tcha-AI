import { Router } from 'express';
import { login, registerAcheteur, registerAgriculteur, verifyAccount, logout, adminLogin } from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validation.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Authentification
 *   description: APIs pour la gestion de l'authentification des utilisateurs
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     AcheteurRegister:
 *       type: object
 *       required:
 *         - nom
 *         - nomEntreprise
 *         - nui
 *         - secteur_activite
 *         - contact
 *       properties:
 *         nom:
 *           type: string
 *           description: Nom complet de l'acheteur.
 *         nomEntreprise:
 *           type: string
 *           description: Nom de l'entreprise de l'acheteur.
 *         nui:
 *           type: string
 *           description: Numéro d'Identifiant Unique (NUI) de l'entreprise.
 *         secteur_activite:
 *           type: string
 *           description: Secteur d'activité de l'entreprise.
 *         contact:
 *           type: string
 *           description: Numéro de téléphone de l'acheteur.
 *       example:
 *         nom: "Jean Dupont"
 *         nomEntreprise: "Agro-Business SARL"
 *         nui: "M123456789"
 *         secteur_activite: "Achat de Cacao"
 *         contact: "+237699887766"
 *     AgriculteurRegister:
 *       type: object
 *       required:
 *         - nom
 *         - contact
 *         - gicId
 *       properties:
 *         nom:
 *           type: string
 *           description: Nom complet de l'agriculteur.
 *         contact:
 *           type: string
 *           description: Numéro de téléphone de l'agriculteur.
 *         gicId:
 *           type: string
 *           format: uuid
 *           description: ID du GIC auquel l'agriculteur souhaite adhérer.
 *       example:
 *         nom: "Moussa Bello"
 *         contact: "+237677665544"
 *         gicId: "c2f9e3c8-691a-4f3b-9b8e-5d7c6a4b3f2d"
 *     VerifyAccount:
 *       type: object
 *       required:
 *         - contact
 *         - code
 *       properties:
 *         contact:
 *           type: string
 *           description: Numéro de téléphone de l'utilisateur à vérifier.
 *         code:
 *           type: string
 *           description: Code de vérification à 6 chiffres reçu par SMS.
 *       example:
 *         contact: "+237699887766"
 *         code: "123456"
 *     Login:
 *       type: object
 *       required:
 *         - nom
 *         - contact
 *       properties:
 *         nom:
 *           type: string
 *           description: Nom de l'utilisateur (agriculteur ou acheteur).
 *         contact:
 *           type: string
 *           description: Numéro de téléphone de l'utilisateur.
 *       example:
 *         nom: "Jean Dupont"
 *         contact: "+237699887766"
 *     AdminLogin:
 *       type: object
 *       required:
 *         - nom
 *         - motDePasse
 *       properties:
 *         nom:
 *           type: string
 *           description: Nom d'utilisateur de l'administrateur.
 *         motDePasse:
 *           type: string
 *           format: password
 *           description: Mot de passe de l'administrateur.
 */

// @route   POST /api/auth/register/acheteur
// @desc    Enregistrer un nouvel acheteur
// @access  Public
/**
 * @swagger
 * /auth/register/acheteur:
 *   post:
 *     summary: Enregistrer un nouvel acheteur
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AcheteurRegister'
 *     responses:
 *       201:
 *         description: Compte créé. Un code de vérification a été envoyé.
 *       409:
 *         description: Un utilisateur avec ce NUI ou contact existe déjà.
 */
router.post(
    '/register/acheteur',
    validate(['nom', 'nomEntreprise', 'nui', 'secteur_activite', 'contact']),
    asyncHandler(registerAcheteur)
);

// @route   POST /api/auth/register/agriculteur
// @desc    Enregistrer un nouvel agriculteur (en attente d'approbation)
// @access  Public
/**
 * @swagger
 * /auth/register/agriculteur:
 *   post:
 *     summary: Enregistrer un nouvel agriculteur
 *     description: Le compte est créé avec le statut "EN_ATTENTE" et nécessite une approbation du leader du GIC.
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AgriculteurRegister'
 *     responses:
 *       201:
 *         description: Compte créé. Un code de vérification a été envoyé.
 *       409:
 *         description: Un agriculteur avec ce contact existe déjà.
 */
router.post(
    '/register/agriculteur',
    validate(['nom', 'contact', 'gicId']),
    asyncHandler(registerAgriculteur)
);

// @route   POST /api/auth/verify
// @desc    Vérifier un compte avec un code SMS
// @access  Public
/**
 * @swagger
 * /auth/verify:
 *   post:
 *     summary: Vérifier un compte avec un code SMS
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyAccount'
 *     responses:
 *       200:
 *         description: Compte vérifié avec succès.
 *       400:
 *         description: Code de vérification invalide.
 *       410:
 *         description: Le code de vérification a expiré.
 */
router.post(
    '/verify',
    validate(['contact', 'code']),
    asyncHandler(verifyAccount)
);

// @route   POST /api/auth/login
// @desc    Connecter un agriculteur ou un acheteur
// @access  Public
/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Connecter un agriculteur ou un acheteur
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Login'
 *     responses:
 *       200:
 *         description: Connexion réussie. Retourne un token JWT et les informations de l'utilisateur.
 *       401:
 *         description: Nom ou contact incorrect.
 *       403:
 *         description: Compte non vérifié ou en attente d'approbation.
 */
router.post(
    '/login',
    validate(['nom', 'contact']),
    asyncHandler(login)
);

// @route   POST /api/auth/admin/login
// @desc    Connecter un administrateur
// @access  Public
/**
 * @swagger
 * /auth/admin/login:
 *   post:
 *     summary: Connecter un administrateur
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminLogin'
 *     responses:
 *       200:
 *         description: Connexion admin réussie. Retourne un token JWT.
 *       401:
 *         description: Nom d'utilisateur ou mot de passe incorrect.
 */
router.post(
    '/admin/login',
    validate(['nom', 'motDePasse']),
    asyncHandler(adminLogin)
);

// @route   POST /api/auth/logout
// @desc    Déconnecter un utilisateur
// @access  Private
/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Déconnecter un utilisateur
 *     tags: [Authentification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Déconnexion réussie.
 */
router.post('/logout', protect, logout);


export default router;