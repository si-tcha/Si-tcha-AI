import prisma from '../lib/prisma.js';
import bcrypt from 'bcrypt';
import { GicCreationData, LeaderCreationData } from '../types/admin.types.js';

export const createGicAndLeader = async (gicData: GicCreationData, leaderData: LeaderCreationData) => {
    const pinHash = await bcrypt.hash(leaderData.pin, 12);
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
                nom: leaderData.nom.trim(),
                contact: leaderData.contact,
                pin: pinHash,
                pinHash,
                gicId: newGic.id,
                estLeader: true,
                // L'agent de l'entreprise a contrôlé l'identité et remet le
                // PIN de façon sûre : ce responsable peut donc se connecter
                // immédiatement pour approuver les futurs membres.
                phoneVerified: true,
                isVerified: true,
                statut: 'APPROUVE',
                timestampMaj: new Date(),
            },
        });

        // Ne jamais renvoyer `pin` / `pinHash`, même si ce sont des hashes :
        // l'agent n'a besoin que de l'identité et de l'état du leader créé.
        return {
            gic: newGic,
            leader: {
                id: newLeader.id,
                nom: newLeader.nom,
                contact: newLeader.contact,
                estLeader: newLeader.estLeader,
                phoneVerified: newLeader.phoneVerified,
                statut: newLeader.statut,
                gicId: newLeader.gicId,
            },
        };
    });
};

export const getAdminBootstrap = async () => {
    const bassins = await prisma.bassinProduction.findMany({
        select: { id: true, nom: true, region: true },
        orderBy: { nom: 'asc' },
    });

    return {
        bassins: bassins.map((bassin) => ({
            id: bassin.id.toString(),
            nom: bassin.nom,
            region: bassin.region,
        })),
    };
};

export const getAllGicsWithMemberStats = async () => {
    const gics = await prisma.gIC.findMany({
        include: {
            agriculteurs: {
                select: {
                    id: true,
                    nom: true,
                    contact: true,
                    statut: true,
                    timestampMaj: true,
                },
                orderBy: { timestampMaj: 'asc' },
            },
        },
    });

    // Restructure the data for a cleaner API response
    return gics.map((gic) => {
        const members = {
            pending: gic.agriculteurs.filter((a) => a.statut === 'EN_ATTENTE').map(serializeMember),
            approved: gic.agriculteurs.filter((a) => a.statut === 'APPROUVE').map(serializeMember),
            rejected: gic.agriculteurs.filter((a) => a.statut === 'REJETE').map(serializeMember),
        };

        const { agriculteurs, ...gicInfo } = gic;

        return {
            ...gicInfo,
            members,
        };
    });
};

const serializeMember = (member: { id: bigint; nom: string; contact: string; statut: string; timestampMaj: Date }) => ({
    ...member,
    id: member.id.toString(),
});

export const updatePendingMemberStatusByAdmin = async (memberId: string, newStatus: 'APPROUVE' | 'REJETE') => {
    let id: bigint;
    try {
        id = BigInt(memberId);
    } catch {
        throw Object.assign(new Error('Identifiant de compte invalide.'), { statusCode: 404 });
    }
    if (id <= 0n) {
        throw Object.assign(new Error('Identifiant de compte invalide.'), { statusCode: 404 });
    }

    const result = await prisma.agriculteur.updateMany({
        where: { id, statut: 'EN_ATTENTE' },
        data: { statut: newStatus, timestampMaj: new Date() },
    });
    if (result.count !== 1) {
        throw Object.assign(new Error("Ce compte n'est plus en attente ou n'existe pas."), { statusCode: 409 });
    }

    const member = await prisma.agriculteur.findUnique({
        where: { id },
        select: { id: true, nom: true, contact: true, statut: true, gicId: true, timestampMaj: true },
    });
    if (!member) {
        throw Object.assign(new Error('Compte introuvable après la mise à jour.'), { statusCode: 404 });
    }
    return { ...member, id: member.id.toString(), gicId: member.gicId.toString() };
};
