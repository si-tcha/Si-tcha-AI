import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { defaultOtpProvider, generateSecureOtp } from '../services/otpProvider.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UserAccount {
  id: string;
  role: 'seller' | 'buyer';
  name: string;
  phone: string;
  buyerId?: string;
  gicId?: string;
  gicRole?: 'leader' | 'member';
  status: 'active' | 'pending';
}

export interface AuthRequest extends Request {
  user?: UserAccount;
}

// ─── Config ─────────────────────────────────────────────────────────────────

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'test') {
      return 'test-jwt-secret-key-32-chars-long-12345';
    }
    throw new Error('FATAL: La variable d\'environnement JWT_SECRET n\'est pas définie. Le serveur ne peut pas démarrer en toute sécurité.');
  }
  return secret;
}
const JWT_SECRET = getJwtSecret();
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
    { id: user.id, role: user.role, phone: user.phone },
    JWT_SECRET,
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

  // Vérifier si le numéro est déjà pris
  const existing = await prisma.acheteur.findUnique({
    where: { contact: normalizedPhone },
  });
  if (existing) {
    return res.status(409).json({
      message: 'Ce numéro de téléphone est déjà associé à un compte acheteur.',
    });
  }

  // Hash du PIN et création du compte
  const pinHash = await bcrypt.hash(pin, SALT_ROUNDS);
  const acheteur = await prisma.acheteur.create({
    data: {
      nomEntreprise: companyName.trim(),
      contact: normalizedPhone,
      adresse: address?.trim() || '',
      preferencesAlertes: JSON.stringify({ productNames: [], bassins: [] }),
      pinHash,
      phoneVerified: false,
    },
  });

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

  if (process.env.NODE_ENV === 'production' && !smsResult.success) {
    return res.status(503).json({
      message: 'Le service SMS est indisponible ou non configuré en production.',
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

  // Vérifier si le numéro est déjà pris
  const existingAgri = await prisma.agriculteur.findUnique({
    where: { contact: normalizedPhone },
  });
  if (existingAgri) {
    return res.status(409).json({
      message: 'Ce numéro de téléphone est déjà associé à un compte producteur.',
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

  // Hash du PIN et création du compte
  const pinHash = await bcrypt.hash(pin, SALT_ROUNDS);
  const isFirstMember = (await prisma.agriculteur.count({ where: { gicId: gic.id } })) === 0;

  const agriculteur = await prisma.agriculteur.create({
    data: {
      nom: fullName.trim(),
      prenom: '',
      contact: normalizedPhone,
      estLeader: isFirstMember,
      pinHash,
      phoneVerified: false,
      timestampMaj: new Date(),
      gicId: gic.id,
    },
  });

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

  if (process.env.NODE_ENV === 'production' && !smsResult.success) {
    return res.status(503).json({
      message: 'Le service SMS est indisponible ou non configuré en production.',
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

export async function verifyOtp(req: Request, res: Response) {
  const { phone, code, role } = req.body;

  if (!phone || !code) {
    return res.status(400).json({ message: 'Téléphone et code OTP requis.' });
  }

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ message: 'Numéro invalide.' });
  }

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

  // Marquer comme vérifié
  let user: UserAccount | null = null;

  const acheteur = await prisma.acheteur.findUnique({ where: { contact: normalizedPhone } });
  const agriculteur = await prisma.agriculteur.findUnique({ where: { contact: normalizedPhone } });

  if (role === 'buyer' || (!role && acheteur && !agriculteur)) {
    if (acheteur) {
      await prisma.acheteur.update({
        where: { contact: normalizedPhone },
        data: { phoneVerified: true },
      });
      user = {
        id: acheteur.id.toString(),
        role: 'buyer',
        name: acheteur.nomEntreprise,
        phone: acheteur.contact,
        buyerId: acheteur.id.toString(),
        status: 'active',
      };
    }
  } else {
    if (agriculteur) {
      await prisma.agriculteur.update({
        where: { contact: normalizedPhone },
        data: { phoneVerified: true },
      });
      user = {
        id: agriculteur.id.toString(),
        role: 'seller',
        name: agriculteur.nom,
        phone: agriculteur.contact,
        gicId: agriculteur.gicId.toString(),
        gicRole: agriculteur.estLeader ? 'leader' : 'member',
        status: 'active',
      };
    }
  }

  if (!user) {
    return res.status(404).json({ message: 'Compte introuvable.' });
  }

  // Supprimer l'OTP
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

    if (!acheteur.phoneVerified) {
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

      if (process.env.NODE_ENV === 'production' && !smsResult.success) {
        return res.status(503).json({
          message: 'Le service SMS est indisponible ou non configuré en production.',
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

    if (!agriculteur.phoneVerified) {
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

      if (process.env.NODE_ENV === 'production' && !smsResult.success) {
        return res.status(503).json({
          message: 'Le service SMS est indisponible ou non configuré en production.',
          error: smsResult.error,
        });
      }

      return res.status(403).json({ message: 'Veuillez vérifier votre numéro de téléphone.', requireOtp: true });
    }

    const user: UserAccount = {
      id: agriculteur.id.toString(),
      role: 'seller',
      name: agriculteur.nom,
      phone: agriculteur.contact,
      gicId: agriculteur.gicId.toString(),
      gicRole: agriculteur.estLeader ? 'leader' : 'member',
      status: 'active',
    };

    const token = signToken(user);
    return res.json({ token, user });
  }

  // 3. Aucun compte trouvé
  return res.status(401).json({
    message: 'Aucun compte trouvé avec ce numéro. Veuillez vous inscrire.',
  });
}

// ─── Middleware Auth (JWT) ──────────────────────────────────────────────────

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

  if (!token) {
    return res.status(401).json({ message: 'Token manquant.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as unknown as {
      id: string;
      role: 'seller' | 'buyer';
      phone: string;
    };

    // Reconstruire le user depuis la base pour avoir les données à jour
    if (payload.role === 'buyer') {
      const acheteur = await prisma.acheteur.findUnique({
        where: { contact: payload.phone },
      });
      if (!acheteur) {
        return res.status(401).json({ message: 'Compte introuvable.' });
      }
      req.user = {
        id: acheteur.id.toString(),
        role: 'buyer',
        name: acheteur.nomEntreprise,
        phone: acheteur.contact,
        buyerId: acheteur.id.toString(),
        status: 'active',
      };
    } else {
      const agriculteur = await prisma.agriculteur.findUnique({
        where: { contact: payload.phone },
        include: { gic: true },
      });
      if (!agriculteur) {
        return res.status(401).json({ message: 'Compte introuvable.' });
      }
      req.user = {
        id: agriculteur.id.toString(),
        role: 'seller',
        name: agriculteur.nom,
        phone: agriculteur.contact,
        gicId: agriculteur.gicId.toString(),
        gicRole: agriculteur.estLeader ? 'leader' : 'member',
        status: 'active',
      };
    }

    next();
  } catch {
    return res.status(401).json({ message: 'Token invalide ou expiré.' });
  }
}

// ─── Me ─────────────────────────────────────────────────────────────────────

export function me(req: Request, res: Response) {
  return res.json({ user: req.user ?? null });
}
