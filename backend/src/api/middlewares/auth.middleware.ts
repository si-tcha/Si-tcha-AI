import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../../lib/prisma.js';
import { AuthenticatedUser } from '../../types/user.types.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

function unauthorized(message: string): Error & { statusCode: number } {
    // Le gestionnaire Express lit statusCode sur l'erreur; res.status() seul était perdu après le throw.
    return Object.assign(new Error(message), { statusCode: 401 });
}

export const protect = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    let token;

    // 1. On vérifie la présence du header d'authentification
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        // On récupère uniquement la partie après l'espace
        token = req.headers.authorization.split(' ')[1];
    }

    // 2. Si aucun token n'est présent (ou si la chaîne était juste "Bearer ")
    if (!token) {
        throw unauthorized('Non autorisé, aucun token fourni');
    }

    // 3. Vérifier le JWT avant de charger le compte.
    let decoded: { id: string; role: string };
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string };
    } catch {
        throw unauthorized('Non autorisé, token invalide ou expiré');
    }

    // 4. Charger le compte depuis la base de données.
    let userPayload: AuthenticatedUser | null = null;
    if (decoded.role === 'ACHETEUR') {
        const user = await prisma.acheteur.findUnique({ where: { id: decoded.id }, select: { id: true } });
        if (user) userPayload = { id: user.id, role: 'ACHETEUR' };
    } else if (decoded.role === 'AGRICULTEUR') {
        const user = await prisma.agriculteur.findUnique({ where: { id: decoded.id }, select: { id: true, gicId: true, estLeader: true } });
        if (user) userPayload = { id: user.id, role: 'AGRICULTEUR', gicId: user.gicId, estLeader: user.estLeader };
    } else if (decoded.role === 'ADMIN') {
        const user = await prisma.admin.findUnique({ where: { id: decoded.id }, select: { id: true } });
        if (user) userPayload = { id: user.id, role: 'ADMIN' };
    }

    if (!userPayload) throw unauthorized('Non autorisé, compte utilisateur introuvable');

    // 5. Attacher l'utilisateur à la requête puis continuer.
    req.user = userPayload;
    return next();
});

// Middleware to check for GIC Leader role
export const isGicLeader = (req: Request, res: Response, next: NextFunction) => {
    if (req.user && req.user.role === 'AGRICULTEUR' && req.user.estLeader) {
        next();
    } else {
        res.status(403).json({ message: "Accès refusé. Seuls les leaders de GIC peuvent effectuer cette action." });
    }
};

// Middleware to check for Admin role
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (req.user && req.user.role === 'ADMIN') {
        next();
    } else {
        res.status(403).json({ message: "Accès refusé. Cette action nécessite les droits d'administrateur." });
    }
};