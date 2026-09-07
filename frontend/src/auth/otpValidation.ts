/**
 * Validation et normalisation strictes des paramètres de routage OTP (production).
 * Empêche tout fallback implicite ou transformation de rôle invalide en 'buyer'.
 */

export type ValidOtpRole = 'buyer' | 'seller';

export interface ValidatedOtpParams {
  phone: string;
  role: ValidOtpRole;
}

export type OtpParamsValidationResult =
  | { isValid: true; params: ValidatedOtpParams }
  | { isValid: false; error: string };

export function normalizeRouteParam(param: string | string[] | undefined | null): string | undefined {
  if (Array.isArray(param)) {
    const first = param[0];
    return typeof first === 'string' && first.trim().length > 0 ? first.trim() : undefined;
  }
  if (typeof param === 'string') {
    const trimmed = param.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

export function validateOtpParams(
  rawPhone: string | string[] | undefined | null,
  rawRole: string | string[] | undefined | null
): OtpParamsValidationResult {
  const phone = normalizeRouteParam(rawPhone);
  const role = normalizeRouteParam(rawRole);

  if (!phone) {
    return {
      isValid: false,
      error: 'Numéro de téléphone manquant ou invalide.',
    };
  }

  if (role !== 'buyer' && role !== 'seller') {
    return {
      isValid: false,
      error: 'Rôle utilisateur manquant ou non autorisé. Seuls "buyer" et "seller" sont acceptés.',
    };
  }

  return {
    isValid: true,
    params: {
      phone,
      role,
    },
  };
}
