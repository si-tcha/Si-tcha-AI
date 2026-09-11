import { Response } from 'express';
import crypto from 'node:crypto';
import prisma from '../lib/prisma.js';
import { AuthRequest } from './auth.controller.js';
import { logger } from '../middlewares/logger.js';
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
    return res.json({ parcels: parcels.map(formatParcel) });
  } catch (err: any) {
    (req.log ?? logger).error(
      { gicId: req.user.gicId, errorName: err?.name, errorCode: err?.code },
      'Erreur getParcels'
    );
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

  const hasVol = actualHarvestVolumeKg !== undefined && actualHarvestVolumeKg !== null;
  const hasDate = actualHarvestDate !== undefined && actualHarvestDate !== null && actualHarvestDate.trim().length > 0;
  if (hasVol !== hasDate) {
    return res.status(400).json({
      message: 'Le volume réel récolté et la date de récolte réelle doivent être fournis ensemble ou tous deux omis.',
    });
  }

  const finalStage = stage ?? 'Semis';
  if (finalStage === 'Récolté' && (!hasVol || !hasDate)) {
    return res.status(400).json({
      message: "L'étape 'Récolté' exige de renseigner le volume réel et la date réelle de récolte.",
    });
  }

  try {
    const id = crypto.randomUUID();
    const parcel = await prisma.parcelEntry.create({
      data: {
        id,
        parcelName: parcelName.trim(),
        crop: crop.trim(),
        sowingDate: sowingDate.trim(),
        stage: finalStage,
        estimatedHarvestDate: estimatedHarvestDate.trim(),
        estimatedVolumeKg,
        actualHarvestVolumeKg: actualHarvestVolumeKg !== undefined ? actualHarvestVolumeKg : null,
        actualHarvestDate: actualHarvestDate ? actualHarvestDate.trim() : null,
        gicId: BigInt(req.user.gicId),
      },
    });

    return res.status(201).json({ parcel: formatParcel(parcel) });
  } catch (err: any) {
    (req.log ?? logger).error(
      { gicId: req.user.gicId, errorName: err?.name, errorCode: err?.code },
      'Erreur createParcel'
    );
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

  if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
    return res.status(400).json({ message: 'Au moins un champ doit être fourni pour la mise à jour.' });
  }

  try {
    // Conditionné sur id AND gicId
    const existing = await prisma.parcelEntry.findFirst({
      where: { id, gicId: BigInt(req.user.gicId) },
    });

    // Isolation stricte entre GIC : 404 si la parcelle n'appartient pas au GIC de l'utilisateur
    if (!existing) {
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
    const finalActualHarvestVolumeKg =
      actualHarvestVolumeKg !== undefined ? actualHarvestVolumeKg : existing.actualHarvestVolumeKg;
    const finalStage = stage !== undefined ? stage : existing.stage;

    const hasVol = finalActualHarvestVolumeKg !== null && finalActualHarvestVolumeKg !== undefined;
    const hasDate = finalActualHarvestDate !== null && finalActualHarvestDate !== undefined && finalActualHarvestDate.length > 0;
    if (hasVol !== hasDate) {
      return res.status(400).json({
        message: 'Le volume réel récolté et la date de récolte réelle doivent être fournis ensemble ou tous deux null.',
      });
    }

    if (finalStage === 'Récolté' && (!hasVol || !hasDate)) {
      return res.status(400).json({
        message: "L'étape 'Récolté' exige de renseigner le volume réel et la date réelle de récolte.",
      });
    }

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

    // Mise à jour conditionnée sur id AND gicId
    const updateResult = await prisma.parcelEntry.updateMany({
      where: { id, gicId: BigInt(req.user.gicId) },
      data: {
        ...(parcelName !== undefined ? { parcelName: parcelName.trim() } : {}),
        ...(crop !== undefined ? { crop: crop.trim() } : {}),
        ...(sowingDate !== undefined ? { sowingDate: finalSowingDate } : {}),
        ...(stage !== undefined ? { stage: finalStage } : {}),
        ...(estimatedHarvestDate !== undefined ? { estimatedHarvestDate: finalEstimatedHarvestDate } : {}),
        ...(estimatedVolumeKg !== undefined ? { estimatedVolumeKg } : {}),
        ...(actualHarvestVolumeKg !== undefined ? { actualHarvestVolumeKg } : {}),
        ...(actualHarvestDate !== undefined ? { actualHarvestDate: finalActualHarvestDate } : {}),
        updatedAt: new Date(),
      },
    });

    if (updateResult.count === 0) {
      return res.status(404).json({ message: 'Parcelle introuvable ou non autorisée.' });
    }

    const updated = await prisma.parcelEntry.findUnique({ where: { id } });

    return res.json({ parcel: formatParcel(updated) });
  } catch (err: any) {
    (req.log ?? logger).error(
      { gicId: req.user.gicId, parcelId: id, errorName: err?.name, errorCode: err?.code },
      'Erreur updateParcel'
    );
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
}
