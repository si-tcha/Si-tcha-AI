import crypto from 'node:crypto';
import axios from 'axios';

export type OtpProviderMode = 'disabled' | 'development' | 'test' | 'nexah';

export interface SendSmsResult {
  success: boolean;
  message: string;
  provider: OtpProviderMode;
  error?: string;
}

export interface OtpProvider {
  getMode(): OtpProviderMode;
  sendSms(to: string | string[], message: string): Promise<SendSmsResult>;
}

/**
 * Génère un code OTP numérique à 6 chiffres de manière cryptographiquement sûre.
 */
export function generateSecureOtp(length: number = 6): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length);
  return crypto.randomInt(min, max).toString();
}

function formatPhoneNumber(phone: string): string {
  return phone.replace(/[\s+()-]/g, '');
}

export class AppOtpProvider implements OtpProvider {
  private explicitMode?: OtpProviderMode;

  constructor(explicitMode?: OtpProviderMode) {
    this.explicitMode = explicitMode;
  }

  getMode(): OtpProviderMode {
    if (this.explicitMode) {
      return this.explicitMode;
    }
    const envProvider = (process.env.OTP_PROVIDER || '').toLowerCase();
    if (envProvider === 'disabled') {
      return 'disabled';
    } else if (envProvider === 'development' || envProvider === 'dev') {
      return 'development';
    } else if (envProvider === 'nexah') {
      return 'nexah';
    } else if (envProvider === 'test' || process.env.NODE_ENV === 'test') {
      return 'test';
    } else {
      // Désactivé par défaut (Nexah est inopérant tant qu'il n'est pas configuré et activé explicitement)
      return 'disabled';
    }
  }

  async sendSms(to: string | string[], message: string): Promise<SendSmsResult> {
    const isProduction = process.env.NODE_ENV === 'production';
    const mode = this.getMode();

    switch (mode) {
      case 'disabled': {
        const warning = isProduction
          ? 'Le service SMS n\'est pas opérationnel ou non configuré en production.'
          : 'Service SMS désactivé (OTP_PROVIDER=disabled). Aucun SMS réel n\'a été envoyé.';
        console.warn(`⚠️ [SMS Provider]: ${warning}`);
        return {
          success: false,
          message: warning,
          provider: 'disabled',
          error: warning,
        };
      }

      case 'development': {
        const target = Array.isArray(to) ? to.join(', ') : to;
        console.log(`📱 [DEV SMS SIMULATOR] Destinataire(s): ${target}`);
        console.log(`💬 [DEV SMS MESSAGE]: ${message}`);
        return {
          success: true,
          message: 'SMS simulé avec succès en environnement de développement.',
          provider: 'development',
        };
      }

      case 'test': {
        return {
          success: true,
          message: 'SMS intercepté en mode test.',
          provider: 'test',
        };
      }

      case 'nexah': {
        const user = process.env.NEXAH_USER;
        const password = process.env.NEXAH_PASSWORD;
        const senderid = process.env.NEXAH_SENDER_ID || 'SI-TCHA';
        const apiUrl = process.env.NEXAH_API_URL || 'https://smsvas.com/bulk/public/index.php/api/v1/sendsms';

        if (!user || !password) {
          const err = 'Configuration Nexah SMS manquante dans le fichier .env (NEXAH_USER, NEXAH_PASSWORD)';
          console.error(`❌ [Nexah Provider]: ${err}`);
          return {
            success: false,
            message: err,
            provider: 'nexah',
            error: err,
          };
        }

        try {
          const mobiles = Array.isArray(to)
            ? to.map(formatPhoneNumber).join(',')
            : formatPhoneNumber(to);

          const payload = {
            user,
            password,
            senderid,
            sms: message,
            mobiles,
          };

          const response = await axios.post(apiUrl, payload, {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            timeout: 10000,
          });

          if (response.data) {
            if (Array.isArray(response.data)) {
              const ok = response.data.some((item: any) => item.status === 'success');
              return {
                success: ok,
                message: ok ? 'SMS envoyé avec succès via Nexah.' : 'Nexah a renvoyé un statut d\'échec.',
                provider: 'nexah',
              };
            }
            if (response.data.responsecode === 1 || response.data.status === 'success') {
              return {
                success: true,
                message: 'SMS envoyé avec succès via Nexah.',
                provider: 'nexah',
              };
            }
          }

          return {
            success: false,
            message: 'Nexah a renvoyé un statut d\'erreur.',
            provider: 'nexah',
          };
        } catch (error: any) {
          console.error('❌ Erreur lors de l\'envoi du SMS via Nexah :', error?.response?.data || error.message);
          return {
            success: false,
            message: 'Erreur réseau ou fournisseur lors de l\'envoi SMS.',
            provider: 'nexah',
            error: error?.message,
          };
        }
      }
    }
  }
}

export const defaultOtpProvider = new AppOtpProvider();
