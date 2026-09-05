import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../../lib/prisma.js';
import { AuthenticatedUser } from '../../types/user.types.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const protect = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    let token;

    // 1. On vérifie la présence du header d'authentification
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    // 2. Si aucun token n'est présent (ou si la chaîne était juste "Bearer ")
    if (!token) {
        res.status(401);
        throw new Error('Non autorisé, aucun token fourni');
    }

    // 3. On protège la lecture du token avec un try...catch
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string; };

        // 4. On récupère l'utilisateur en base de données
        let userPayload: AuthenticatedUser | null = null;
        if (decoded.role === 'ACHETEUR') {
            const user = await prisma.acheteur.findUnique({ where: { id: BigInt(decoded.id) }, select: { id: true } });
            if (user) userPayload = { id: user.id.toString(), role: 'ACHETEUR' };
        } else if (decoded.role === 'AGRICULTEUR') {
            const user = await prisma.agriculteur.findUnique({ where: { id: BigInt(decoded.id) }, select: { id: true, gicId: true, estLeader: true } });
            if (user) userPayload = { id: user.id.toString(), role: 'AGRICULTEUR', gicId: user.gicId.toString(), estLeader: user.estLeader };
        } else if (decoded.role === 'ADMIN') {
            const user = await prisma.admin.findUnique({ where: { id: decoded.id }, select: { id: true } });
            if (user) userPayload = { id: user.id, role: 'ADMIN' };
        }
        
        if (!userPayload) {
            res.status(401);
            throw new Error('Non autorisé, compte utilisateur introuvable');
        }

        // 5. On attache l'utilisateur à la requête et on passe au middleware suivant
        req.user = userPayload;
        return next();

    } catch (error) {
        res.status(401);
        throw new Error('Non autorisé, token invalide ou expiré');
    }
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