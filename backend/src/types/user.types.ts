import { Prisma } from "@prisma/client";


export type AcheteurRegisterData = {
    nom: string;
    nomEntreprise: string;
    nui: string;
    secteur_activite: string;
    contact: string;
    pin: string;
    preferences?: Prisma.InputJsonValue;
}

export type AgriculteurRegisterData = {
    nom: string;
    contact: string;
    gicId: string;
    pin: string;
}

export type LoginData = {
    nom: string;
    contact: string;
    pin: string;
}

export type VerifyAccountData = {
    contact: string;
    code: string;
}

export type AuthenticatedUser = {
    id: string;
    role: 'AGRICULTEUR' | 'ACHETEUR' | 'ADMIN';
    gicId?: string;
    estLeader?: boolean;
}