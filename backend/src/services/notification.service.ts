import prisma from '../lib/prisma.js';
import axios, { AxiosError } from 'axios';

export interface SendSmsOptions {
  to: string | string[]; // Un numéro isolé ou un tableau de numéros
  message: string;
}

export interface SmsCampaignOptions {
  recipients: string[];
  message: string;
  label?: string;
  scheduledAt?: Date | string;
  customData?: Record<string, string>[];
}

export interface LeTextoResponse {
  status?: string;
  id?: string | number;
  [key: string]: unknown;
}

const LETEXTO_BASE_URL = process.env.LETEXTO_API_URL || 'https://apis.letexto.com';
const REQUEST_TIMEOUT_MS = 10000;

function getLeTextoConfig(): { apiKey: string; sender: string } | null {
  const apiKey = process.env.LETEXTO_API_KEY;
  const sender = process.env.LETEXTO_SENDER_ID || 'SI-TCHA AI';

  if (!apiKey) {
    console.error('Configuration LeTexto SMS manquante (LETEXTO_API_KEY).');
    return null;
  }

  return { apiKey, sender };
}

function getLeTextoHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function getApiErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const responseData = error.response?.data as { message?: string | string[]; error?: string } | undefined;
    const message = responseData?.message;
    return Array.isArray(message) ? message.join('; ') : message || responseData?.error || error.message;
  }

  return error instanceof Error ? error.message : 'Erreur inconnue';
}

/**
 * Nettoie et formate les numéros de téléphone au format attendu par LeTexto.
 * Exemples acceptés : "+237697158087" -> "237697158087", "697158087" -> "697158087"
 */
function formatPhoneNumber(phone: string): string {
  return phone.replace(/[\s+()-]/g, '');
}

function validatePhoneNumber(phone: string): string {
  const formattedPhone = formatPhoneNumber(phone);
  if (!/^\d{8,15}$/.test(formattedPhone)) {
    throw new Error(`Numéro de téléphone invalide : ${phone}`);
  }

  return formattedPhone;
}

function validateMessage(message: string): void {
  if (!message.trim()) {
    throw new Error('Le contenu du SMS est obligatoire.');
  }
}


/**
 * Génère un code numérique à 6 chiffres.
 * @returns {string} Le code généré.
 */
const generateVerificationCode = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Envoie un SMS en utilisant l'API LeTexto.
 * @param to - Le numéro de téléphone du destinataire (format international, ex: 2376...).
 * @param message - Le contenu du message à envoyer.
 */

export async function sendSms({ to, message }: SendSmsOptions): Promise<boolean> {
  try {
    if (Array.isArray(to)) {
      return Boolean(await createSmsCampaign({ recipients: to, message }));
    }

    const config = getLeTextoConfig();
    if (!config) {
      return false;
    }

    validateMessage(message);
    const recipient = validatePhoneNumber(to);
    const response = await axios.post<LeTextoResponse>(
      `${LETEXTO_BASE_URL}/v1/messages/send`,
      { from: config.sender, to: recipient, content: message },
      {
        headers: getLeTextoHeaders(config.apiKey),
        timeout: REQUEST_TIMEOUT_MS,
      },
    );

    console.log('Réponse API LeTexto SMS :', response.data);
    return response.status >= 200 && response.status < 300 && Boolean(response.data);
  } catch (error: unknown) {
    console.error('Erreur lors de l’envoi du SMS via LeTexto :', getApiErrorMessage(error));
    return false;
  }
}

/** Alias public avec la casse utilisée dans la documentation métier. */
export const sendSMS = sendSms;

/** Crée une campagne SMS LeTexto pour plusieurs destinataires. */
export async function createSmsCampaign(options: SmsCampaignOptions): Promise<LeTextoResponse | null> {
  try {
    const config = getLeTextoConfig();
    if (!config) {
      return null;
    }

    if (!Array.isArray(options.recipients) || options.recipients.length === 0) {
      throw new Error('La campagne doit contenir au moins un destinataire.');
    }
    validateMessage(options.message);

    const contacts = options.recipients.map((recipient, index) => {
      const customData = options.customData?.[index] || {};
      return { numero: validatePhoneNumber(recipient), ...customData };
    });

    const payload: Record<string, unknown> = {
      label: options.label || `SI-TCHA-${new Date().toISOString()}`,
      sender: config.sender,
      contacts,
      content: options.message,
    };

    if (options.scheduledAt) {
      const scheduledAt = new Date(options.scheduledAt);
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
        throw new Error('La date de programmation doit être une date future valide.');
      }
      payload.sendAt = scheduledAt.toISOString();
    }

    const response = await axios.post<LeTextoResponse>(
      `${LETEXTO_BASE_URL}/v1/campaigns/sms`,
      payload,
      { headers: getLeTextoHeaders(config.apiKey), timeout: REQUEST_TIMEOUT_MS },
    );

    console.log('Réponse API LeTexto campagne SMS :', response.data);
    return response.status >= 200 && response.status < 300 ? response.data : null;
  } catch (error: unknown) {
    console.error('Erreur lors de la création de la campagne SMS LeTexto :', getApiErrorMessage(error));
    return null;
  }
}

/**
 * Consulte le solde de crédits SMS LeTexto.
 */
export async function getLeTextoSmsBalance(): Promise<number | null> {
  try {
    const config = getLeTextoConfig();
    if (!config) {
      return null;
    }

    const response = await axios.get<{ balance?: number; credit?: number }>(
      `${LETEXTO_BASE_URL}/v1/users/balance`,
      { params: { token: config.apiKey }, timeout: REQUEST_TIMEOUT_MS },
    );

    const balance = response.data.balance ?? response.data.credit;
    if (balance !== undefined) {
      console.log(`Solde SMS LeTexto restant : ${balance} crédits`);
      return balance;
    }

    return null;
  } catch (error: unknown) {
    console.error('Erreur consultation solde LeTexto :', getApiErrorMessage(error));
    return null;
  }
}

/** Alias conservé pour les éventuels appelants historiques. */
export const getNexahSmsBalance = getLeTextoSmsBalance;

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