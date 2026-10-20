import { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthRequest } from './auth.controller.js';

// GET /b2b/offers — Public (acheteurs + vendeurs voient toutes les offres)
export async function getB2BOffers(_req: Request, res: Response) {
  try {
    const offers = await prisma.b2BOfferEntry.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.json({
      offers: offers.map((o) => ({
        id: o.id,
        title: o.title,
        type: o.type,
        category: o.category,
        priceOrExchange: o.priceOrExchange,
        gicName: o.gicName,
        location: o.location,
        contact: o.contact,
        createdAt: o.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('Erreur getB2BOffers:', err);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
}

// POST /b2b/offers — Auth seller uniquement
export async function createB2BOffer(req: AuthRequest, res: Response) {
  if (req.user?.role !== 'seller' || !req.user.gicId) {
    return res.status(403).json({ message: 'Accès GIC requis.' });
  }

  const { title, type, category, priceOrExchange } = req.body as {
    title?: string;
    type?: string;
    category?: string;
    priceOrExchange?: string;
  };

  if (!title?.trim() || !type?.trim() || !priceOrExchange?.trim()) {
    return res.status(400).json({ message: 'Titre, type et tarif/échange sont requis.' });
  }

  try {
    const gic = await prisma.gIC.findUnique({
      where: { id: BigInt(req.user.gicId) },
      include: { bassinProduction: true },
    });

    if (!gic) {
      return res.status(404).json({ message: 'GIC introuvable pour la session active.' });
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const offer = await prisma.b2BOfferEntry.create({
      data: {
        id,
        title: title.trim(),
        type: type.trim(),
        category: category?.trim() ?? '',
        priceOrExchange: priceOrExchange.trim(),
        // L'identité affichée est toujours celle du GIC et du vendeur
        // authentifiés, jamais une valeur déclarée par le client.
        gicName: gic.nom,
        location: gic.bassinProduction?.nom ?? '',
        contact: req.user.phone,
        gicId: BigInt(req.user.gicId),
      },
    });

    return res.status(201).json({
      offer: {
        id: offer.id,
        title: offer.title,
        type: offer.type,
        category: offer.category,
        priceOrExchange: offer.priceOrExchange,
        gicName: offer.gicName,
        location: offer.location,
        contact: offer.contact,
        createdAt: offer.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('Erreur createB2BOffer:', err);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
}
