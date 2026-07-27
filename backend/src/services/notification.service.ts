import prisma from '../lib/prisma.js';

/**
 * Génère un code numérique à 6 chiffres.
 * @returns {string} Le code généré.
 */
const generateVerificationCode = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Crée et "envoie" un code de vérification par SMS.
 * @param {string} contact - Le numéro de téléphone du destinataire.
 * @returns {Promise<void>}
 */
export const sendVerificationSms = async (contact: string): Promise<void> => {
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // Expire dans 15 minutes

    // Stocker le code dans la base de données (met à jour s'il existe déjà)
    await prisma.verificationCode.upsert({
        where: { contact },
        update: { code, expiresAt },
        create: { contact, code, expiresAt },
    });

    const message = `Votre code de vérification pour SI-TCHA AI est : ${code}. Il expire dans 15 minutes.`;

    // TODO: Intégrer un vrai service d'envoi de SMS ici (ex: Twilio, Campay, etc.)
    // Exemple: await smsGateway.send(contact, message);
    console.log(`--- DEBUT SIMULATION SMS ---`);
    console.log(`À: ${contact}`);
    console.log(`Message: ${message}`);
    console.log(`--- FIN SIMULATION SMS ---`);
};

/**
 * Notifie le leader du GIC pour une nouvelle demande d'adhésion.
 * @param {string} gicId - L'ID du GIC.
 * @param {string} newMemberName - Le nom du nouvel agriculteur.
 */
export const notifyGicLeaderForApproval = async (gicId: string, newMemberName: string) => {
    const leader = await prisma.agriculteur.findFirst({
        where: { gicId, estLeader: true },
    });

    if (leader) {
        const message = `Nouvelle demande d'adhésion de ${newMemberName} à votre GIC. Veuillez vous connecter pour approuver ou rejeter.`;
        // TODO: Implémenter la logique de notification (Push Notification, SMS, etc.)
        console.log(`--- DEBUT NOTIFICATION LEADER ---`, { to: leader.contact, message });
    } else {
        console.warn(`Aucun leader trouvé pour le GIC ${gicId}. Impossible de notifier.`);
    }
};