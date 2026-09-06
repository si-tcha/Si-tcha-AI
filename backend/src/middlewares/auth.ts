import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { AuthenticatedUser } from '../types/user.types.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error("FATAL: La variable d'environnement JWT_SECRET n'est pas définie. Le serveur ne peut pas démarrer en toute sécurité.");
    }
    return 'dev-jwt-secret-placeholder-minimum-32-chars-key';
  }
  return secret;
}

/**
 * Middleware centralisé d'authentification par JWT.
 * Valide le format Bearer, décode le token via getJwtSecret(), normalise les rôles
 * et vérifie l'existence et l'état de l'utilisateur directement en base de données.
 */
export const protect = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  let token: string | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  if (!token) {
    throw Object.assign(new Error('Non autorisé, aucun token fourni'), { statusCode: 401 });
  }

  let decoded: { id: string; role?: string; phone?: string; nom?: string };
  try {
    decoded = jwt.verify(token, getJwtSecret()) as any;
  } catch {
    throw Object.assign(new Error('Non autorisé, token invalide ou expiré'), { statusCode: 401 });
  }

  if (!decoded || !decoded.id) {
    throw Object.assign(new Error('Non autorisé, token invalide'), { statusCode: 401 });
  }

  // Normalisation des rôles vers les rôles canoniques minuscules
  let role = (decoded.role || '').toLowerCase();
  if (role === 'acheteur') role = 'buyer';
  if (role === 'agriculteur') role = 'seller';

  let userPayload: AuthenticatedUser | null = null;

  if (role === 'buyer') {
    const acheteur = await prisma.acheteur.findFirst({
      where: {
        OR: [
          ...(isNaN(Number(decoded.id)) ? [] : [{ id: BigInt(decoded.id) }]),
          ...(decoded.phone ? [{ contact: decoded.phone }] : [])
        ]
      },
      select: { id: true, nomEntreprise: true, contact: true, phoneVerified: true, isVerified: true }
    });

    if (acheteur) {
      userPayload = {
        id: acheteur.id.toString(),
        role: 'buyer',
        name: acheteur.nomEntreprise,
        phone: acheteur.contact,
        buyerId: acheteur.id.toString(),
        status: (acheteur.phoneVerified || acheteur.isVerified) ? 'active' : 'pending'
      };
    }
  } else if (role === 'seller') {
    const agriculteur = await prisma.agriculteur.findFirst({
      where: {
        OR: [
          ...(isNaN(Number(decoded.id)) ? [] : [{ id: BigInt(decoded.id) }]),
          ...(decoded.phone ? [{ contact: decoded.phone }] : [])
        ]
      },
      select: { id: true, nom: true, contact: true, gicId: true, estLeader: true, statut: true, phoneVerified: true, isVerified: true }
    });

    if (agriculteur) {
      userPayload = {
        id: agriculteur.id.toString(),
        role: 'seller',
        name: agriculteur.nom,
        phone: agriculteur.contact,
        gicId: agriculteur.gicId ? agriculteur.gicId.toString() : undefined,
        estLeader: agriculteur.estLeader,
        gicRole: agriculteur.estLeader ? 'leader' : 'member',
        status: agriculteur.statut === 'APPROUVE' ? 'active' : 'pending'
      };
    }
  } else if (role === 'admin') {
    const admin = await prisma.admin.findFirst({
      where: {
        OR: [
          { id: decoded.id },
          ...(decoded.nom ? [{ nom: decoded.nom }] : [])
        ]
      },
      select: { id: true, nom: true, contact: true }
    });

    if (admin) {
      userPayload = {
        id: admin.id,
        role: 'admin',
        name: admin.nom,
        phone: admin.contact,
        status: 'active'
      };
    }
  }

  if (!userPayload) {
    throw Object.assign(new Error('Non autorisé, compte utilisateur introuvable'), { statusCode: 401 });
  }

  req.user = userPayload;
  return next();
});

export const requireAuth = protect;

/**
 * Contrôle d'accès strict pour administrateur (réservé exclusivement à admin)
 */
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: "Accès refusé. Cette action nécessite les droits d'administrateur." });
};

/**
 * Contrôle d'accès strict pour responsable GIC.
 * Vérifie côté serveur directement en base :
 * - rôle 'seller'
 * - estLeader === true
 * - gicId renseigné
 */
export const isGicLeader = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'seller') {
    return res.status(403).json({ message: "Accès refusé. Seuls les leaders de GIC peuvent effectuer cette action." });
  }

  try {
    const seller = await prisma.agriculteur.findUnique({
      where: { id: BigInt(req.user.id) },
      select: { id: true, gicId: true, estLeader: true, statut: true }
    });

    if (!seller || !seller.estLeader || !seller.gicId) {
      return res.status(403).json({ message: "Accès refusé. Seuls les leaders de GIC peuvent effectuer cette action." });
    }

    req.user.gicId = seller.gicId.toString();
    req.user.estLeader = true;
    return next();
  } catch {
    return res.status(500).json({ message: "Erreur serveur lors de la vérification du statut de responsable GIC." });
  }
};
