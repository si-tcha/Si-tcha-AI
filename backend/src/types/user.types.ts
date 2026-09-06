import { Prisma } from "@prisma/client";

/**
 * Rôles canoniques de la plateforme :
 * - seller : producteur / agriculteur
 * - buyer : acheteur professionnel / entreprise
 * - admin : administrateur de la plateforme
 */
export type CanonicalRole = 'seller' | 'buyer' | 'admin';

export interface AuthenticatedUser {
  id: string;
  role: CanonicalRole;
  phone?: string;
  name?: string;
  buyerId?: string;
  gicId?: string;
  estLeader?: boolean;
  gicRole?: 'leader' | 'member';
  status?: 'active' | 'pending';
}

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
