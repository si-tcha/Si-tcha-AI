import prisma from '../lib/prisma.js';
import axios from 'axios';
import { defaultOtpProvider, generateSecureOtp } from './otpProvider.js';

interface SendSmsOptions {
  to: string | string[];
  message: string;
}

/**
 * Envoie un SMS en passant par l'adaptateur OtpProvider.
 * Ne prétendra jamais qu'un SMS a été envoyé si le fournisseur échoue ou est désactivé.
 */
export async function sendSms({ to, message }: SendSmsOptions): Promise<boolean> {
  const result = await defaultOtpProvider.sendSms(to, message);
  return result.success;
}

/**
 * Fonction optionnelle pour consulter le solde de crédits SMS restants chez Nexah.
 */
export async function getNexahSmsBalance(): Promise<number | null> {
  try {
    const user = process.env.NEXAH_USER;
    const password = process.env.NEXAH_PASSWORD;

    if (!user || !password) {
      return null;
    }

    const response = await axios.post(
      'https://smsvas.com/bulk/public/index.php/api/v1/smscredit',
      { user, password },
      { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
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
 * Crée et expédie un code de vérification par SMS de façon cryptographiquement sûre.
 */
export const sendVerificationSms = async (contact: string): Promise<boolean> => {
  const code = generateSecureOtp(6);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // Expire dans 10 minutes

  await prisma.verificationCode.upsert({
    where: { contact },
    update: { code, expiresAt },
    create: { contact, code, expiresAt },
  });

  const message = `Votre code de vérification pour SI-TCHA AI est : ${code}. Il expire dans 10 minutes.`;
  return await sendSms({ to: contact, message });
};

/**
 * Notifie le leader du GIC pour une nouvelle demande d'adhésion.
 */
export const notifyGicLeaderForApproval = async (gicId: string | bigint, newMemberName: string): Promise<boolean> => {
  const leader = await prisma.agriculteur.findFirst({
    where: { gicId: BigInt(gicId), estLeader: true },
  });

  if (leader) {
    const message = `Nouvelle demande d'adhésion de ${newMemberName} à votre GIC. Veuillez vous connecter pour approuver ou rejeter.`;
    return await sendSms({ to: leader.contact, message });
  } else {
    console.warn(`Aucun leader trouvé pour le GIC ${gicId}. Impossible de notifier.`);
    return false;
  }
};
