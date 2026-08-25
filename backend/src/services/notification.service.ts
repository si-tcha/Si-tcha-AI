import prisma from '../lib/prisma.js';
import axios from 'axios';

interface SendSmsOptions {
  to: string | string[]; // Un numéro isolé ou un tableau de numéros
  message: string;
}

/**
 * Nettoie et formate les numéros de téléphone au format attendu par Nexah.
 * Exemples acceptés : "+237697158087" -> "237697158087", "697158087" -> "697158087"
 */
function formatPhoneNumber(phone: string): string {
  return phone.replace(/[\s+()-]/g, '');
}


/**
 * Génère un code numérique à 6 chiffres.
 * @returns {string} Le code généré.
 */
const generateVerificationCode = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Envoie un SMS en utilisant l'API Nexah.
 * @param to - Le numéro de téléphone du destinataire (format international, ex: 2376...).
 * @param message - Le contenu du message à envoyer.
 */

export async function sendSms({ to, message }: SendSmsOptions): Promise<boolean> {
  try {
    const user = process.env.NEXAH_USER;
    const password = process.env.NEXAH_PASSWORD;
    const senderid = process.env.NEXAH_SENDER_ID || 'SI-TCHA';
    const apiUrl = process.env.NEXAH_API_URL || 'https://smsvas.com/bulk/public/index.php/api/v1/sendsms';

    if (!user || !password) {
      console.error('❌ Configuration Nexah SMS manquante dans le fichier .env (NEXAH_USER, NEXAH_PASSWORD)');
      return false;
    }

    // Préparation de la chaîne de numéros séparés par des virgules
    const mobiles = Array.isArray(to)
      ? to.map(formatPhoneNumber).join(',')
      : formatPhoneNumber(to);

    // Corps de la requête tel qu'attendu par l'API Nexah
    const payload = {
      user,
      password,
      senderid,
      sms: message,
      mobiles
    };

    console.log(`📱 Envoi SMS Nexah à : ${mobiles}...`);

    const response = await axios.post(apiUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000 // Timeout de 10s pour éviter de bloquer l'Auth
    });

    console.log('✅ Réponse API Nexah SMS :', response.data);

    // Vérification du statut de la réponse (Gestion dynamique des formats d'API Nexah)
    if (response.data) {
      // Cas 1 : Réponse sous forme de tableau d'objets statutaires (ex: Postman)
      if (Array.isArray(response.data)) {
        return response.data.some((item: any) => item.status === 'success');
      }

      // Cas 2 : Réponse sous forme d'objet principal avec responsecode (ex: Documentation PDF)
      if (response.data.responsecode === 1 || response.data.status === 'success') {
        return true;
      }
    }

    console.warn('⚠️ Le SMS a été envoyé mais Nexah a renvoyé un statut d\'erreur :', response.data);
    return false;
  } catch (error: any) {
    console.error('❌ Erreur lors de l\'envoi du SMS via Nexah :', error?.response?.data || error.message);
    return false;
  }
}

/**
 * Fonction optionnelle pour consulter le solde de crédits SMS restants
 */
export async function getNexahSmsBalance(): Promise<number | null> {
  try {
    const user = process.env.NEXAH_USER;
    const password = process.env.NEXAH_PASSWORD;

    const response = await axios.post(
      'https://smsvas.com/bulk/public/index.php/api/v1/smscredit',
      { user, password },
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (response.data && response.data.credit !== undefined) {
      console.log(`📊 Solde SMS Nexah restant : ${response.data.credit} crédits`);
      return response.data.credit;
    }

    return null;
  } catch (error: any) {
    console.error('❌ Erreur consultation solde Nexah :', error?.response?.data || error.message);
    return null;
  }
}

/**
 * Crée et "envoie" un code de vérification par SMS.
 * @param {string} contact - Le numéro de téléphone du destinataire.
 * @returns {Promise<void>}
 */
export const sendVerificationSms = async (contact: string): Promise<void> => {
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // Expire dans 10 minutes

    // Stocker le code dans la base de données (met à jour s'il existe déjà)
    await prisma.verificationCode.upsert({
        where: { contact },
        update: { code, expiresAt },
        create: { contact, code, expiresAt },
    });

    const message = `Votre code de vérification pour SI-TCHA AI est : ${code}. Il expire dans 10 minutes.`;

    // Utilise le service d'envoi de SMS
    await sendSms({ to: contact, message });
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
        await sendSms({ to: leader.contact, message });
    } else {
        console.warn(`Aucun leader trouvé pour le GIC ${gicId}. Impossible de notifier.`);
    }
};