import { Request, Response } from 'express';
import * as paymentService from '../../services/payment.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function badRequest(message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode: 400 });
}

export const listMethods = asyncHandler(async (req: Request, res: Response) => {
  const countryCode = req.query.countryCode;
  if (countryCode !== undefined && !isNonEmptyString(countryCode)) {
    throw badRequest('Le code pays fourni est invalide.');
  }

  const countries = await paymentService.getAvailablePaymentMethods(countryCode);
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
    req.user!.id,
    resourceType,
    resourceId,
  );
  res.status(200).json(result);
});

export const initiatePayment = asyncHandler(async (req: Request, res: Response) => {
  const input = parseInitiationRequest(req);
  const result = await paymentService.initiatePayment(req.user!.id, input);
  res.status(result.reused ? 200 : 202).json({ payment: result.payment });
});

export const requestPaymentOtp = asyncHandler(async (req: Request, res: Response) => {
  const input = parseInitiationRequest(req);
  const result = await paymentService.initiatePayment(req.user!.id, input, true);
  res.status(result.reused ? 200 : 202).json({ payment: result.payment });
});

export const confirmPaymentWithOtp = asyncHandler(async (req: Request, res: Response) => {
  const { phoneNumber, otpCode } = req.body ?? {};
  if (!isNonEmptyString(phoneNumber) || !isNonEmptyString(otpCode)) {
    throw badRequest('Le numéro de téléphone et le code OTP sont obligatoires.');
  }

  const result = await paymentService.confirmPaymentWithOtp(
    req.user!.id,
    req.params.paymentId,
    phoneNumber,
    otpCode,
  );
  res.status(202).json(result);
});

export const getPaymentStatus = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.getPaymentStatus(req.user!.id, req.params.paymentId);
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
