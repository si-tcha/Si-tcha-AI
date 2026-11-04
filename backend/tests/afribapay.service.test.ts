import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import {
  getConfiguration,
  getAfribaPayAccessToken,
  listPaymentMethods,
  initiatePayin,
  requestPayinOtp,
  getPayinStatus,
  resetTokenCacheForTesting,
} from '../src/services/afribapay.service.js';

vi.mock('axios');

describe('AfribaPay Service — Sandbox Client & Security', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    resetTokenCacheForTesting();
    process.env = {
      ...originalEnv,
      AFRIBAPAY_ENABLED: 'true',
      AFRIBAPAY_PUBLIC_API_USER: 'test_user',
      AFRIBAPAY_API_SECRET_KEY: 'test_secret',
      AFRIBAPAY_MERCHANT_KEY: 'test_merchant',
      AFRIBAPAY_PAYIN_URL: 'https://api-sandbox.afribapay.com/v1/pay/payin',
      PAYMENT_OTP_FINGERPRINT_SECRET: 'test_fingerprint_secret_min_32_characters_12345',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('fails if AFRIBAPAY_ENABLED is false or unset', () => {
    process.env.AFRIBAPAY_ENABLED = 'false';
    expect(() => getConfiguration()).toThrow('désactivé');
  });

  it('fails if AFRIBAPAY_PAYIN_URL does not point to sandbox', () => {
    process.env.AFRIBAPAY_PAYIN_URL = 'https://api.afribapay.com/v1/pay/payin';
    expect(() => getConfiguration()).toThrow('https://api-sandbox.afribapay.com/v1/pay/payin');
  });

  it('fetches and caches OAuth access token', async () => {
    (axios.post as any).mockResolvedValueOnce({
      data: {
        data: {
          access_token: 'sandbox_token_123',
          expires_in: 3600,
        },
      },
    });

    const token1 = await getAfribaPayAccessToken();
    expect(token1).toBe('sandbox_token_123');

    // Le second appel doit réutiliser le cache et ne pas rappeler axios.post
    const token2 = await getAfribaPayAccessToken();
    expect(token2).toBe('sandbox_token_123');
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it('redacts sensitive information in error messages', async () => {
    const error: any = new Error('Request failed with status code 400');
    error.isAxiosError = true;
    error.response = {
      status: 400,
      data: {
        message: 'Invalid request: secret=super_secret_123 and access_token=tok_456 were rejected',
      },
    };
    (axios.post as any).mockRejectedValueOnce(error);

    await expect(getAfribaPayAccessToken()).rejects.toThrow(/\[redacted\]/);
    await expect(getAfribaPayAccessToken()).rejects.not.toThrow(/super_secret_123/);
  });

  it('normalizes countries and operators for Cameroon', async () => {
    (axios.post as any).mockResolvedValueOnce({
      data: { data: { access_token: 'tok' } },
    });
    (axios.get as any).mockResolvedValueOnce({
      data: {
        data: {
          CM: {
            country_code: 'CM',
            country_name: 'Cameroon',
            currency: 'XAF',
            prefix: '237',
            operators: [
              {
                code: 'orange',
                name: 'Orange',
                otp_required: true,
                ussd_code: '#150#',
              },
              {
                code: 'mtn',
                name: 'MTN',
                otp_required: false,
              },
            ],
          },
        },
      },
    });

    const countries = await listPaymentMethods();
    expect(countries).toHaveLength(1);
    expect(countries[0].countryCode).toBe('CM');
    expect(countries[0].currency).toBe('XAF');
    expect(countries[0].operators).toHaveLength(2);
    expect(countries[0].operators[0].requiresOtp).toBe(true);
    expect(countries[0].operators[1].requiresOtp).toBe(false);
  });

  it('initiates payin successfully', async () => {
    (axios.post as any)
      .mockResolvedValueOnce({ data: { data: { access_token: 'tok' } } }) // token
      .mockResolvedValueOnce({
        data: {
          data: {
            transaction_id: 'tx_sandbox_001',
            status: 'PENDING',
            fees: '150.00',
            provider_link: 'https://sandbox-checkout.afribapay.com/pay',
          },
        },
      });

    const result = await initiatePayin({
      operator: 'mtn',
      country: 'CM',
      phoneNumber: '237670000000',
      amount: 5000,
      currency: 'XAF',
      orderId: 'sitcha-order-1',
      referenceId: '1',
    });

    expect(result.transactionId).toBe('tx_sandbox_001');
    expect(result.status).toBe('PENDING');
    expect(result.providerFee).toBe('150.00');
    expect(result.providerLink).toBe('https://sandbox-checkout.afribapay.com/pay');
  });

  it('requests payin OTP successfully', async () => {
    (axios.post as any)
      .mockResolvedValueOnce({ data: { data: { access_token: 'tok' } } }) // token
      .mockResolvedValueOnce({ data: { success: true } }); // otp

    await expect(
      requestPayinOtp({
        operator: 'orange',
        country: 'CM',
        phoneNumber: '237690000000',
        amount: 5000,
        currency: 'XAF',
      }),
    ).resolves.not.toThrow();
  });

  it('retrieves payin status accurately', async () => {
    (axios.post as any).mockResolvedValueOnce({ data: { data: { access_token: 'tok' } } });
    (axios.get as any).mockResolvedValueOnce({
      data: {
        data: {
          transaction_id: 'tx_sandbox_001',
          status: 'SUCCESS',
          fees: '150.00',
        },
      },
    });

    const status = await getPayinStatus('sitcha-order-1', 'tx_sandbox_001');
    expect(status.status).toBe('SUCCESS');
    expect(status.transactionId).toBe('tx_sandbox_001');
  });
});
