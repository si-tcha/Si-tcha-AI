import { Request, Response } from 'express';
import * as gicService from '../../services/gic.service';

export const listGics = async (req: Request, res: Response) => {
    const gics = await gicService.findAllGics();
    res.status(200).json(gics);
};

export const listPendingMembers = async (req: Request, res: Response) => {
    // The user object is attached by the 'protect' middleware
    const leader = req.user!; 
    
    // We need the GIC ID from the authenticated leader
    if (!leader.gicId) {
        return res.status(400).json({ message: "Impossible de déterminer le GIC de l'utilisateur." });
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