import { Request, Response } from 'express';
import * as gicService from '../../services/gic.service.js';

import prisma from '../../lib/prisma.js';

export const listGics = async (req: Request, res: Response) => {
    const gics = await gicService.findAllGics();
    res.status(200).json(gics);
};

export const listPendingMembers = async (req: Request, res: Response) => {
    const leaderId = req.user?.id;
    if (!leaderId) {
        return res.status(401).json({ message: "Utilisateur non authentifié." });
    }

    // Contrôle d'appartenance et de responsabilité refait côté serveur à partir de la base
    const leader = await prisma.agriculteur.findUnique({
        where: { id: BigInt(leaderId) },
        select: { id: true, gicId: true, estLeader: true }
    });

    if (!leader || !leader.estLeader || !leader.gicId) {
        return res.status(403).json({ message: "Accès refusé. Seuls les leaders de GIC peuvent effectuer cette action." });
    }

    const pendingMembers = await gicService.getPendingMembersForGic(leader.gicId);
    res.status(200).json(pendingMembers);
};

export const manageMemberStatus = async (req: Request, res: Response) => {
    const leaderId = req.user!.id;
    const { memberId } = req.params;
    const { status } = req.body; // 'APPROUVE' or 'REJETE'

    if (!status || (status !== 'APPROUVE' && status !== 'REJETE')) {
        return res.status(400).json({ message: "Le statut fourni est invalide. Utilisez 'APPROUVE' ou 'REJETE'." });
    }

    const updatedMember = await gicService.updateMemberStatus(leaderId, memberId, status as 'APPROUVE' | 'REJETE');

    res.status(200).json({
        message: `L'agriculteur a été ${status === 'APPROUVE' ? 'approuvé' : 'rejeté'} avec succès.`,
        member: updatedMember,
    });
};