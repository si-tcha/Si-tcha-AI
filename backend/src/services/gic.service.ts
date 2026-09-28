import prisma from '../lib/prisma.js';
import { GicListData } from '../types/gic.types.js';

export const findAllGics = async (): Promise<GicListData[]> => {
    const gics = await prisma.gIC.findMany({
        // Ne proposer à l'inscription que les GIC où un responsable actif
        // existe réellement. Un GIC sans leader ne peut pas valider de membre.
        where: {
            agriculteurs: {
                some: {
                    estLeader: true,
                    statut: 'APPROUVE',
                    OR: [{ phoneVerified: true }, { isVerified: true }],
                },
            },
        },
        select: {
            id: true,
            nom: true,
        },
        orderBy: { nom: 'asc' },
    });
    return gics.map((g) => ({ id: g.id.toString(), nom: g.nom }));
};

/** Retourne uniquement un GIC auquel un nouvel agriculteur peut adhérer. */
export const findJoinableGicById = async (gicId: string | bigint) => {
    let id: bigint;
    try {
        id = BigInt(gicId);
    } catch {
        return null;
    }
    if (id <= 0n) {
        return null;
    }

    return prisma.gIC.findFirst({
        where: {
            id,
            agriculteurs: {
                some: {
                    estLeader: true,
                    statut: 'APPROUVE',
                    OR: [{ phoneVerified: true }, { isVerified: true }],
                },
            },
        },
        select: { id: true, nom: true },
    });
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
    let leaderBigInt: bigint;
    let memberBigInt: bigint;
    try {
        leaderBigInt = BigInt(leaderId);
        memberBigInt = BigInt(memberId);
    } catch {
        throw Object.assign(new Error("Identifiant invalide."), { statusCode: 404 });
    }

    // 1. Check leader and member exist
    const leader = await prisma.agriculteur.findUnique({ where: { id: leaderBigInt } });
    if (!leader) {
        throw Object.assign(new Error("Leader introuvable."), { statusCode: 404 });
    }

    const memberToUpdate = await prisma.agriculteur.findUnique({ where: { id: memberBigInt } });
    if (!memberToUpdate) {
        throw Object.assign(new Error("Membre introuvable."), { statusCode: 404 });
    }

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
        where: { id: memberBigInt },
        data: {
            statut: newStatus,
            timestampMaj: new Date(),
        },
    });

    return { ...updated, id: updated.id.toString(), gicId: updated.gicId.toString() };
};
