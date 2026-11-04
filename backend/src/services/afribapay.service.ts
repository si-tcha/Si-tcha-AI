import axios from 'axios';
import type {
  AfribaPayConfiguration,
  AfribaPayCountry,
  AfribaPayInitiatePayinInput,
  AfribaPayOperator,
  AfribaPayProviderObject,
  AfribaPayRequestOtpInput,
  AfribaPayTokenData,
  AfribaPayTransaction,
} from '../types/afribapay.types.js';

const SANDBOX_API_HOST = 'api-sandbox.afribapay.com';
const REQUEST_TIMEOUT_MS = 15_000;

let cachedToken: { value: string; expiresAt: number } | undefined;

export function resetTokenCacheForTesting(): void {
  cachedToken = undefined;
}

function serviceError(message: string, statusCode: number): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

function getOptionalHttpsUrl(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value) return undefined;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw serviceError(`${name} doit être une URL HTTPS valide.`, 503);
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw serviceError(`${name} doit être une URL HTTPS valide sans identifiants intégrés.`, 503);
  }
  return url.toString();
}

function getProviderErrorDetail(data: unknown): string | undefined {
  let detail: unknown;
  if (typeof data === 'string') {
    detail = data;
  } else if (data && typeof data === 'object' && !Array.isArray(data)) {
    const body = data as Record<string, unknown>;
    detail = body.message ?? body.error_description ?? body.error ?? body.detail;
  }

  if (typeof detail !== 'string') return undefined;
  const sanitized = detail
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/(?:authorization|access_token|token|secret|password|merchant_key|phone_number|otp_code)\s*[:=]\s*\S+/gi, '[redacted]')
    .trim()
    .slice(0, 240);
  return sanitized || undefined;
}

function getProviderError(error: unknown, operation: string): Error & { statusCode: number } {
  const isAxios =
    axios.isAxiosError(error) ||
    Boolean(error && typeof error === 'object' && (error as any).isAxiosError);

  if (isAxios) {
    const axiosErr = error as any;
    const status = axiosErr.response?.status;
    if (status === 401 || status === 403) {
      return serviceError(
        `AfribaPay a refusé l’authentification pendant ${operation} (HTTP ${status}). Vérifiez AFRIBAPAY_PUBLIC_API_USER et AFRIBAPAY_API_SECRET_KEY avec les valeurs sandbox.`,
        502,
      );
    }

    if (status) {
      const detail = getProviderErrorDetail(axiosErr.response?.data);
      return serviceError(
        `AfribaPay a répondu avec une erreur HTTP ${status} pendant ${operation}.${detail ? ` Détail fournisseur : ${detail}.` : ''} Vérifiez l’URL sandbox, les paramètres du marchand et le corps de la requête.`,
        502,
      );
    }

    const networkCode = axiosErr.code;
    if (networkCode === 'ENOTFOUND' || networkCode === 'EAI_AGAIN') {
      return serviceError(
        `Le nom de domaine AfribaPay sandbox est introuvable pendant ${operation}. Vérifiez le réseau et l’URL sandbox.`,
        502,
      );
    }
    if (networkCode === 'ECONNABORTED' || networkCode === 'ETIMEDOUT') {
      return serviceError(
        `La connexion à AfribaPay sandbox a expiré pendant ${operation}. Vérifiez le réseau puis réessayez.`,
        502,
      );
    }
    if (networkCode) {
      return serviceError(
        `La connexion à AfribaPay sandbox a échoué pendant ${operation} (${networkCode}). Vérifiez le réseau et la configuration serveur.`,
        502,
      );
    }
  }

  return serviceError(`Impossible de joindre AfribaPay sandbox pendant ${operation}.`, 502);
}

