import { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthRequest } from './auth.controller.js';

// GET /trust/ratings — Public
export async function getTrustRatings(_req: Request, res: Response) {
  try {
    const ratings = await prisma.trustRatingEntry.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.json({
      ratings: ratings.map((r) => ({
        id: r.id,
        targetId: r.targetId,
        targetType: r.targetType,
        rating: r.rating,
        comment: r.comment,
        authorName: r.authorName,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('Erreur getTrustRatings:', err);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
}

// POST /trust/ratings — Auth
export async function createTrustRating(req: AuthRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentification requise.' });
  }

  const { targetId, targetType, rating, comment, authorName } = req.body as {
    targetId?: string;
    targetType?: string;
    rating?: number;
    comment?: string;
    authorName?: string;
  };

  if (!targetId || !targetType || !rating || !comment?.trim()) {
    return res.status(400).json({ message: 'Cible, type, note et commentaire sont requis.' });
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'La note doit être entre 1 et 5.' });
  }

  try {
    const id = Date.now().toString();
    const entry = await prisma.trustRatingEntry.create({
      data: {
        id,
        targetId,
        targetType,
        rating,
        comment: comment.trim(),
        authorName: authorName?.trim() ?? req.user.name ?? 'Utilisateur',
      },
    });

    return res.status(201).json({
      rating: {
        id: entry.id,
        targetId: entry.targetId,
        targetType: entry.targetType,
        rating: entry.rating,
        comment: entry.comment,
        authorName: entry.authorName,
        createdAt: entry.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('Erreur createTrustRating:', err);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
}
