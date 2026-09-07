import { Response } from 'express';
import crypto from 'node:crypto';
import prisma from '../lib/prisma.js';
import { AuthRequest } from './auth.controller.js';
import { calculateYieldDrop } from '../utils/growthUtils.js';

function formatParcel(p: any) {
  const { dropPercent, isDropAlert } = calculateYieldDrop(
    p.estimatedVolumeKg,
    p.actualHarvestVolumeKg
  );
  return {
    id: p.id,
    parcelName: p.parcelName,
    crop: p.crop,
    sowingDate: p.sowingDate,
    stage: p.stage,
    estimatedHarvestDate: p.estimatedHarvestDate,
    estimatedVolumeKg: p.estimatedVolumeKg,
    actualHarvestVolumeKg: p.actualHarvestVolumeKg ?? null,
    actualHarvestDate: p.actualHarvestDate ?? null,
    yieldDropPercent: dropPercent,
    yieldDropAlert: isDropAlert,
    updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt,
  };
}

// GET /api/gic/parcels — Auth seller
export async function getParcels(req: AuthRequest, res: Response) {
  if (req.user?.role !== 'seller' || !req.user.gicId) {
    return res.status(403).json({ message: 'Accès GIC requis.' });
  }

  try {
    const parcels = await prisma.parcelEntry.findMany({
      where: { gicId: BigInt(req.user.gicId) },
      orderBy: { updatedAt: 'desc' },
    });
    return res.json({
      parcels: parcels.map(formatParcel),
    });
  } catch (err) {
    console.error('Erreur getParcels:', err);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
}

// POST /api/gic/parcels — Auth seller
export async function createParcel(req: AuthRequest, res: Response) {
  if (req.user?.role !== 'seller' || !req.user.gicId) {
    return res.status(403).json({ message: 'Accès GIC requis.' });
  }

  const {
    parcelName,
    crop,
    sowingDate,
    stage,
    estimatedHarvestDate,
    estimatedVolumeKg,
    actualHarvestVolumeKg,
    actualHarvestDate,
  } = req.body as {
    parcelName: string;
    crop: string;
    sowingDate: string;
    stage?: string;
    estimatedHarvestDate: string;
    estimatedVolumeKg: number;
    actualHarvestVolumeKg?: number | null;
    actualHarvestDate?: string | null;
  };

  try {
    const id = crypto.randomUUID();
    const parcel = await prisma.parcelEntry.create({
      data: {
        id,
        parcelName: parcelName.trim(),
        crop: crop.trim(),
        sowingDate: sowingDate.trim(),
        stage: stage ?? 'Semis',
        estimatedHarvestDate: estimatedHarvestDate.trim(),
        estimatedVolumeKg,
        actualHarvestVolumeKg: actualHarvestVolumeKg !== undefined ? actualHarvestVolumeKg : null,
        actualHarvestDate: actualHarvestDate ? actualHarvestDate.trim() : null,
        gicId: BigInt(req.user.gicId),
      },
    });

    return res.status(201).json({
      parcel: formatParcel(parcel),
    });
  } catch (err) {
    console.error('Erreur createParcel:', err);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
}

// PUT /api/gic/parcels/:id — Auth seller
export async function updateParcel(req: AuthRequest, res: Response) {
  if (req.user?.role !== 'seller' || !req.user.gicId) {
    return res.status(403).json({ message: 'Accès GIC requis.' });
  }

  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ message: 'Identifiant de parcelle requis.' });
  }

  try {
    const existing = await prisma.parcelEntry.findUnique({
      where: { id },
    });

    // Isolation stricte entre GIC : 404 si la parcelle n'existe pas ou appartient à un autre GIC
    if (!existing || existing.gicId !== BigInt(req.user.gicId)) {
      return res.status(404).json({ message: 'Parcelle introuvable.' });
    }

    const {
      parcelName,
      crop,
      sowingDate,
      stage,
      estimatedHarvestDate,
      estimatedVolumeKg,
      actualHarvestVolumeKg,
      actualHarvestDate,
    } = req.body;

    const finalSowingDate = sowingDate !== undefined ? sowingDate.trim() : existing.sowingDate;
    const finalEstimatedHarvestDate =
      estimatedHarvestDate !== undefined ? estimatedHarvestDate.trim() : existing.estimatedHarvestDate;
    const finalActualHarvestDate =
      actualHarvestDate !== undefined
        ? (actualHarvestDate ? actualHarvestDate.trim() : null)
        : existing.actualHarvestDate;

    if (finalEstimatedHarvestDate < finalSowingDate) {
      return res.status(400).json({
        message: 'La date de récolte estimée ne peut pas être antérieure à la date de semis.',
      });
    }

    if (finalActualHarvestDate && finalActualHarvestDate < finalSowingDate) {
      return res.status(400).json({
        message: 'La date de récolte réelle ne peut pas être antérieure à la date de semis.',
      });
    }

    const updated = await prisma.parcelEntry.update({
      where: { id },
      data: {
        ...(parcelName !== undefined ? { parcelName: parcelName.trim() } : {}),
        ...(crop !== undefined ? { crop: crop.trim() } : {}),
        ...(sowingDate !== undefined ? { sowingDate: finalSowingDate } : {}),
        ...(stage !== undefined ? { stage } : {}),
        ...(estimatedHarvestDate !== undefined ? { estimatedHarvestDate: finalEstimatedHarvestDate } : {}),
        ...(estimatedVolumeKg !== undefined ? { estimatedVolumeKg } : {}),
        ...(actualHarvestVolumeKg !== undefined ? { actualHarvestVolumeKg } : {}),
        ...(actualHarvestDate !== undefined ? { actualHarvestDate: finalActualHarvestDate } : {}),
        updatedAt: new Date(),
      },
    });

    return res.json({
      parcel: formatParcel(updated),
    });
  } catch (err) {
    console.error('Erreur updateParcel:', err);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
}
