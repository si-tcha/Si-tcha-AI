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

export const updateGic = async (req: Request, res: Response) => {
    const { gicData, leaderData } = req.body ?? {};
    const isObject = (value: unknown) => value !== null && typeof value === 'object' && !Array.isArray(value);

    if ((gicData === undefined && leaderData === undefined)
        || (gicData !== undefined && !isObject(gicData))
        || (leaderData !== undefined && !isObject(leaderData))) {
        return res.status(400).json({
            message: "Le payload doit contenir un objet 'gicData' et/ou un objet 'leaderData'.",
        });
    }

    const result = await adminService.updateGicAndLeader(
        req.params.gicId,
        gicData ?? {},
        leaderData ?? {},
    );

    res.status(200).json({
        message: 'GIC et son leader ont été mis à jour avec succès.',
        ...result,
    });
};