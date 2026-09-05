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
            pinHash: hashedPin,
            isVerified: false,
        }
    });
    await sendVerificationSms(acheteur.contact);
    return { ...acheteur, id: acheteur.id.toString() };
};

export const registerAgriculteur = async (data: AgriculteurRegisterData) => {
    const { pin, gicId, ...restOfData } = data;
    if (!pin || pin.length < 4) {
        throw Object.assign(new Error('Un code PIN de 4 chiffres minimum est requis.'), { statusCode: 400 });
    }
    const hashedPin = await bcrypt.hash(pin, 10);

    const agriculteur = await prisma.agriculteur.create({
        data: {
            ...restOfData,
            gicId: BigInt(gicId),
            pin: hashedPin,
            pinHash: hashedPin,
            timestampMaj: new Date(),
            isVerified: false,
            statut: 'EN_ATTENTE',
        }
    });
    await sendVerificationSms(agriculteur.contact);
    return { ...agriculteur, id: agriculteur.id.toString(), gicId: agriculteur.gicId.toString() };
};

export const verifyAccount = async (contact: string, code: string): Promise<{ message: string, role?: string }> => {
    const verificationEntry = await prisma.verificationCode.findUnique({
        where: { contact },
    });

    if (!verificationEntry || verificationEntry.code !== code) {
        throw Object.assign(new Error('Code de vérification invalide.'), { statusCode: 400 });
    }

    if (new Date() > verificationEntry.expiresAt) {
        await prisma.verificationCode.delete({ where: { contact } });
        throw Object.assign(new Error('Le code de vérification a expiré.'), { statusCode: 410 });
    }

    let role: string | undefined;

    // 1. Chercher dans Acheteur
    const acheteur = await prisma.acheteur.findUnique({ where: { contact } });
    if (acheteur) {
        await prisma.acheteur.update({
            where: { contact },
            data: { isVerified: true, phoneVerified: true },
        });
        role = 'ACHETEUR';
    }

    // 2. Chercher dans Agriculteur
    const agriculteur = await prisma.agriculteur.findUnique({ where: { contact } });
    if (agriculteur) {
        await prisma.agriculteur.update({
            where: { contact },
            data: { isVerified: true, phoneVerified: true },
        });
        role = 'AGRICULTEUR';
        await notifyGicLeaderForApproval(agriculteur.gicId, agriculteur.nom);
    }

    if (!role) {
        throw Object.assign(new Error('Utilisateur non trouvé pour ce numéro de téléphone.'), { statusCode: 404 });
    }

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
        const pinValue = acheteur.pin || acheteur.pinHash;
        if (!pinValue) {
            throw Object.assign(new Error('Ce compte n\'a pas de code PIN configuré. Veuillez contacter le support.'), { statusCode: 403 });
        }

        const isPinMatch = await bcrypt.compare(pin, pinValue);
        if (!isPinMatch) {
            throw new Error('Contact ou code PIN incorrect.');
        }

        if (!acheteur.isVerified && !acheteur.phoneVerified) {
            await sendVerificationSms(contact);
            throw Object.assign(new Error('Votre compte n\'est pas vérifié. Un nouveau code vient de vous être envoyé.'), { statusCode: 403 });
        }

        return { user: { ...acheteur, id: acheteur.id.toString() }, role: 'ACHETEUR' };
    }

    // 2. Si non trouvé, chercher dans la table Agriculteur
    const agriculteur = await prisma.agriculteur.findUnique({
        where: { contact },
    });

    if (agriculteur) {
        const pinValue = agriculteur.pin || agriculteur.pinHash;
        if (!pinValue) {
            throw Object.assign(new Error('Ce compte n\'a pas de code PIN configuré. Veuillez contacter le support.'), { statusCode: 403 });
        }

        const isPinMatch = await bcrypt.compare(pin, pinValue);
        if (!isPinMatch) {
            throw new Error('Contact ou code PIN incorrect.');
        }

        if (!agriculteur.isVerified && !agriculteur.phoneVerified) {
            await sendVerificationSms(contact);
            throw Object.assign(new Error('Votre compte n\'est pas vérifié. Un nouveau code vient de vous être envoyé.'), { statusCode: 403 });
        }

        if (agriculteur.statut !== 'APPROUVE') {
            const statusMessage = agriculteur.statut === 'REJETE'
                ? 'Votre adhésion au GIC a été rejetée.'
                : 'Votre compte est en attente de validation par le leader de votre GIC.';
            throw Object.assign(new Error(statusMessage), { statusCode: 403 });
        }
        return { user: { ...agriculteur, id: agriculteur.id.toString(), gicId: agriculteur.gicId.toString() }, role: 'AGRICULTEUR' };
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