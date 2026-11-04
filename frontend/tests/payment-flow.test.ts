import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../src/services/api';
import {
  confirmPaymentWithOtp,
  findPaymentForResource,
  getPaymentMethods,
  getPaymentStatus,
  isMobileMoneyAvailableForCart,
  initiatePayment,
  PaymentCountryMethods,
  PaymentRecordDto,
  pollPaymentStatusUntilFinal,
  requestPaymentOtp,
} from '../src/services/payment';
import { OrderStatus } from '../src/services/database.shared';

describe('Parcours Mobile Paiement AfribaPay (Frontend)', () => {
  let requestMock: any;

  beforeEach(() => {
    requestMock = vi.spyOn(api, 'request');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('autorise Mobile Money uniquement pour un panier produisant une seule commande', () => {
    expect(isMobileMoneyAvailableForCart(1)).toBe(true);
    expect(isMobileMoneyAvailableForCart(0)).toBe(false);
    expect(isMobileMoneyAvailableForCart(2)).toBe(false);
  });

  describe('Client API AfribaPay (services/payment.ts)', () => {
    it('getPaymentMethods doit interroger GET /payments/methods avec le code pays encodé', async () => {
      const mockMethods: { countries: PaymentCountryMethods[] } = {
        countries: [
          {
            countryCode: 'CM',
            countryName: 'Cameroon',
            currency: 'XAF',
            prefix: '237',
            operators: [
              { code: 'orange', name: 'Orange Money', requiresOtp: true, instructions: '*150*...#' },
              { code: 'mtn', name: 'MTN Mobile Money', requiresOtp: false, instructions: '' },
            ],
          },
        ],
      };
      requestMock.mockResolvedValueOnce(mockMethods);

      const result = await getPaymentMethods('CM');
      expect(requestMock).toHaveBeenCalledWith('/payments/methods?countryCode=CM');
      expect(result.countries[0].countryCode).toBe('CM');
      expect(result.countries[0].operators).toHaveLength(2);
      expect(result.countries[0].operators[0].requiresOtp).toBe(true);
      expect(result.countries[0].operators[1].requiresOtp).toBe(false);
    });

    it('findPaymentForResource doit interroger GET /payments avec resourceType et resourceId', async () => {
      const mockPayment: PaymentRecordDto = {
        id: '12',
        type: 'ORDER',
        status: 'PENDING',
        amount: '15000',
        currency: 'XAF',
        reference: 'order-12',
        providerTransactionId: 'afp-123',
        paymentLink: null,
        operator: 'mtn',
        countryCode: 'CM',
        phoneNumberMasked: '****0000',
        createdAt: '2026-11-04T05:00:00.000Z',
        updatedAt: '2026-11-04T05:00:00.000Z',
      };
      requestMock.mockResolvedValueOnce({ payment: mockPayment });

      const result = await findPaymentForResource('ORDER', '12');
      expect(requestMock).toHaveBeenCalledWith('/payments?resourceType=ORDER&resourceId=12');
      expect(result.payment?.id).toBe('12');
      expect(result.payment?.status).toBe('PENDING');
    });

    it('initiatePayment doit envoyer POST /payments avec le payload requis', async () => {
      const mockPayment: PaymentRecordDto = {
        id: '15',
        type: 'ORDER',
        status: 'PENDING',
        amount: '20000',
        currency: 'XAF',
        reference: 'order-15',
        providerTransactionId: 'afp-999',
        paymentLink: null,
        operator: 'mtn',
        countryCode: 'CM',
        phoneNumberMasked: '****1111',
        createdAt: '2026-11-04T05:00:00.000Z',
        updatedAt: '2026-11-04T05:00:00.000Z',
      };
      requestMock.mockResolvedValueOnce({ payment: mockPayment });

      const input = {
        resourceType: 'ORDER' as const,
        resourceId: '15',
        countryCode: 'CM',
        operator: 'mtn',
        phoneNumber: '670000000',
      };
      const result = await initiatePayment(input);

      expect(requestMock).toHaveBeenCalledWith('/payments', 'POST', input);
      expect(result.payment.status).toBe('PENDING');
    });

    it('requestPaymentOtp doit envoyer POST /payments/otp pour opérateur exigeant OTP', async () => {
      const mockPayment: PaymentRecordDto = {
        id: '20',
        type: 'ORDER',
        status: 'AWAITING_OTP',
        amount: '10000',
        currency: 'XAF',
        reference: 'order-20',
        providerTransactionId: null,
        paymentLink: null,
        operator: 'orange',
        countryCode: 'CM',
        phoneNumberMasked: '****2222',
        createdAt: '2026-11-04T05:00:00.000Z',
        updatedAt: '2026-11-04T05:00:00.000Z',
      };
      requestMock.mockResolvedValueOnce({ payment: mockPayment });

      const input = {
        resourceType: 'ORDER' as const,
        resourceId: '20',
        countryCode: 'CM',
        operator: 'orange',
        phoneNumber: '690000000',
      };
      const result = await requestPaymentOtp(input);

      expect(requestMock).toHaveBeenCalledWith('/payments/otp', 'POST', input);
      expect(result.payment.status).toBe('AWAITING_OTP');
    });

    it('confirmPaymentWithOtp doit envoyer POST /payments/:id/confirm avec le code OTP', async () => {
      const mockPayment: PaymentRecordDto = {
        id: '20',
        type: 'ORDER',
        status: 'PENDING',
        amount: '10000',
        currency: 'XAF',
        reference: 'order-20',
        providerTransactionId: 'afp-orange-123',
        paymentLink: null,
        operator: 'orange',
        countryCode: 'CM',
        phoneNumberMasked: '****2222',
        createdAt: '2026-11-04T05:00:00.000Z',
        updatedAt: '2026-11-04T05:00:00.000Z',
      };
      requestMock.mockResolvedValueOnce({ payment: mockPayment });

      const result = await confirmPaymentWithOtp('20', {
        phoneNumber: '690000000',
        otpCode: '4567',
      });

      expect(requestMock).toHaveBeenCalledWith('/payments/20/confirm', 'POST', {
        phoneNumber: '690000000',
        otpCode: '4567',
      });
      expect(result.payment.status).toBe('PENDING');
    });

    it('getPaymentStatus doit interroger GET /payments/:id/status', async () => {
      const mockPayment: PaymentRecordDto = {
        id: '25',
        type: 'ORDER',
        status: 'SUCCESS',
        amount: '12000',
        currency: 'XAF',
        reference: 'order-25',
        providerTransactionId: 'afp-succ-1',
        paymentLink: null,
        operator: 'mtn',
        countryCode: 'CM',
        phoneNumberMasked: '****3333',
        createdAt: '2026-11-04T05:00:00.000Z',
        updatedAt: '2026-11-04T05:00:00.000Z',
      };
      requestMock.mockResolvedValueOnce({ payment: mockPayment, status: 'SUCCESS' });

      const result = await getPaymentStatus('25');
      expect(requestMock).toHaveBeenCalledWith('/payments/25/status');
      expect(result.status).toBe('SUCCESS');
    });
  });

  describe('Sondage de statut (pollPaymentStatusUntilFinal)', () => {
    it('doit s’arrêter immédiatement si le statut initial est SUCCESS', async () => {
      const successPayment: PaymentRecordDto = {
        id: '30',
        type: 'ORDER',
        status: 'SUCCESS',
        amount: '5000',
        currency: 'XAF',
        reference: 'order-30',
        providerTransactionId: 'tx-30',
        paymentLink: null,
        operator: 'mtn',
        countryCode: 'CM',
        phoneNumberMasked: '****4444',
        createdAt: '2026-11-04T05:00:00.000Z',
        updatedAt: '2026-11-04T05:00:00.000Z',
      };
      requestMock.mockResolvedValueOnce({ payment: successPayment, status: 'SUCCESS' });

      const onUpdate = vi.fn();
      const result = await pollPaymentStatusUntilFinal('30', { onUpdate, intervalMs: 10 });

      expect(result.status).toBe('SUCCESS');
      expect(requestMock).toHaveBeenCalledTimes(1);
      expect(onUpdate).toHaveBeenCalledWith('SUCCESS', successPayment);
    });

    it('doit s’arrêter immédiatement si le statut initial est FAILED', async () => {
      const failedPayment: PaymentRecordDto = {
        id: '31',
        type: 'ORDER',
        status: 'FAILED',
        amount: '5000',
        currency: 'XAF',
        reference: 'order-31',
        providerTransactionId: 'tx-31',
        paymentLink: null,
        operator: 'orange',
        countryCode: 'CM',
        phoneNumberMasked: '****5555',
        createdAt: '2026-11-04T05:00:00.000Z',
        updatedAt: '2026-11-04T05:00:00.000Z',
      };
      requestMock.mockResolvedValueOnce({ payment: failedPayment, status: 'FAILED' });

      const onUpdate = vi.fn();
      const result = await pollPaymentStatusUntilFinal('31', { onUpdate, intervalMs: 10 });

      expect(result.status).toBe('FAILED');
      expect(requestMock).toHaveBeenCalledTimes(1);
      expect(onUpdate).toHaveBeenCalledWith('FAILED', failedPayment);
    });

    it('doit sonder et s’arrêter lorsque le statut passe de PENDING à SUCCESS', async () => {
      const pendingPayment: PaymentRecordDto = {
        id: '32',
        type: 'ORDER',
        status: 'PENDING',
        amount: '7500',
        currency: 'XAF',
        reference: 'order-32',
        providerTransactionId: 'tx-32',
        paymentLink: null,
        operator: 'mtn',
        countryCode: 'CM',
        phoneNumberMasked: '****6666',
        createdAt: '2026-11-04T05:00:00.000Z',
        updatedAt: '2026-11-04T05:00:00.000Z',
      };
      const successPayment: PaymentRecordDto = {
        ...pendingPayment,
        status: 'SUCCESS',
      };

      // 1er appel: PENDING, 2ème appel: SUCCESS
      requestMock
        .mockResolvedValueOnce({ payment: pendingPayment, status: 'PENDING' })
        .mockResolvedValueOnce({ payment: successPayment, status: 'SUCCESS' });

      const onUpdate = vi.fn();
      const result = await pollPaymentStatusUntilFinal('32', {
        maxAttempts: 5,
        intervalMs: 10,
        onUpdate,
      });

      expect(result.status).toBe('SUCCESS');
      expect(requestMock).toHaveBeenCalledTimes(2);
      expect(onUpdate).toHaveBeenCalledTimes(2);
      expect(onUpdate).toHaveBeenNthCalledWith(1, 'PENDING', pendingPayment);
      expect(onUpdate).toHaveBeenNthCalledWith(2, 'SUCCESS', successPayment);
    });
  });

  describe('Types de statuts commandes et compatibilité', () => {
    it('le type OrderStatus doit inclure payee et paiement_echoue', () => {
      const validStatuses: OrderStatus[] = [
        'en_attente',
        'confirmee',
        'livree',
        'annulee',
        'payee',
        'paiement_echoue',
      ];
      expect(validStatuses).toHaveLength(6);
    });
  });
});
