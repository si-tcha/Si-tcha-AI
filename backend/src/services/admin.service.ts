import prisma from '../lib/prisma.js';
import { GicCreationData, LeaderCreationData } from '../types/admin.types.js';

export const createGicAndLeader = async (gicData: GicCreationData, leaderData: LeaderCreationData) => {
    return prisma.$transaction(async (tx) => {
        // 1. Create the GIC
        const { bassinProductionId, ...restGicData } = gicData;
        const newGic = await tx.gIC.create({
            data: {
                ...restGicData,
                bassinProductionId: BigInt(bassinProductionId),
                timestampMaj: new Date(),
            },
        });

        // 2. Create the Agriculteur who will be the leader
        const newLeader = await tx.agriculteur.create({
            data: {
                ...leaderData,
                gicId: newGic.id,
                estLeader: true,
                isVerified: true, // Admin-created leader is verified by default
                statut: 'APPROUVE', // Admin-created leader is approved by default
                timestampMaj: new Date(),
            },
        });

        return { gic: newGic, leader: newLeader };
    });
};

export const getAllGicsWithMemberStats = async () => {
    const gics = await prisma.gIC.findMany({
        include: {
            agriculteurs: {
                select: {
                    id: true,
                    nom: true,
                    statut: true,
                },
            },
        },
    });

    // Restructure the data for a cleaner API response
    return gics.map((gic) => {
        const members = {
            pending: gic.agriculteurs.filter((a) => a.statut === 'EN_ATTENTE'),
            approved: gic.agriculteurs.filter((a) => a.statut === 'APPROUVE'),
            rejected: gic.agriculteurs.filter((a) => a.statut === 'REJETE'),
        };

        const { agriculteurs, ...gicInfo } = gic;

        return {
            ...gicInfo,
            members,
        };
    });
};