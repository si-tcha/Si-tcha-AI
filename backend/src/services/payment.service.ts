import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Prisma, StatutPaiementAfribaPay } from '../generated/prisma/index.js';
import prisma from '../lib/prisma.js';
import {
  getPayinStatus,
  initiatePayin,
  listPaymentMethods,
  requestPayinOtp,
} from './afribapay.service.js';
import type { AfribaPayCountry } from '../types/afribapay.types.js';

export type PaymentResourceType = 'ORDER' | 'PREFINANCEMENT';

export type InitiatePaymentInput = {
  resourceType: PaymentResourceType;
  resourceId: string;
  countryCode: string;
  operator: string;
  phoneNumber: string;
};

type PaymentRecord = Prisma.PaiementAfribaPayGetPayload<Record<string, never>>;

function serviceError(message: string, statusCode: number): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

function normalizePhone(phoneNumber: string): string {
  const phone = phoneNumber.replace(/[\s()+.-]/g, '');
  if (!/^\d{7,15}$/.test(phone)) {
    throw serviceError('Le numéro de téléphone fourni est invalide.', 400);
  }
  return phone;
}

function getFingerprint(input: InitiatePaymentInput, phoneNumber: string): string {
  const secret = process.env.PAYMENT_OTP_FINGERPRINT_SECRET;
  if (!secret || secret.length < 32) {
    throw serviceError(
      'Une clé serveur PAYMENT_OTP_FINGERPRINT_SECRET de 32 caractères minimum est requise pour le parcours OTP.',
      503,
    );
  }

  return createHmac('sha256', secret)
    .update([
      input.resourceType,
      input.resourceId,
      input.countryCode.toUpperCase(),
      input.operator.toLowerCase(),
      phoneNumber,
    ].join('|'))
    .digest('hex');
}

function toIntegerAmount(amount: Prisma.Decimal): number {
  if (!amount.isFinite() || !amount.isInteger() || amount.lte(0) || amount.gt(Number.MAX_SAFE_INTEGER)) {
    throw serviceError(
      'Le montant enregistré doit être un montant positif en XAF sans décimales.',
      422,
    );
  }
  return amount.toNumber();
}

function getSettlementAmounts(payment: PaymentRecord, providerFee?: string) {
  const grossMargin = payment.montant
    .mul(payment.tauxMargeBrute)
    .div(100)
    .toDecimalPlaces(2);
  const providerFeeAmount = providerFee
    ? new Prisma.Decimal(providerFee)
    : payment.fraisAfribaPay;

  return {
    montantMargeBrute: grossMargin,
    montantBaseRedistribution: payment.montant.minus(grossMargin).toDecimalPlaces(2),
    margeReelleSitcha: providerFeeAmount
      ? grossMargin.minus(providerFeeAmount).toDecimalPlaces(2)
      : null,
  };
}

function toPaymentResponse(payment: PaymentRecord, status: string = payment.statut) {
  return {
    id: payment.id,
    type: payment.type,
    status,
    amount: payment.montant.toString(),
    currency: payment.devise,
    reference: payment.orderId,
    providerTransactionId: payment.providerTransactionId,
    paymentLink: payment.providerLink,
    operator: payment.operateur,
    countryCode: payment.pays,
    phoneNumberMasked: `****${payment.telephoneSuffixe}`,
    createdAt: payment.dateCreation.toISOString(),
    updatedAt: payment.dateMaj.toISOString(),
  };
}

async function assertVerifiedBuyer(acheteurId: string): Promise<void> {
  const buyer = await prisma.acheteur.findUnique({
    where: { id: acheteurId },
    select: { isVerified: true },
  });
  if (!buyer?.isVerified) {
    throw serviceError('Un compte acheteur vérifié est requis pour effectuer un paiement.', 403);
  }
}

function getCameroonMethod(
  methods: AfribaPayCountry[],
  countryCode: string,
  operatorCode: string,
): { country: AfribaPayCountry; requiresOtp: boolean } {
  const country = methods.find((method) => method.countryCode === countryCode.toUpperCase());
  if (!country || country.currency !== 'XAF') {
    throw serviceError('Ce pays ou cette devise n’est pas disponible pour ce paiement.', 400);
  }

  if (countryCode.toUpperCase() !== 'CM') {
    throw serviceError('Les paiements disponibles pour ce compte sont limités au Cameroun.', 400);
  }

  const operator = country.operators.find(
    (availableOperator) => availableOperator.code.toLowerCase() === operatorCode.toLowerCase(),
  );
  if (!operator) {
    throw serviceError('Cet opérateur n’est pas disponible dans le pays sélectionné.', 400);
  }

  return { country, requiresOtp: operator.requiresOtp };
}

