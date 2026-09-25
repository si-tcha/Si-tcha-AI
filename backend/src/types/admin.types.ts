export type GicCreationData = {
    nom: string;
    identifiantREF: string;
    bassinProductionId: string;
    activitesPrincipales: string;
    statutLegalisation: string;
    logoURL: string;
};

export type LeaderCreationData = {
    nom: string;
    contact: string;
    pin?: string;
};

export type GicUpdateData = Partial<GicCreationData>;

export type LeaderUpdateData = {
    nom?: string;
    contact?: string;
    pin?: string;
};