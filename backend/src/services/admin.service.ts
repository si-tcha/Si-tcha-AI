import prisma from '../lib/prisma.js';
import bcrypt from 'bcrypt';
import { GicCreationData, GicUpdateData, LeaderCreationData, LeaderUpdateData } from '../types/admin.types.js';

const DEFAULT_LEADER_PIN = '1234';

const validatePin = (pin: string) => {
    if (!/^\d{4,}$/.test(pin)) {
        throw Object.assign(new Error('Un code PIN numérique de 4 chiffres minimum est requis.'), { statusCode: 400 });
    }
};


export const createGicAndLeader = async (gicData: GicCreationData, leaderData: LeaderCreationData) => {
    const pin = leaderData.pin || DEFAULT_LEADER_PIN;
    validatePin(pin);
    const { pin: _, ...leaderWithoutPin } = leaderData;
    const hashedPin = await bcrypt.hash(pin, 10);

    return prisma.$transaction(async (tx) => {
        // 1. Create the GIC
        const newGic = await tx.gIC.create({
            data: {
                ...gicData,
                timestampMaj: new Date(),
            },
        });

        // 2. Create the Agriculteur who will be the leader
        const newLeader = await tx.agriculteur.create({
            data: {
                ...leaderWithoutPin,
                pin: hashedPin,
                gicId: newGic.id,
                estLeader: true,
                isVerified: true, // Admin-created leader is verified by default
                statut: 'APPROUVE', // Admin-created leader is approved by default
                timestampMaj: new Date(),
            },
        });

        const { pin: __, ...safeLeader } = newLeader;
        return { gic: newGic, leader: safeLeader };
    });
};

export const updateGicAndLeader = async (
    gicId: string,
    gicData: GicUpdateData,
    leaderData: LeaderUpdateData,
) => {
    const { pin, ...leaderWithoutPin } = leaderData;
    if (pin !== undefined) {
        validatePin(pin);
    }
    const hashedPin = pin !== undefined ? await bcrypt.hash(pin, 10) : undefined;
    const hasGicChanges = Object.keys(gicData).length > 0;
    const hasLeaderChanges = Object.keys(leaderWithoutPin).length > 0 || hashedPin !== undefined;

    return prisma.$transaction(async (tx) => {
        const gic = hasGicChanges
            ? await tx.gIC.update({
                where: { id: gicId },
                data: {
                    ...gicData,
                    timestampMaj: new Date(),
                },
            })
            : await tx.gIC.findUniqueOrThrow({ where: { id: gicId } });

        const leader = await tx.agriculteur.findFirst({
            where: { gicId, estLeader: true },
        });

        if (!leader) {
            throw Object.assign(new Error('Aucun leader trouvé pour ce GIC.'), { statusCode: 404 });
        }

        const updatedLeader = hasLeaderChanges
            ? await tx.agriculteur.update({
                where: { id: leader.id },
                data: {
                    ...leaderWithoutPin,
                    ...(hashedPin !== undefined ? { pin: hashedPin } : {}),
                    timestampMaj: new Date(),
                },
            })
            : leader;

        const { pin: __, ...safeLeader } = updatedLeader;
        return { gic, leader: safeLeader };
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