export async function getAvailablePaymentMethods(countryCode?: string) {
  const countries = await listPaymentMethods();
  const cameroon = countries.filter((country) => country.countryCode === 'CM' && country.currency === 'XAF');
  return countryCode
    ? cameroon.filter((country) => country.countryCode === countryCode.toUpperCase())
    : cameroon;
}

async function getPayableAmount(
  client: Prisma.TransactionClient,
  acheteurId: string,
  input: InitiatePaymentInput,
): Promise<Prisma.Decimal> {
  if (input.resourceType === 'ORDER') {
    const transaction = await client.transactionAcheteur.findFirst({
      where: { id: input.resourceId, acheteurId },
      select: {
        quantite: true,
        prixConvenu: true,
        statut: true,
        recolteOffre: { select: { quantiteDisponible: true } },
      },
    });
    if (!transaction) {
      throw serviceError('La commande est introuvable ou ne vous appartient pas.', 404);
    }
    const status = transaction.statut
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();
    if (['PAID', 'PAYE', 'SUCCESS', 'SUCCES', 'CANCELLED', 'ANNULE'].includes(status)) {
      throw serviceError('Cette commande ne peut plus recevoir de paiement.', 409);
    }
    if (transaction.quantite.gt(transaction.recolteOffre.quantiteDisponible)) {
      throw serviceError('Le stock disponible ne permet plus de payer cette commande.', 409);
    }
    return transaction.quantite.mul(transaction.prixConvenu);
  }

  const prefinancement = await client.prefinancement.findFirst({
    where: { id: input.resourceId, acheteurId },
    select: { montantValeur: true },
  });
  if (!prefinancement) {
    throw serviceError('Le dossier de préfinancement est introuvable ou ne vous appartient pas.', 404);
  }
  return prefinancement.montantValeur;
}

