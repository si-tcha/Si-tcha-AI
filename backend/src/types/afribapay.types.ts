export type AfribaPayConfiguration = {
  publicApiUser: string;
  apiSecretKey: string;
  merchantKey: string;
  payinUrl: string;
  apiBaseUrl: string;
  returnUrl?: string;
  cancelUrl?: string;
  notifyUrl?: string;
};

export type AfribaPayProviderObject = Record<string, unknown>;

export type AfribaPayTokenData = {
  access_token: string;
  token_type?: string;
  expires_in?: number | string;
  expires_at?: string;
};

export type AfribaPayApiResponse<T> = {
  request_id?: string;
  request_time?: number;
  data?: T;
};

export type AfribaPayOperator = {
  code: string;
  name: string;
  requiresOtp: boolean;
  instructions: string;
};

export type AfribaPayCountry = {
  countryCode: string;
  countryName: string;
  currency: string;
  prefix: string;
  operators: AfribaPayOperator[];
};

export type AfribaPayTransaction = {
  transactionId?: string;
  status?: string;
  providerLink?: string;
  providerFee?: string;
};

export type AfribaPayInitiatePayinInput = {
  operator: string;
  country: string;
  phoneNumber: string;
  amount: number;
  currency: string;
  orderId: string;
  referenceId: string;
  returnUrl?: string;
  cancelUrl?: string;
  notifyUrl?: string;
  otpCode?: string;
};

export type AfribaPayRequestOtpInput = {
  operator: string;
  country: string;
  phoneNumber: string;
  amount: number;
  currency: string;
};
