import prisma from '../lib/prisma';
// GET /gic/parcels — Auth seller
export async function getParcels(req, res) {
    if (req.user?.role !== 'seller' || !req.user.gicId) {
        return res.status(403).json({ message: 'Accès GIC requis.' });
    }
    try {
        const parcels = await prisma.parcelEntry.findMany({
            where: { gicId: BigInt(req.user.gicId) },
            orderBy: { updatedAt: 'desc' },
        });
        return res.json({
            parcels: parcels.map((p) => ({
                id: p.id,
                parcelName: p.parcelName,
                crop: p.crop,
                sowingDate: p.sowingDate,
                stage: p.stage,
                estimatedHarvestDate: p.estimatedHarvestDate,
                estimatedVolumeKg: p.estimatedVolumeKg,
                actualHarvestVolumeKg: p.actualHarvestVolumeKg,
                updatedAt: p.updatedAt.toISOString(),
            })),
        });
    }
    catch (err) {
        console.error('Erreur getParcels:', err);
        return res.status(500).json({ message: 'Erreur serveur.' });
    }
}
// POST /gic/parcels — Auth seller
export async function createParcel(req, res) {
    if (req.user?.role !== 'seller' || !req.user.gicId) {
        return res.status(403).json({ message: 'Accès GIC requis.' });
    }
    const { parcelName, crop, sowingDate, stage, estimatedHarvestDate, estimatedVolumeKg, actualHarvestVolumeKg } = req.body;
    if (!parcelName?.trim() || !crop?.trim()) {
        return res.status(400).json({ message: 'Nom de la parcelle et culture sont requis.' });
    }
    try {
        const id = Date.now().toString();
        const parcel = await prisma.parcelEntry.create({
            data: {
                id,
                parcelName: parcelName.trim(),
                crop: crop.trim(),
                sowingDate: sowingDate ?? '',
                stage: stage ?? 'Semis',
                estimatedHarvestDate: estimatedHarvestDate ?? '',
                estimatedVolumeKg: estimatedVolumeKg ?? 0,
                actualHarvestVolumeKg: actualHarvestVolumeKg ?? null,
                gicId: BigInt(req.user.gicId),
            },
        });
        return res.status(201).json({
            parcel: {
                id: parcel.id,
                parcelName: parcel.parcelName,
                crop: parcel.crop,
                sowingDate: parcel.sowingDate,
                stage: parcel.stage,
                estimatedHarvestDate: parcel.estimatedHarvestDate,
                estimatedVolumeKg: parcel.estimatedVolumeKg,
                actualHarvestVolumeKg: parcel.actualHarvestVolumeKg,
                updatedAt: parcel.updatedAt.toISOString(),
            },
        });
    }
    catch (err) {
        console.error('Erreur createParcel:', err);
        return res.status(500).json({ message: 'Erreur serveur.' });
    }
}
