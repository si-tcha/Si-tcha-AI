import { Request, Response } from 'express';
import * as adminService from '../../services/admin.service.js';

export const createGic = async (req: Request, res: Response) => {
    const { gicData, leaderData } = req.body;

    if (!gicData || !leaderData || !leaderData.nom?.trim() || !leaderData.contact?.trim() || !leaderData.pin) {
        return res.status(400).json({ message: "Les données GIC et les nom, téléphone et PIN du leader sont requis." });
    }
    if (!/^\d{4,6}$/.test(String(leaderData.pin))) {
        return res.status(400).json({ message: 'Le PIN du leader doit contenir entre 4 et 6 chiffres.' });
    }
    if (!/^\+?237[26]\d{8}$|^[26]\d{8}$/.test(String(leaderData.contact).replace(/[\s()-]/g, ''))) {
        return res.status(400).json({ message: 'Numéro de téléphone camerounais du leader invalide.' });
    }

    const compactPhone = String(leaderData.contact).replace(/[\s()-]/g, '');
    const result = await adminService.createGicAndLeader(gicData, {
        ...leaderData,
        contact: compactPhone.startsWith('+') ? compactPhone : `+237${compactPhone.replace(/^237/, '')}`,
    });

    res.status(201).json({
        message: 'GIC et son leader ont été créés avec succès.',
        ...result,
    });
};

export const listGicsWithStats = async (req: Request, res: Response) => {
    const gics = await adminService.getAllGicsWithMemberStats();
    res.status(200).json(gics);
};