export async function initiatePayment(
  acheteurId: string,
  input: InitiatePaymentInput,
  otpFlow = false,
) {
  await assertVerifiedBuyer(acheteurId);
  const phoneNumber = normalizePhone(input.phoneNumber);
  const countryCode = input.countryCode.toUpperCase();
  const normalizedInput = { ...input, countryCode };
  const phoneFingerprint = otpFlow
    ? getFingerprint(normalizedInput, phoneNumber)
    : undefined;

  const methods = await listPaymentMethods();
  const { country, requiresOtp } = getCameroonMethod(methods, countryCode, input.operator);
  if (requiresOtp !== otpFlow) {
    throw serviceError(
      requiresOtp
        ? 'Cet opérateur requiert un code de validation. Utilisez le parcours OTP.'
        : 'Cet opérateur ne requiert pas de code OTP. Utilisez le parcours de paiement standard.',
      400,
    );
  }

  let payment: PaymentRecord;
  let created = false;
  try {
    const result = await prisma.$transaction(async (tx) => {
      if (input.resourceType === 'ORDER') {
        await tx.$queryRaw`SELECT "id" FROM "TransactionAcheteur" WHERE "id" = ${input.resourceId} AND "acheteurId" = ${acheteurId} FOR UPDATE`;
      } else {
        await tx.$queryRaw`SELECT "id" FROM "Prefinancement" WHERE "id" = ${input.resourceId} AND "acheteurId" = ${acheteurId} FOR UPDATE`;
      }

      const activeWhere: Prisma.PaiementAfribaPayWhereInput = {
        acheteurId,
        statut: {
          in: [
            StatutPaiementAfribaPay.AWAITING_OTP,
            StatutPaiementAfribaPay.PENDING,
            StatutPaiementAfribaPay.SUCCESS,
          ],
        },
        ...(input.resourceType === 'ORDER'
          ? { transactionAcheteurId: input.resourceId }
          : { prefinancementId: input.resourceId }),
      };
      const activePayment = await tx.paiementAfribaPay.findFirst({ where: activeWhere });
      if (activePayment) return { payment: activePayment, created: false };

      const amount = toIntegerAmount(await getPayableAmount(tx, acheteurId, normalizedInput));
      const createdPayment = await tx.paiementAfribaPay.create({
        data: {
          acheteurId,
          transactionAcheteurId: input.resourceType === 'ORDER' ? input.resourceId : null,
          prefinancementId: input.resourceType === 'PREFINANCEMENT' ? input.resourceId : null,
          requestFingerprint: phoneFingerprint ?? null,
          orderId: `sitcha-${randomUUID()}`,
          type: input.resourceType,
          montant: amount,
          devise: country.currency,
          pays: country.countryCode,
          operateur: input.operator,
          telephoneSuffixe: phoneNumber.slice(-4),
          statut: otpFlow ? StatutPaiementAfribaPay.AWAITING_OTP : StatutPaiementAfribaPay.PENDING,
        },
      });
      if (input.resourceType === 'ORDER') {
        await tx.transactionAcheteur.update({
          where: { id: input.resourceId },
          data: { statut: 'paiement_en_cours' },
        });
      }
      return { payment: createdPayment, created: true };
    });
    payment = result.payment;
    created = result.created;
  } catch (error) {
    const activePayment = await prisma.paiementAfribaPay.findFirst({
      where: {
        acheteurId,
        statut: {
          in: [
            StatutPaiementAfribaPay.AWAITING_OTP,
            StatutPaiementAfribaPay.PENDING,
            StatutPaiementAfribaPay.SUCCESS,
          ],
        },
        ...(input.resourceType === 'ORDER'
          ? { transactionAcheteurId: input.resourceId }
          : { prefinancementId: input.resourceId }),
      },
    });
    if (activePayment) return { payment: toPaymentResponse(activePayment), reused: true };
    throw error;
  }

  if (!created) {
    return { payment: toPaymentResponse(payment), reused: true };
  }

  const amount = Number(payment.montant.toString());
  if (otpFlow) {
    try {
      await requestPayinOtp({
        operator: payment.operateur,
        country: payment.pays,
        phoneNumber,
        amount,
        currency: payment.devise,
      });
    } catch (error) {
      await prisma.$transaction(async (tx) => {
        await tx.paiementAfribaPay.update({
          where: { id: payment.id },
          data: {
            statut: StatutPaiementAfribaPay.FAILED,
            requestFingerprint: null,
          },
        });
        if (payment.transactionAcheteurId) {
          await tx.transactionAcheteur.updateMany({
            where: { id: payment.transactionAcheteurId, acheteurId },
            data: { statut: 'paiement_echoue' },
          });
        }
      });
      throw error;
    }
    return { payment: toPaymentResponse(payment), reused: false };
  }

  const providerResult = await initiatePayin({
    operator: payment.operateur,
    country: payment.pays,
    phoneNumber,
    amount,
    currency: payment.devise,
    orderId: payment.orderId,
    referenceId: payment.id,
  });

  const updatedPayment = await prisma.paiementAfribaPay.update({
    where: { id: payment.id },
    data: {
      providerTransactionId: providerResult.transactionId,
      providerLink: providerResult.providerLink,
      fraisAfribaPay: providerResult.providerFee
        ? new Prisma.Decimal(providerResult.providerFee)
        : undefined,
    },
  });

  return { payment: toPaymentResponse(updatedPayment), reused: false };
}

export async function getPaymentStatus(acheteurId: string, paymentId: string) {
  const payment = await prisma.paiementAfribaPay.findFirst({
    where: { id: paymentId, acheteurId },
  });
  if (!payment) {
    throw serviceError('Paiement introuvable.', 404);
  }

  if (payment.statut !== 'PENDING') {
    return { payment: toPaymentResponse(payment), status: payment.statut };
  }

  let providerStatus;
  try {
    providerStatus = await getPayinStatus(payment.orderId, payment.providerTransactionId);
  } catch {
    return { payment: toPaymentResponse(payment, 'UNKNOWN'), status: 'UNKNOWN' as const };
  }

  const status = providerStatus.status;
  if (status !== 'SUCCESS' && status !== 'FAILED' && status !== 'PENDING') {
    return { payment: toPaymentResponse(payment, 'UNKNOWN'), status: 'UNKNOWN' as const };
  }

  const providerFee = providerStatus.providerFee ?? payment.fraisAfribaPay?.toString();
  await prisma.$transaction(async (tx) => {
    const updated = await tx.paiementAfribaPay.updateMany({
      where: { id: payment.id, statut: 'PENDING' },
      data: {
        statut: status,
        providerTransactionId: providerStatus.transactionId ?? payment.providerTransactionId,
        fraisAfribaPay: providerStatus.providerFee
          ? new Prisma.Decimal(providerStatus.providerFee)
          : undefined,
        ...(status === 'SUCCESS' ? getSettlementAmounts(payment, providerFee) : {}),
      },
    });
    if (updated.count && payment.transactionAcheteurId) {
      await tx.transactionAcheteur.updateMany({
        where: { id: payment.transactionAcheteurId, acheteurId },
        data: { statut: status === 'SUCCESS' ? 'payee' : 'paiement_echoue' },
      });
    }
  });
  const currentPayment = await prisma.paiementAfribaPay.findUniqueOrThrow({ where: { id: payment.id } });
  return { payment: toPaymentResponse(currentPayment), status: currentPayment.statut };
}

