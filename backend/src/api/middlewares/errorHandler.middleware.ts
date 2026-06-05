import { Request, Response, NextFunction } from 'express';
import { Prisma } from '../../../generated/prisma/client';

interface HttpError extends Error {
    statusCode?: number;
}

export const errorHandler = (err: HttpError, req: Request, res: Response, next: NextFunction) => {
    console.error(err); // Garder pour le débogage

    // Gérer les erreurs de contrainte unique de Prisma
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const fields = (err.meta as any)?.target?.join(', ');
        const message = fields ? `Un enregistrement avec cette valeur pour '${fields}' existe déjà.` : `Une contrainte d'unicité a été violée.`;
        return res.status(409).json({ message });
    }

    const statusCode = err.statusCode || 500;
    const message = err.statusCode ? err.message : 'Une erreur interne est survenue sur le serveur.';

    res.status(statusCode).json({ message });
};