export function getConfiguration(): AfribaPayConfiguration {
  if (process.env.AFRIBAPAY_ENABLED !== 'true') {
    throw serviceError('Le paiement AfribaPay sandbox est désactivé.', 503);
  }

  const {
    AFRIBAPAY_PUBLIC_API_USER,
    AFRIBAPAY_API_SECRET_KEY,
    AFRIBAPAY_MERCHANT_KEY,
    AFRIBAPAY_PAYIN_URL,
  } = process.env;
  if (
    !AFRIBAPAY_PUBLIC_API_USER ||
    !AFRIBAPAY_API_SECRET_KEY ||
    !AFRIBAPAY_MERCHANT_KEY ||
    !AFRIBAPAY_PAYIN_URL
  ) {
    throw serviceError('La configuration AfribaPay sandbox est incomplète.', 503);
  }

  let payinUrl: URL;
  try {
    payinUrl = new URL(AFRIBAPAY_PAYIN_URL);
  } catch {
    throw serviceError('AFRIBAPAY_PAYIN_URL doit être une URL HTTPS valide du sandbox.', 503);
  }
  if (
    payinUrl.protocol !== 'https:' ||
    payinUrl.hostname !== SANDBOX_API_HOST ||
    payinUrl.pathname.replace(/\/+$/, '') !== '/v1/pay/payin' ||
    payinUrl.search ||
    payinUrl.hash
  ) {
    throw serviceError(
      'AFRIBAPAY_PAYIN_URL doit pointer vers https://api-sandbox.afribapay.com/v1/pay/payin.',
      503,
    );
  }

  return {
    publicApiUser: AFRIBAPAY_PUBLIC_API_USER,
    apiSecretKey: AFRIBAPAY_API_SECRET_KEY,
    merchantKey: AFRIBAPAY_MERCHANT_KEY,
    payinUrl: payinUrl.toString(),
    apiBaseUrl: `${payinUrl.origin}/v1`,
    returnUrl: getOptionalHttpsUrl('AFRIBAPAY_RETURN_URL'),
    cancelUrl: getOptionalHttpsUrl('AFRIBAPAY_CANCEL_URL'),
    notifyUrl: getOptionalHttpsUrl('AFRIBAPAY_NOTIFY_URL'),
  };
}

function getObject(value: unknown): AfribaPayProviderObject | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as AfribaPayProviderObject;
  }
  return undefined;
}

