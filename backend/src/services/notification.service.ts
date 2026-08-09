import prisma from '../lib/prisma.js';
import axios from 'axios';

const USERNAME = process.env.AFRICASTALKING_USERNAME;
const API_KEY = process.env.AFRICASTALKING_API_KEY;
const API_URL = 'https://api.africastalking.com/version1/messaging';


/**
 * Génère un code numérique à 6 chiffres.
 * @returns {string} Le code généré.
 */
const generateVerificationCode = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Envoie un SMS en utilisant l'API Africa's Talking.
 * @param to - Le numéro de téléphone du destinataire (format international, ex: +2376...).
 * @param message - Le contenu du message à envoyer.
 */
export async function sendSms(to: string, message: string): Promise<void> {
  // Si les clés ne sont pas configurées, on simule l'envoi en console pour le dev
  if (!USERNAME || !API_KEY || API_KEY === "your_africastalking_api_key") {
    console.warn('⚠️  Clés Africa\'s Talking non configurées. Simulation de l\'envoi en console.');
    console.log(`[SMS SIMULÉ] Pour: ${to} | Message: "${message}"`);
    return;
  }

  // Africa's Talking requiert le format international avec le '+'
  const formattedTo = to.startsWith('+') ? to : `+${to}`;

  // Les données doivent être au format x-www-form-urlencoded
  const body = new URLSearchParams();
  body.append('username', USERNAME);
  body.append('to', formattedTo);
  body.append('message', message);

  try {
    const response = await axios.post(API_URL, body, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'apiKey': API_KEY,
      }
    });

    const recipients = response.data?.SMSMessageData?.Recipients;
    if (recipients && recipients.length > 0 && recipients[0].status === 'Success') {
      console.log(`✅ SMS envoyé avec succès à ${recipients[0].number}. Coût: ${recipients[0].cost}`);
    } else {
      // Log l'erreur renvoyée par l'API
      const errorMessage = recipients?.[0]?.status || response.data?.SMSMessageData?.Message || 'Réponse invalide de l\'API';
      console.error(`❌ Erreur lors de l'envoi du SMS à ${formattedTo}:`, errorMessage);
    }
  } catch (error: any) {
    console.error(`❌ Erreur réseau lors de la communication avec l'API Africa's Talking:`, error.response?.data || error.message);
  }
}

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

    // Utilise le service d'envoi de SMS
    await sendSms(contact, message);
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
        // Envoie un SMS au leader
        await sendSms(leader.contact, message);
    } else {
        console.warn(`Aucun leader trouvé pour le GIC ${gicId}. Impossible de notifier.`);
    }
};