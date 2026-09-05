import prisma from '../lib/prisma.js';
import { GicListData } from '../types/gic.types.js';

export const findAllGics = async (): Promise<GicListData[]> => {
    const gics = await prisma.gIC.findMany({
        select: {
            id: true,
            nom: true,
        },
    });
    return gics.map((g) => ({ id: g.id.toString(), nom: g.nom }));
};

export const getPendingMembersForGic = async (gicId: string | bigint) => {
    const members = await prisma.agriculteur.findMany({
        where: {
            gicId: BigInt(gicId),
            statut: 'EN_ATTENTE',
        },
        select: {
            id: true,
            nom: true,
            contact: true,
            timestampMaj: true,
        },
    });
    return members.map((m) => ({ ...m, id: m.id.toString() }));
};

export const updateMemberStatus = async (leaderId: string | bigint, memberId: string | bigint, newStatus: 'APPROUVE' | 'REJETE') => {
    // 1. Find the leader and the member in a single transaction to ensure data consistency
    const [leader, memberToUpdate] = await prisma.$transaction([
        prisma.agriculteur.findUniqueOrThrow({ where: { id: BigInt(leaderId) } }),
        prisma.agriculteur.findUniqueOrThrow({ where: { id: BigInt(memberId) } }),
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
    const updated = await prisma.agriculteur.update({
        where: { id: BigInt(memberId) },
        data: {
            statut: newStatus,
            timestampMaj: new Date(),
        },
    });

    return { ...updated, id: updated.id.toString(), gicId: updated.gicId.toString() };
};