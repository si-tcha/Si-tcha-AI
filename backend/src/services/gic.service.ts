import prisma from '../lib/prisma.js';
import { GicListData } from '../types/gic.types.js';


export const findAllGics = async (): Promise<GicListData[]> => {
    return prisma.gIC.findMany({
        select: {
            id: true,
            nom: true,
        }
    });
};

export const getPendingMembersForGic = async (gicId: string) => {
    return prisma.agriculteur.findMany({
        where: {
            gicId: gicId,
            statut: 'EN_ATTENTE',
        },
        select: {
            id: true,
            nom: true,
            contact: true,
            timestampMaj: true, // The creation date in this case
        },
    });
};

export const updateMemberStatus = async (leaderId: string, memberId: string, newStatus: 'APPROUVE' | 'REJETE') => {
    // 1. Find the leader and the member in a single transaction to ensure data consistency
    const [leader, memberToUpdate] = await prisma.$transaction([
        prisma.agriculteur.findUniqueOrThrow({ where: { id: leaderId } }),
        prisma.agriculteur.findUniqueOrThrow({ where: { id: memberId } }),
    ]);

    // 2. Security check: Ensure the leader is actually a leader and they belong to the same GIC
    if (!leader.estLeader || leader.gicId !== memberToUpdate.gicId) {
        throw Object.assign(new Error("Action non autorisée. Vous ne pouvez gérer que les membres de votre propre GIC."), { statusCode: 403 });
    }

    // 3. Check if the member is actually pending
    if (memberToUpdate.statut !== 'EN_ATTENTE') {
        throw Object.assign(new Error(`Cet utilisateur n'est plus en attente. Statut actuel: ${memberToUpdate.statut}`), { statusCode: 409 });
    }

    // 4. Update the member's status
    return prisma.agriculteur.update({
        where: { id: memberId },
        data: {
            statut: newStatus,
            timestampMaj: new Date(),
        },
    });
};