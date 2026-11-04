import { Request, Response } from 'express';
import * as paymentService from '../../services/payment.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import type { AfribaPayWebhookPayload } from '../../types/afribapay.types.js';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function badRequest(message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function getBuyerIdFromRequest(req: Request): string {
  const buyerId = req.user?.buyerId ?? req.user?.id;
  if (!buyerId) {
    throw Object.assign(new Error('Identifiant acheteur manquant.'), { statusCode: 401 });
  }
  return buyerId;
}

export const listMethods = asyncHandler(async (req: Request, res: Response) => {
  const countryCode = req.query.countryCode;
  if (countryCode !== undefined && !isNonEmptyString(countryCode)) {
    throw badRequest('Le code pays fourni est invalide.');
  }

  const countries = await paymentService.getAvailablePaymentMethods(countryCode as string | undefined);
  res.status(200).json({ countries });
});

export const findPaymentForResource = asyncHandler(async (req: Request, res: Response) => {
  const { resourceType, resourceId } = req.query;
  if (
    (resourceType !== 'ORDER' && resourceType !== 'PREFINANCEMENT') ||
    !isNonEmptyString(resourceId)
  ) {
    throw badRequest('Le type et la référence du dossier sont obligatoires.');
  }

  const result = await paymentService.findPaymentForResource(
    getBuyerIdFromRequest(req),
    resourceType,
    resourceId,
  );
  res.status(200).json(result);
});

export const initiatePayment = asyncHandler(async (req: Request, res: Response) => {
  const input = parseInitiationRequest(req);
  const result = await paymentService.initiatePayment(getBuyerIdFromRequest(req), input);
  res.status(result.reused ? 200 : 202).json({ payment: result.payment });
});

export const requestPaymentOtp = asyncHandler(async (req: Request, res: Response) => {
  const input = parseInitiationRequest(req);
  const result = await paymentService.initiatePayment(getBuyerIdFromRequest(req), input, true);
  res.status(result.reused ? 200 : 202).json({ payment: result.payment });
});

export const confirmPaymentWithOtp = asyncHandler(async (req: Request, res: Response) => {
  const { phoneNumber, otpCode } = req.body ?? {};
  if (!isNonEmptyString(phoneNumber) || !isNonEmptyString(otpCode)) {
    throw badRequest('Le numéro de téléphone et le code OTP sont obligatoires.');
  }

  const result = await paymentService.confirmPaymentWithOtp(
    getBuyerIdFromRequest(req),
    req.params.paymentId,
    phoneNumber,
    otpCode,
  );
  res.status(202).json(result);
});

export const getPaymentStatus = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.getPaymentStatus(
    getBuyerIdFromRequest(req),
    req.params.paymentId,
  );
  res.status(200).json(result);
});

export const handleWebhook = asyncHandler(async (req: Request, res: Response) => {
  let payload: AfribaPayWebhookPayload = req.body ?? {};

  // Support des webhooks encodés en base64 (paramètre afp_data couramment utilisé par AfribaPay)
  if (typeof (req.body as any)?.afp_data === 'string') {
    try {
      const decodedJson = Buffer.from((req.body as any).afp_data, 'base64').toString('utf8');
      payload = JSON.parse(decodedJson);
    } catch {
      throw badRequest('Le payload afp_data encodé en base64 est invalide.');
    }
  }

  const secretHeader = (
    req.headers['x-afribapay-signature'] ??
    req.headers['x-webhook-secret'] ??
    req.query.secret
  ) as string | undefined;

  const result = await paymentService.handleAfribaPayWebhook(payload, secretHeader);
  res.status(200).json(result);
});

function parseInitiationRequest(req: Request) {
  const { resourceType, resourceId, countryCode, operator, phoneNumber } = req.body ?? {};
  if (
    (resourceType !== 'ORDER' && resourceType !== 'PREFINANCEMENT') ||
    !isNonEmptyString(resourceId) ||
    !isNonEmptyString(countryCode) ||
    !isNonEmptyString(operator) ||
    !isNonEmptyString(phoneNumber)
  ) {
    throw badRequest('Le type de dossier, sa référence, le pays, l’opérateur et le téléphone sont obligatoires.');
  }

  return { resourceType, resourceId, countryCode, operator, phoneNumber };
}
