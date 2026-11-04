import { request } from './api';

export type PaymentResourceType = 'ORDER' | 'PREFINANCEMENT';

export type PaymentStatus = 'AWAITING_OTP' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'UNKNOWN';

/** AfribaPay settles one order at a time; a cart can create several orders. */
export function isMobileMoneyAvailableForCart(itemCount: number): boolean {
  return Number.isInteger(itemCount) && itemCount === 1;
}

export interface PaymentOperator {
  code: string;
  name: string;
  requiresOtp: boolean;
  instructions: string;
}

export interface PaymentCountryMethods {
  countryCode: string;
  countryName: string;
  currency: string;
  prefix: string;
  operators: PaymentOperator[];
}

export interface PaymentRecordDto {
  id: string;
  type: PaymentResourceType;
  status: PaymentStatus;
  amount: string;
  currency: string;
  reference: string;
  providerTransactionId: string | null;
  paymentLink: string | null;
  operator: string;
  countryCode: string;
  phoneNumberMasked: string;
  createdAt: string;
  updatedAt: string;
}

export interface InitiatePaymentInput {
  resourceType: PaymentResourceType;
  resourceId: string;
  countryCode: string;
  operator: string;
  phoneNumber: string;
}

export interface ConfirmPaymentWithOtpInput {
  phoneNumber: string;
  otpCode: string;
}

/**
 * Récupère les méthodes et opérateurs de paiement disponibles.
 */
export async function getPaymentMethods(countryCode = 'CM'): Promise<{ countries: PaymentCountryMethods[] }> {
  return request<{ countries: PaymentCountryMethods[] }>(`/payments/methods?countryCode=${encodeURIComponent(countryCode)}`);
}

/**
 * Recherche le paiement le plus récent associé à une ressource (commande ou préfinancement).
 */
export async function findPaymentForResource(
  resourceType: PaymentResourceType,
  resourceId: string
): Promise<{ payment: PaymentRecordDto | null }> {
  return request<{ payment: PaymentRecordDto | null }>(
    `/payments?resourceType=${encodeURIComponent(resourceType)}&resourceId=${encodeURIComponent(resourceId)}`
  );
}

/**
 * Initie un paiement Mobile Money standard (sans code OTP préalable).
 */
export async function initiatePayment(input: InitiatePaymentInput): Promise<{ payment: PaymentRecordDto }> {
  return request<{ payment: PaymentRecordDto }>('/payments', 'POST', input);
}

/**
 * Demande l'envoi / la génération d'un code OTP pour un opérateur qui l'exige.
 */
export async function requestPaymentOtp(input: InitiatePaymentInput): Promise<{ payment: PaymentRecordDto }> {
  return request<{ payment: PaymentRecordDto }>('/payments/otp', 'POST', input);
}

/**
 * Confirme et valide un paiement en attente d'OTP avec le code saisi.
 */
export async function confirmPaymentWithOtp(
  paymentId: string,
  input: ConfirmPaymentWithOtpInput
): Promise<{ payment: PaymentRecordDto }> {
  return request<{ payment: PaymentRecordDto }>(`/payments/${encodeURIComponent(paymentId)}/confirm`, 'POST', input);
}

/**
 * Interroge le statut d'un paiement en cours auprès du serveur et du fournisseur.
 */
export async function getPaymentStatus(
  paymentId: string
): Promise<{ payment: PaymentRecordDto; status: PaymentStatus }> {
  return request<{ payment: PaymentRecordDto; status: PaymentStatus }>(
    `/payments/${encodeURIComponent(paymentId)}/status`
  );
}

export interface PollPaymentOptions {
  maxAttempts?: number;
  intervalMs?: number;
  onUpdate?: (status: PaymentStatus, payment: PaymentRecordDto) => void;
}

/**
 * Sonde l'état d'un paiement jusqu'à obtention d'un état final (SUCCESS, FAILED) ou épuisement du délai.
 */
export async function pollPaymentStatusUntilFinal(
  paymentId: string,
  options: PollPaymentOptions = {}
): Promise<{ payment: PaymentRecordDto; status: PaymentStatus }> {
  const maxAttempts = options.maxAttempts ?? 15;
  const intervalMs = options.intervalMs ?? 3000;

  let lastResult = await getPaymentStatus(paymentId);
  options.onUpdate?.(lastResult.status, lastResult.payment);

  if (lastResult.status === 'SUCCESS' || lastResult.status === 'FAILED') {
    return lastResult;
  }

  for (let attempt = 1; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    try {
      lastResult = await getPaymentStatus(paymentId);
      options.onUpdate?.(lastResult.status, lastResult.payment);

      if (lastResult.status === 'SUCCESS' || lastResult.status === 'FAILED') {
        return lastResult;
      }
    } catch {
      // Poursuivre le sondage si une requête réseau temporaire échoue
    }
  }

  return lastResult;
}
