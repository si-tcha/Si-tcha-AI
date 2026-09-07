import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { defaultOtpProvider, generateSecureOtp } from '../services/otpProvider.js';
import { AuthenticatedUser, CanonicalRole } from '../types/user.types.js';
import { getJwtSecret, protect, requireAuth, requireActive, requireRole, isAdmin, isGicLeader } from '../middlewares/auth.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export type UserAccount = AuthenticatedUser;

export interface AuthRequest extends Request {
  user?: UserAccount;
}

// ─── Config ─────────────────────────────────────────────────────────────────

const JWT_EXPIRES_IN = '30d'; // 30 jours — les fermiers ne se connectent pas tous les jours
const SALT_ROUNDS = 10;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Normalise un numéro camerounais vers le format +237XXXXXXXXX */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  // Accepter : 6XXXXXXXX (9 digits), 237XXXXXXXXX (12 digits), ou avec +
  if (digits.length === 9 && /^[62]/.test(digits)) {
    return `+237${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('237')) {
    return `+${digits}`;
  }
  return null;
}

/** Valide un code PIN (4 à 6 chiffres) */
function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

/** Génère un JWT pour un utilisateur */
function signToken(user: UserAccount): string {
  return jwt.sign(
    { id: user.id, role: user.role, phone: user.phone, nom: user.name },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// ─── Register Buyer ─────────────────────────────────────────────────────────

export async function registerBuyer(req: Request, res: Response) {
  const { companyName, phone, pin, address } = req.body as {
    companyName?: string;
    phone?: string;
    pin?: string;
    address?: string;
  };

  // Validation
  if (!companyName?.trim() || !phone?.trim() || !pin) {
    return res.status(400).json({
      message: 'Nom d\'entreprise, téléphone et code PIN sont requis.',
    });
  }

  if (!isValidPin(pin)) {
    return res.status(400).json({
      message: 'Le code PIN doit contenir entre 4 et 6 chiffres.',
    });
  }

  const normalizedPhone = normalizePhone(phone.trim());
  if (!normalizedPhone) {
    return res.status(400).json({
      message: 'Numéro de téléphone camerounais invalide.',
    });
  }

  // 0. Vérification immédiate du service SMS avant toute interaction en base
  if (defaultOtpProvider.getMode() === 'disabled') {
    return res.status(503).json({
      message: 'Le service SMS est désactivé ou non configuré.',
    });
  }

  // 1. Interdiction stricte de l'enrôlement croisé (vérifier si le contact existe chez les producteurs)
  const existingAgri = await prisma.agriculteur.findUnique({
    where: { contact: normalizedPhone },
  });
  if (existingAgri) {
    return res.status(409).json({
      message: 'Ce numéro de téléphone est déjà associé à un compte producteur.',
    });
  }

  // 2. Vérifier si le numéro est déjà pris et vérifié comme acheteur
  const existing = await prisma.acheteur.findUnique({
    where: { contact: normalizedPhone },
  });
  if (existing && (existing.phoneVerified || existing.isVerified)) {
    return res.status(409).json({
      message: 'Ce numéro de téléphone est déjà associé à un compte acheteur vérifié.',
    });
  }

  // Hash du PIN et création ou mise à jour du compte
  const pinHash = await bcrypt.hash(pin, SALT_ROUNDS);
  if (existing) {
    await prisma.acheteur.update({
      where: { id: existing.id },
      data: {
        nomEntreprise: companyName.trim(),
        adresse: address?.trim() || '',
        pinHash,
        pin: pinHash,
        phoneVerified: false,
        isVerified: false,
      },
    });
  } else {
    await prisma.acheteur.create({
      data: {
        nomEntreprise: companyName.trim(),
        contact: normalizedPhone,
        adresse: address?.trim() || '',
        preferencesAlertes: JSON.stringify({ productNames: [], bassins: [] }),
        pinHash,
        pin: pinHash,
        phoneVerified: false,
        isVerified: false,
      },
    });
  }

  // Génération OTP cryptographiquement sécurisée
  const otpCode = generateSecureOtp(6);
  await prisma.otpCode.upsert({
    where: { phone: normalizedPhone },
    update: { code: otpCode, expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
    create: { phone: normalizedPhone, code: otpCode, expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
  });

  const smsResult = await defaultOtpProvider.sendSms(
    normalizedPhone,
    `Votre code de vérification SI-TCHA AI est : ${otpCode}. Il expire dans 15 minutes.`
  );

  if (!smsResult.success) {
    return res.status(503).json({
      message: 'Le service SMS est indisponible ou a échoué.',
      error: smsResult.error,
    });
  }

  return res.status(201).json({
    message: 'Compte créé avec succès. Veuillez vérifier votre numéro.',
    requireOtp: true,
    phone: normalizedPhone
  });
}

// ─── Register Seller ────────────────────────────────────────────────────────

export async function registerSeller(req: Request, res: Response) {
  const { fullName, phone, pin, gicName } = req.body as {
    fullName?: string;
    phone?: string;
    pin?: string;
    gicName?: string;
  };

  // Validation
  if (!fullName?.trim() || !phone?.trim() || !pin || !gicName?.trim()) {
    return res.status(400).json({
      message: 'Nom complet, téléphone, code PIN et nom du GIC sont requis.',
    });
  }

  if (!isValidPin(pin)) {
    return res.status(400).json({
      message: 'Le code PIN doit contenir entre 4 et 6 chiffres.',
    });
  }

  const normalizedPhone = normalizePhone(phone.trim());
  if (!normalizedPhone) {
    return res.status(400).json({
      message: 'Numéro de téléphone camerounais invalide.',
    });
  }

  // 0. Vérification immédiate du service SMS avant toute interaction en base
  if (defaultOtpProvider.getMode() === 'disabled') {
    return res.status(503).json({
      message: 'Le service SMS est désactivé ou non configuré.',
    });
  }

  // 1. Interdiction stricte de l'enrôlement croisé (vérifier si le contact existe chez les acheteurs)
  const existingBuyer = await prisma.acheteur.findUnique({
    where: { contact: normalizedPhone },
  });
  if (existingBuyer) {
    return res.status(409).json({
      message: 'Ce numéro de téléphone est déjà associé à un compte acheteur.',
    });
  }

  // 2. Vérifier si le numéro est déjà pris et vérifié comme producteur
  const existingAgri = await prisma.agriculteur.findUnique({
    where: { contact: normalizedPhone },
  });
  if (existingAgri && (existingAgri.phoneVerified || existingAgri.isVerified)) {
    return res.status(409).json({
      message: 'Ce numéro de téléphone est déjà associé à un compte producteur vérifié.',
    });
  }

  // Trouver ou créer le GIC
  let gic = await prisma.gIC.findFirst({
    where: { nom: gicName.trim() },
  });

  if (!gic) {
    const defaultBassin = await prisma.bassinProduction.findFirst();
    if (!defaultBassin) {
      return res.status(500).json({
        message: 'Aucun bassin de production configuré dans la base.',
      });
    }
    gic = await prisma.gIC.create({
      data: {
        nom: gicName.trim(),
        identifiantREF: `GIC-${Date.now().toString(36).toUpperCase()}`,
        logoURL: '',
        reglementInterieur: '',
        activitesPrincipales: '',
        statutLegalisation: 'En cours',
        timestampMaj: new Date(),
        bassinProductionId: defaultBassin.id,
      },
    });
  }

  // Hash du PIN et création ou mise à jour du compte
  const pinHash = await bcrypt.hash(pin, SALT_ROUNDS);
  if (existingAgri) {
    await prisma.agriculteur.update({
      where: { id: existingAgri.id },
      data: {
        nom: fullName.trim(),
        pinHash,
        pin: pinHash,
        phoneVerified: false,
        isVerified: false,
        gicId: gic.id,
        timestampMaj: new Date(),
      },
    });
  } else {
    const isFirstMember = (await prisma.agriculteur.count({ where: { gicId: gic.id } })) === 0;
    await prisma.agriculteur.create({
      data: {
        nom: fullName.trim(),
        prenom: '',
        contact: normalizedPhone,
        estLeader: isFirstMember,
        pinHash,
        pin: pinHash,
        phoneVerified: false,
        isVerified: false,
        timestampMaj: new Date(),
        gicId: gic.id,
      },
    });
  }

  // Génération OTP cryptographiquement sécurisée
  const otpCode = generateSecureOtp(6);
  await prisma.otpCode.upsert({
    where: { phone: normalizedPhone },
    update: { code: otpCode, expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
    create: { phone: normalizedPhone, code: otpCode, expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
  });

  const smsResult = await defaultOtpProvider.sendSms(
    normalizedPhone,
    `Votre code de vérification SI-TCHA AI est : ${otpCode}. Il expire dans 15 minutes.`
  );

  if (!smsResult.success) {
    return res.status(503).json({
      message: 'Le service SMS est indisponible ou a échoué.',
      error: smsResult.error,
    });
  }

  return res.status(201).json({
    message: 'Compte créé avec succès. Veuillez vérifier votre numéro.',
    requireOtp: true,
    phone: normalizedPhone
  });
}

// ─── Verify OTP ─────────────────────────────────────────────────────────────

export async function resendOtp(req: Request, res: Response) {
  const { phone, role } = req.body;
  const canonicalPhone = normalizePhone(phone.trim()) || phone.trim();

  const [buyerMatch, sellerMatch] = await Promise.all([
    prisma.acheteur.findUnique({
      where: { contact: canonicalPhone },
      select: { id: true, isVerified: true, phoneVerified: true },
    }),
    prisma.agriculteur.findUnique({
      where: { contact: canonicalPhone },
      select: { id: true, isVerified: true, phoneVerified: true },
    }),
  ]);

  if (buyerMatch && sellerMatch) {
    return res.status(409).json({
      message:
        "Conflit d'identité : ce numéro est associé à plusieurs types de comptes. Contactez le support.",
    });
  }

  const targetAccount = role === 'buyer' ? buyerMatch : sellerMatch;
  if (!targetAccount) {
    return res.status(404).json({
      message: `Compte ${role === 'buyer' ? 'acheteur' : 'vendeur'} introuvable pour ce numéro.`,
    });
  }

  const isAlreadyVerified = Boolean(
    targetAccount.phoneVerified || targetAccount.isVerified
  );
  if (isAlreadyVerified) {
    return res.status(400).json({
      message: 'Ce compte est déjà vérifié. Veuillez vous connecter directement.',
    });
  }

  if (process.env.OTP_PROVIDER === 'disabled') {
    return res.status(503).json({
      message: 'Le service SMS est désactivé. Veuillez contacter le support.',
    });
  }

  const code = generateSecureOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const smsResult = await defaultOtpProvider.sendSms(
    canonicalPhone,
    `Votre nouveau code de confirmation SI-TCHA est : ${code}. Valide pendant 10 minutes.`
  );

  if (!smsResult.success) {
    return res.status(503).json({
      message: 'Le service SMS est indisponible. Veuillez réessayer plus tard.',
    });
  }

  await prisma.otpCode.upsert({
    where: { phone: canonicalPhone },
    create: {
      phone: canonicalPhone,
      code,
      expiresAt,
    },
    update: {
      code,
      expiresAt,
    },
  });

  return res.status(200).json({
    message: 'Un nouveau code de vérification a été envoyé par SMS.',
    requireOtp: true,
    phone: canonicalPhone,
  });
}

export async function verifyOtp(req: Request, res: Response) {
  const { phone, code, role } = req.body;

  if (!role || (role !== 'buyer' && role !== 'seller')) {
    return res.status(400).json({ message: "Rôle requis ('buyer' ou 'seller')." });
  }

  if (!phone || !code) {
    return res.status(400).json({ message: 'Téléphone et code OTP requis.' });
  }

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ message: 'Numéro invalide.' });
  }

  // 1. Vérification d'ambiguïté des comptes avant validation du code et avant toute mise à jour
  const [existingBuyer, existingSeller] = await Promise.all([
    prisma.acheteur.findUnique({ where: { contact: normalizedPhone } }),
    prisma.agriculteur.findUnique({ where: { contact: normalizedPhone } }),
  ]);

  // Si les deux comptes existent sous ce numéro, refuser pour collision d'identité (409 Conflict)
  if (existingBuyer && existingSeller) {
    return res.status(409).json({
      message: "Conflit d'identité: ce numéro est associé à la fois à un compte acheteur et producteur. Action bloquée.",
    });
  }

  // Si le rôle demandé ne correspond à aucun compte existant pour ce numéro, refuser avec 404
  if (role === 'buyer' && !existingBuyer) {
    return res.status(404).json({ message: 'Compte acheteur introuvable.' });
  }

  if (role === 'seller' && !existingSeller) {
    return res.status(404).json({ message: 'Compte producteur introuvable.' });
  }

  // 2. Vérification du code OTP
  const otpRecord = await prisma.otpCode.findUnique({
    where: { phone: normalizedPhone },
  });

  if (!otpRecord) {
    return res.status(400).json({ message: 'Aucun code OTP trouvé pour ce numéro.' });
  }

  if (otpRecord.code !== code) {
    return res.status(400).json({ message: 'Code OTP incorrect.' });
  }

  if (new Date() > otpRecord.expiresAt) {
    return res.status(400).json({ message: 'Le code OTP a expiré.' });
  }

  // 3. Marquer comme vérifié le compte unique correspondant
  let user: UserAccount | null = null;

  if (role === 'buyer') {
    await prisma.acheteur.update({
      where: { contact: normalizedPhone },
      data: { phoneVerified: true, isVerified: true },
    });
    user = {
      id: existingBuyer!.id.toString(),
      role: 'buyer',
      name: existingBuyer!.nomEntreprise,
      phone: existingBuyer!.contact,
      buyerId: existingBuyer!.id.toString(),
      phoneVerified: true,
      status: 'active',
    };
  } else if (role === 'seller') {
    await prisma.agriculteur.update({
      where: { contact: normalizedPhone },
      data: { phoneVerified: true, isVerified: true },
    });
    const status = existingSeller!.statut === 'APPROUVE' ? 'active' : (existingSeller!.statut === 'REJETE' ? 'rejected' : 'pending');
    user = {
      id: existingSeller!.id.toString(),
      role: 'seller',
      name: existingSeller!.nom,
      phone: existingSeller!.contact,
      gicId: existingSeller!.gicId.toString(),
      estLeader: existingSeller!.estLeader,
      gicRole: existingSeller!.estLeader ? 'leader' : 'member',
      statut: existingSeller!.statut,
      phoneVerified: true,
      status,
    };
  }

  if (!user) {
    return res.status(404).json({ message: 'Compte introuvable.' });
  }

  // 4. Supprimer l'OTP
  await prisma.otpCode.delete({ where: { phone: normalizedPhone } });

  const token = signToken(user);
  return res.json({ message: 'Vérification réussie.', token, user });
}

// ─── Login ──────────────────────────────────────────────────────────────────
// Auto-détecte le rôle : cherche d'abord dans Acheteur, puis Agriculteur.
// Plus besoin de passer "role" depuis le frontend.

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Connecte un utilisateur
 *     description: Authentifie un utilisateur avec son numéro de téléphone et son code PIN. Le rôle est détecté automatiquement.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - pin
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "+237699112233"
 *               pin:
 *                 type: string
 *                 example: "1234"
 *     responses:
 *       200:
 *         description: Connexion réussie
 *       400:
 *         description: Requête invalide (numéro ou PIN manquant)
 *       401:
 *         description: Numéro ou PIN incorrect
 */
export async function login(req: Request, res: Response) {
  const { phone, pin, role } = req.body as {
    phone?: string;
    pin?: string;
    role?: 'buyer' | 'seller';
  };

  if (!phone?.trim() || !pin) {
    return res.status(400).json({
      message: 'Numéro de téléphone et code PIN sont requis.',
    });
  }

  const normalizedPhone = normalizePhone(phone.trim());
  if (!normalizedPhone) {
    return res.status(400).json({
      message: 'Numéro de téléphone camerounais invalide.',
    });
  }

  // 1. Chercher dans Acheteur si rôle buyer demandé (ou par défaut)
  const acheteur = await prisma.acheteur.findUnique({
    where: { contact: normalizedPhone },
  });

  // 2. Chercher dans Agriculteur si rôle seller demandé (ou par défaut si non trouvé en acheteur)
  const agriculteur = await prisma.agriculteur.findUnique({
    where: { contact: normalizedPhone },
    include: { gic: true },
  });

  const isBuyerLogin = role === 'buyer' || (!role && acheteur && !agriculteur);
  if (acheteur && acheteur.pinHash && isBuyerLogin) {
    const pinValid = await bcrypt.compare(pin, acheteur.pinHash);
    if (!pinValid) {
      return res.status(401).json({ message: 'Numéro ou code PIN incorrect.' });
    }

    const isPhoneVerified = Boolean(acheteur.phoneVerified || acheteur.isVerified);
    if (!isPhoneVerified) {
      if (defaultOtpProvider.getMode() === 'disabled') {
        return res.status(503).json({
          message: 'Le service SMS est désactivé ou non configuré.',
        });
      }

      const otpCode = generateSecureOtp(6);
      await prisma.otpCode.upsert({
        where: { phone: normalizedPhone },
        update: { code: otpCode, expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
        create: { phone: normalizedPhone, code: otpCode, expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
      });

      const smsResult = await defaultOtpProvider.sendSms(
        normalizedPhone,
        `Votre code de vérification SI-TCHA AI est : ${otpCode}. Il expire dans 15 minutes.`
      );

      if (!smsResult.success) {
        return res.status(503).json({
          message: 'Le service SMS est indisponible ou a échoué.',
          error: smsResult.error,
        });
      }

      return res.status(403).json({ message: 'Veuillez vérifier votre numéro de téléphone.', requireOtp: true });
    }

    const user: UserAccount = {
      id: acheteur.id.toString(),
      role: 'buyer',
      name: acheteur.nomEntreprise,
      phone: acheteur.contact,
      buyerId: acheteur.id.toString(),
      phoneVerified: true,
      status: 'active',
    };

    const token = signToken(user);
    return res.json({ token, user });
  }

  const isSellerLogin = role === 'seller' || (!role && agriculteur && !acheteur);
  if (agriculteur && agriculteur.pinHash && isSellerLogin) {
    const pinValid = await bcrypt.compare(pin, agriculteur.pinHash);
    if (!pinValid) {
      return res.status(401).json({ message: 'Numéro ou code PIN incorrect.' });
    }

    const isPhoneVerified = Boolean(agriculteur.phoneVerified || agriculteur.isVerified);
    if (!isPhoneVerified) {
      if (defaultOtpProvider.getMode() === 'disabled') {
        return res.status(503).json({
          message: 'Le service SMS est désactivé ou non configuré.',
        });
      }

      const otpCode = generateSecureOtp(6);
      await prisma.otpCode.upsert({
        where: { phone: normalizedPhone },
        update: { code: otpCode, expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
        create: { phone: normalizedPhone, code: otpCode, expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
      });

      const smsResult = await defaultOtpProvider.sendSms(
        normalizedPhone,
        `Votre code de vérification SI-TCHA AI est : ${otpCode}. Il expire dans 15 minutes.`
      );

      if (!smsResult.success) {
        return res.status(503).json({
          message: 'Le service SMS est indisponible ou a échoué.',
          error: smsResult.error,
        });
      }

      return res.status(403).json({ message: 'Veuillez vérifier votre numéro de téléphone.', requireOtp: true });
    }

    const status = agriculteur.statut === 'APPROUVE' ? 'active' : (agriculteur.statut === 'REJETE' ? 'rejected' : 'pending');
    const user: UserAccount = {
      id: agriculteur.id.toString(),
      role: 'seller',
      name: agriculteur.nom,
      phone: agriculteur.contact,
      gicId: agriculteur.gicId.toString(),
      estLeader: agriculteur.estLeader,
      gicRole: agriculteur.estLeader ? 'leader' : 'member',
      statut: agriculteur.statut,
      phoneVerified: true,
      status,
    };

    const token = signToken(user);
    return res.json({ token, user });
  }

  // 3. Aucun compte trouvé
  return res.status(401).json({
    message: 'Aucun compte trouvé avec ce numéro. Veuillez vous inscrire.',
  });
}

// ─── Admin Login ────────────────────────────────────────────────────────────

export async function adminLogin(req: Request, res: Response) {
  const { nom, motDePasse, username, password } = req.body as {
    nom?: string;
    motDePasse?: string;
    username?: string;
    password?: string;
  };

  const adminName = (nom || username)?.trim();
  const adminPassword = motDePasse || password;

  if (!adminName || !adminPassword) {
    return res.status(400).json({
      message: "Nom d'administrateur et mot de passe requis.",
    });
  }

  const admin = await prisma.admin.findFirst({
    where: {
      OR: [
        { nom: adminName },
        { contact: adminName },
      ],
    },
  });

  if (!admin) {
    return res.status(401).json({
      message: 'Identifiants administrateur incorrects.',
    });
  }

  const isMatch = await bcrypt.compare(adminPassword, admin.password);
  if (!isMatch) {
    return res.status(401).json({
      message: 'Identifiants administrateur incorrects.',
    });
  }

  const user: UserAccount = {
    id: admin.id,
    role: 'admin',
    name: admin.nom,
    phone: admin.contact,
    phoneVerified: true,
    status: 'active',
  };

  const token = signToken(user);
  return res.json({
    message: 'Connexion administrateur réussie.',
    token,
    user,
  });
}

// ─── Logout ─────────────────────────────────────────────────────────────────

export function logout(req: Request, res: Response) {
  return res.status(200).json({ message: 'Déconnexion réussie.' });
}

// ─── Me ─────────────────────────────────────────────────────────────────────

export function me(req: Request, res: Response) {
  return res.json({ user: req.user ?? null });
}

// ─── Re-exported Auth Middlewares ───────────────────────────────────────────

export { protect, requireAuth, requireActive, requireRole, isAdmin, isGicLeader };