export async function findPaymentForResource(
  acheteurId: string,
  resourceType: PaymentResourceType,
  resourceId: string,
) {
  const payment = await prisma.paiementAfribaPay.findFirst({
    where: {
      acheteurId,
      ...(resourceType === 'ORDER'
        ? { transactionAcheteurId: resourceId }
        : { prefinancementId: resourceId }),
    },
    orderBy: { dateCreation: 'desc' },
  });
  return payment ? { payment: toPaymentResponse(payment) } : { payment: null };
}

export async function confirmPaymentWithOtp(
  acheteurId: string,
  paymentId: string,
  phoneNumberInput: string,
  otpCode: string,
) {
  const payment = await prisma.paiementAfribaPay.findFirst({
    where: { id: paymentId, acheteurId },
  });
  if (!payment) throw serviceError('Paiement introuvable.', 404);
  if (payment.statut !== 'AWAITING_OTP') {
    throw serviceError('Ce paiement n’attend pas de code de validation.', 409);
  }

  await assertVerifiedBuyer(acheteurId);
  const phoneNumber = normalizePhone(phoneNumberInput);
  const resourceType = payment.transactionAcheteurId
    ? 'ORDER'
    : payment.prefinancementId
      ? 'PREFINANCEMENT'
      : undefined;
  const resourceId = payment.transactionAcheteurId ?? payment.prefinancementId;
  if (!resourceId || !resourceType) {
    throw serviceError('Le dossier associé au paiement est invalide.', 409);
  }
  const fingerprint = getFingerprint({
    resourceType,
    resourceId,
    countryCode: payment.pays,
    operator: payment.operateur,
    phoneNumber,
  }, phoneNumber);
  if (!payment.requestFingerprint) {
    throw serviceError('Le numéro de ce paiement OTP ne peut pas être vérifié. Recommencez la demande de code.', 409);
  }
  const expected = Buffer.from(payment.requestFingerprint, 'hex');
  const received = Buffer.from(fingerprint, 'hex');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw serviceError('Le numéro doit être identique à celui utilisé pour demander le code.', 400);
  }

  if (!/^\d{4,10}$/.test(otpCode)) {
    throw serviceError('Le code de validation fourni est invalide.', 400);
  }

  const transitioned = await prisma.paiementAfribaPay.updateMany({
    where: { id: payment.id, statut: StatutPaiementAfribaPay.AWAITING_OTP },
    data: {
      statut: StatutPaiementAfribaPay.PENDING,
      requestFingerprint: null,
    },
  });
  if (!transitioned.count) {
    throw serviceError('La validation de ce paiement est déjà en cours.', 409);
  }

  const providerResult = await initiatePayin({
    operator: payment.operateur,
    country: payment.pays,
    phoneNumber,
    amount: Number(payment.montant.toString()),
    currency: payment.devise,
    orderId: payment.orderId,
    referenceId: payment.id,
    otpCode,
  });
  const updatedPayment = await prisma.paiementAfribaPay.update({
    where: { id: payment.id },
    data: {
      providerTransactionId: providerResult.transactionId,
      providerLink: providerResult.providerLink,
      fraisAfribaPay: providerResult.providerFee
        ? new Prisma.Decimal(providerResult.providerFee)
        : undefined,
    },
  });
  return { payment: toPaymentResponse(updatedPayment) };
}