function getResponseData(response: unknown): AfribaPayProviderObject | undefined {
  const root = getObject(response);
  const data = getObject(root?.data);
  if (data) return data;

  if (Array.isArray(root?.data)) {
    return getObject(root.data[0]);
  }

  return root;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function getProviderFee(data: AfribaPayProviderObject | undefined): string | undefined {
  const fee = data?.fees_taxes_ttc ?? data?.fees;
  const amount = typeof fee === 'number' ? String(fee) : getString(fee);
  if (!amount || !/^\d+(\.\d{1,2})?$/.test(amount)) return undefined;
  return amount;
}

function normalizeOperators(country: AfribaPayProviderObject): AfribaPayOperator[] {
  const operatorData =
    country.operators ??
    country.mobile_money_operators ??
    country.payment_operators;

  if (!Array.isArray(operatorData)) return [];

  return operatorData.flatMap((entry): AfribaPayOperator[] => {
    if (typeof entry === 'string') {
      return [{ code: entry, name: entry, requiresOtp: false, instructions: '' }];
    }

    const operator = getObject(entry);
    if (!operator) return [];

    const code =
      getString(operator.operator_code) ??
      getString(operator.operator) ??
      getString(operator.code) ??
      getString(operator.slug);
    if (!code) return [];

    return [{
      code,
      name:
        getString(operator.operator_name) ??
        getString(operator.name) ??
        getString(operator.label) ??
        code,
      requiresOtp:
        operator.otp_required === true ||
        operator.otp_required === 1 ||
        operator.otp_required === '1' ||
        operator.requires_otp === true,
      instructions: getString(operator.ussd_code) ?? '',
    }];
  });
}

export async function getAfribaPayAccessToken(): Promise<string> {
  const configuration = getConfiguration();
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  try {
    const response = await axios.post(
      `${configuration.apiBaseUrl}/token`,
      '',
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(
            `${configuration.publicApiUser}:${configuration.apiSecretKey}`,
            'utf8',
          ).toString('base64')}`,
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
    );
    const rawTokenData = getResponseData(response.data);
    const token = getString(rawTokenData?.access_token);
    if (!rawTokenData || !token) {
      throw serviceError('AfribaPay n’a pas fourni de jeton d’accès valide.', 502);
    }

    const tokenData: AfribaPayTokenData = {
      access_token: token,
      expires_in:
        typeof rawTokenData.expires_in === 'number' ||
        typeof rawTokenData.expires_in === 'string'
          ? rawTokenData.expires_in
          : undefined,
      expires_at: getString(rawTokenData.expires_at),
      token_type: getString(rawTokenData.token_type),
    };
    const expiresIn = Number(tokenData.expires_in);
    const lifetimeMs = Number.isFinite(expiresIn) && expiresIn > 0
      ? expiresIn * 1000
      : 23 * 60 * 60 * 1000;
    cachedToken = { value: token, expiresAt: now + lifetimeMs };
    return token;
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) throw error;
    throw getProviderError(error, 'la demande du jeton');
  }
}

function normalizeCountry(
  value: unknown,
  currencyValue?: unknown,
  currencyCode?: string,
): AfribaPayCountry | undefined {
  const country = getObject(value);
  if (!country) return undefined;

  const countryCode = getString(country.country_code);
  const countryName = getString(country.country_name);
  const currencyData = getObject(currencyValue);
  const currency = getString(currencyData?.currency) ?? getString(country.currency) ?? currencyCode;
  if (!countryCode || !countryName || !currency) return undefined;

  return {
    countryCode: countryCode.toUpperCase(),
    countryName,
    currency: currency.toUpperCase(),
    prefix: getString(country.prefix) ?? '',
    operators: normalizeOperators(currencyData ?? country),
  };
}

export async function listPaymentMethods(): Promise<AfribaPayCountry[]> {
  const token = await getAfribaPayAccessToken();
  const configuration = getConfiguration();
  try {
    const response = await axios.get(`${configuration.apiBaseUrl}/countries`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: REQUEST_TIMEOUT_MS,
    });
    const root = getObject(response.data);
    const data = root?.data;
    const countriesObject = getObject(data);
    const countryList = Array.isArray(data)
      ? data.map((country) => [undefined, country] as const)
      : countriesObject
        ? Object.entries(countriesObject)
        : undefined;

    if (!countryList) {
      throw serviceError('La liste des moyens de paiement AfribaPay est invalide.', 502);
    }

    return countryList.flatMap(([, countryValue]) => {
      const country = getObject(countryValue);
      if (!country) return [];

      const currencies = getObject(country.currencies);
      if (!currencies) {
        const normalized = normalizeCountry(country);
        return normalized ? [normalized] : [];
      }

      return Object.entries(currencies).flatMap(([currencyCode, currencyValue]) => {
        const normalized = normalizeCountry(country, currencyValue, currencyCode);
        return normalized ? [normalized] : [];
      });
    });
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) throw error;
    throw getProviderError(error, 'la récupération des pays et opérateurs');
  }
}

export async function initiatePayin(
  input: AfribaPayInitiatePayinInput,
): Promise<AfribaPayTransaction> {
  const configuration = getConfiguration();
  const token = await getAfribaPayAccessToken();

  try {
    const response = await axios.post(
      configuration.payinUrl,
      {
        operator: input.operator,
        country: input.country,
        phone_number: input.phoneNumber,
        amount: input.amount,
        currency: input.currency,
        order_id: input.orderId,
        merchant_key: configuration.merchantKey,
        reference_id: input.referenceId,
        lang: 'fr',
        ...(input.returnUrl ?? configuration.returnUrl
          ? { return_url: input.returnUrl ?? configuration.returnUrl }
          : {}),
        ...(input.cancelUrl ?? configuration.cancelUrl
          ? { cancel_url: input.cancelUrl ?? configuration.cancelUrl }
          : {}),
        ...(input.notifyUrl ?? configuration.notifyUrl
          ? { notify_url: input.notifyUrl ?? configuration.notifyUrl }
          : {}),
        ...(input.otpCode ? { otp_code: input.otpCode } : {}),
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
    );
    const data = getResponseData(response.data);
    const providerLink = getString(data?.provider_link);
    let providerLinkSafe: string | undefined;
    if (providerLink) {
      try {
        const parsed = new URL(providerLink);
        if (parsed.protocol === 'https:') {
          providerLinkSafe = parsed.toString();
        }
      } catch {}
    }

    return {
      transactionId: getString(data?.transaction_id),
      status: getString(data?.status)?.toUpperCase(),
      providerFee: getProviderFee(data),
      providerLink: providerLinkSafe,
    };
  } catch (error) {
    throw getProviderError(error, 'le démarrage du paiement');
  }
}

export async function requestPayinOtp(input: AfribaPayRequestOtpInput): Promise<void> {
  const configuration = getConfiguration();
  const token = await getAfribaPayAccessToken();

  try {
    await axios.post(
      `${configuration.apiBaseUrl}/pay/otp`,
      {
        operator: input.operator,
        country: input.country,
        phone_number: input.phoneNumber,
        amount: input.amount,
        currency: input.currency,
        merchant_key: configuration.merchantKey,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: REQUEST_TIMEOUT_MS,
      },
    );
  } catch (error) {
    throw getProviderError(error, 'la demande du code OTP');
  }
}

export async function getPayinStatus(
  orderId: string,
  transactionId?: string | null,
): Promise<AfribaPayTransaction> {
  const configuration = getConfiguration();
  const token = await getAfribaPayAccessToken();
  const params = transactionId
    ? { transaction_id: transactionId }
    : { order_id: orderId };

  try {
    const response = await axios.get(`${configuration.apiBaseUrl}/status`, {
      headers: { Authorization: `Bearer ${token}` },
      params,
      timeout: REQUEST_TIMEOUT_MS,
    });
    const data = getResponseData(response.data);
    return {
      transactionId: getString(data?.transaction_id),
      status: getString(data?.status)?.toUpperCase(),
      providerFee: getProviderFee(data),
    };
  } catch (error) {
    throw getProviderError(error, 'la vérification du statut');
  }
}
