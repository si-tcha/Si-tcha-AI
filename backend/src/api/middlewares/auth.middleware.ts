import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../../lib/prisma';
import { AuthenticatedUser } from '../../types/user.types';
import { asyncHandler } from '../../utils/asyncHandler';

export const protect = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        // Get token from header
        token = req.headers.authorization.split(' ')[1];

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string; };

        // Get user from the token ID and attach to request
        let userPayload: AuthenticatedUser | null = null;
        if (decoded.role === 'ACHETEUR') {
            const user = await prisma.acheteur.findUnique({ where: { id: decoded.id }, select: { id: true } });
            if (user) userPayload = { id: user.id, role: 'ACHETEUR' };
        } else if (decoded.role === 'AGRICULTEUR') {
            const user = await prisma.agriculteur.findUnique({ where: { id: decoded.id }, select: { id: true, gicId: true, estLeader: true } });
            if (user) userPayload = { id: user.id, role: 'AGRICULTEUR', gicId: user.gicId, estLeader: user.estLeader };
        } else if (decoded.role === 'ADMIN') {
            const user = await prisma.admin.findUnique({ where: { id: decoded.id }, select: { id: true } });
            // Pour un admin, gicId et estLeader ne sont pas pertinents
            if (user) userPayload = { id: user.id, role: 'ADMIN' };
        }
        
        if (!userPayload) {
            res.status(401);
            throw new Error('Non autorisé, utilisateur non trouvé');
        }

        req.user = userPayload;
        return next();
    }

    if (!token) {
        res.status(401);
        throw new Error('Non autorisé, pas de token');
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