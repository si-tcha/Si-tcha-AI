import prisma from '../lib/prisma.js';
import { AcheteurRegisterData, AgriculteurRegisterData } from '../types/user.types.js';
import { notifyGicLeaderForApproval, sendVerificationSms } from './notification.service.js';
import bcrypt from 'bcrypt';

export const registerAcheteur = async (data: AcheteurRegisterData) => {
    const { pin, ...restOfData } = data;
    if (!pin || pin.length < 4) {
        throw Object.assign(new Error('Un code PIN de 4 chiffres minimum est requis.'), { statusCode: 400 });
    }
    const hashedPin = await bcrypt.hash(pin, 10);

    const acheteur = await prisma.acheteur.create({
        data: {
            ...restOfData,
            pin: hashedPin,
            isVerified: false, // Le compte n'est pas vérifié à la création
        }
    });
    await sendVerificationSms(acheteur.contact);
    return acheteur;
};

export const registerAgriculteur = async (data: AgriculteurRegisterData) => {
    const { pin, ...restOfData } = data;
    if (!pin || pin.length < 4) {
        throw Object.assign(new Error('Un code PIN de 4 chiffres minimum est requis.'), { statusCode: 400 });
    }
    const hashedPin = await bcrypt.hash(pin, 10);

    const agriculteur = await prisma.agriculteur.create({
        data: {
            ...restOfData,
            pin: hashedPin,
            timestampMaj: new Date(),
            isVerified: false, // Le compte n'est pas vérifié à la création
            statut: 'EN_ATTENTE', // Statut pour l'approbation du leader
        }
    });
    await sendVerificationSms(agriculteur.contact);
    return agriculteur;
};

export const verifyAccount = async (contact: string, code: string): Promise<{ message: string, role?: string }> => {
    const verificationEntry = await prisma.verificationCode.findUnique({
        where: { contact },
    });

    if (!verificationEntry || verificationEntry.code !== code) {
        throw Object.assign(new Error('Code de vérification invalide.'), { statusCode: 400 });
    }

    if (new Date() > verificationEntry.expiresAt) {
        // On peut aussi supprimer le code expiré
        await prisma.verificationCode.delete({ where: { contact } });
        throw Object.assign(new Error('Le code de vérification a expiré.'), { statusCode: 410 });
    }

    // Le code est valide, on cherche l'utilisateur et on le met à jour.
    let role: string | undefined;
    const acheteur = await prisma.acheteur.findUnique({ where: { contact } });
    if (acheteur) {
        await prisma.acheteur.update({
            where: { id: acheteur.id },
            data: { isVerified: true },
        });
        role = 'ACHETEUR';
    } else {
        const agriculteur = await prisma.agriculteur.findUnique({ where: { contact } });
        if (agriculteur) {
            await prisma.agriculteur.update({
                where: { id: agriculteur.id },
                data: { isVerified: true },
            });
            role = 'AGRICULTEUR';
            // Maintenant que le compte est vérifié, on notifie le leader du GIC
            await notifyGicLeaderForApproval(agriculteur.gicId, agriculteur.nom);
        }
    }

    if (!role) {
        // Ne devrait jamais arriver si le code de vérification existe
        throw new Error('Aucun utilisateur trouvé pour ce contact.');
    }

    // Supprimer le code de vérification après utilisation
    await prisma.verificationCode.delete({ where: { contact } });

    const message = role === 'AGRICULTEUR'
        ? 'Compte vérifié avec succès. Votre demande est en attente de validation par le leader de votre GIC.'
        : 'Compte vérifié avec succès. Vous pouvez maintenant vous connecter.';

    return { message, role };
};

export const login = async (contact: string, pin: string) => {
    // 1. Chercher dans la table Acheteur
    const acheteur = await prisma.acheteur.findUnique({
        where: { contact },
    });

    if (acheteur) {
        if (!acheteur.pin) {
            throw Object.assign(new Error('Ce compte n\'a pas de code PIN configuré. Veuillez contacter le support.'), { statusCode: 403 });
        }

        const isPinMatch = await bcrypt.compare(pin, acheteur.pin);
        if (!isPinMatch) {
            throw new Error('Contact ou code PIN incorrect.');
        }

        if (!acheteur.isVerified) {
            await sendVerificationSms(contact);
            throw Object.assign(new Error('Votre compte n\'est pas vérifié. Un nouveau code vient de vous être envoyé.'), { statusCode: 403 });
        }

        return { user: acheteur, role: 'ACHETEUR' };
    }

    // 2. Si non trouvé, chercher dans la table Agriculteur
    const agriculteur = await prisma.agriculteur.findUnique({
        where: { contact },
    });

    if (agriculteur) {
        if (!agriculteur.pin) {
            throw Object.assign(new Error('Ce compte n\'a pas de code PIN configuré. Veuillez contacter le support.'), { statusCode: 403 });
        }

        const isPinMatch = await bcrypt.compare(pin, agriculteur.pin);
        if (!isPinMatch) {
            throw new Error('Contact ou code PIN incorrect.');
        }

        if (!agriculteur.isVerified) {
            await sendVerificationSms(contact);
            throw Object.assign(new Error('Votre compte n\'est pas vérifié. Un nouveau code vient de vous être envoyé.'), { statusCode: 403 });
        }

        if (agriculteur.statut !== 'APPROUVE') {
            const statusMessage = agriculteur.statut === 'REJETE'
                ? 'Votre adhésion au GIC a été rejetée.'
                : 'Votre compte est en attente de validation par le leader de votre GIC.';
            throw Object.assign(new Error(statusMessage), { statusCode: 403 });
        }
        return { user: agriculteur, role: 'AGRICULTEUR' };
    }

    // 3. Si toujours pas trouvé, les identifiants sont incorrects
    throw new Error('Contact ou code PIN incorrect.');
};

export const adminLogin = async (nom: string, motDePasse: string) => {
    const admin = await prisma.admin.findUnique({
        where: { nom },
    });

    if (!admin) {
        throw Object.assign(new Error('Nom d\'utilisateur ou mot de passe incorrect.'), { statusCode: 401 });
    }

    const isMatch = await bcrypt.compare(motDePasse, admin.password);
    if (!isMatch) {
        throw Object.assign(new Error('Nom d\'utilisateur ou mot de passe incorrect.'), { statusCode: 401 });
    }

    const { password, ...userPayload } = admin;
    return { user: userPayload, role: 'ADMIN' };
};