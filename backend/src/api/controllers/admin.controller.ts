import { Request, Response } from 'express';
import * as adminService from '../../services/admin.service.js';

export const createGic = async (req: Request, res: Response) => {
    const { gicData, leaderData } = req.body;

    if (!gicData || !leaderData) {
        return res.status(400).json({ message: "Les données 'gicData' et 'leaderData' sont requises." });
    }

    const result = await adminService.createGicAndLeader(gicData, leaderData);

    res.status(201).json({
        message: 'GIC et son leader ont été créés avec succès.',
        ...result,
    });
};

export const listGicsWithStats = async (req: Request, res: Response) => {
    const gics = await adminService.getAllGicsWithMemberStats();
    res.status(200).json(gics);
};