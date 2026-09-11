import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
// @ts-ignore
import { renderToString } from 'react-dom/server';
import { dbService as webDbService } from '../src/services/database.web';
import { cartStore, useCart } from '../src/services/cart-store';
import {
  apiClient,
  ApiError,
  saveSession,
  clearSession,
  readStoredSession,
  request,
  _resetSessionMutationSeqForTesting,
  _resetMemorySessionForTesting,
} from '../src/services/api';
import { useAuthProviderState, AuthSessionCoordinator } from '../src/context/AuthContext';
import {
  useBuyerOrdersCoordinator,
  useBuyerAlertsCoordinator,
  useBuyerCheckoutCoordinator,
  useBuyerHomeCoordinator,
  BuyerOrdersCoordinator,
  BuyerAlertsCoordinator,
  BuyerCheckoutCoordinator,
  BuyerHomeCoordinator,
} from '../src/hooks/useBuyerCoordinators';
import {
  STORAGE_KEYS,
  CartItemRecord,
  isValidBuyerId,
  validateBuyerId,
  isValidBuyerStorageKey,
  STRICT_BUYER_ID_REGEX,
  BUYER_CART_KEY_PREFIX,
  BUYER_ORDERS_KEY_PREFIX,
  BUYER_CLIENT_REQ_KEY_PREFIX,
  BUYER_ALERT_PREFS_KEY_PREFIX,
} from '../src/services/database.shared';

describe('BLOC 3 — Parcours Acheteur : Panier, Idempotence & Commandes Réelles', () => {
  const sampleProduct1 = {
    productId: '101',
    name: 'Régime de Plantain Gros Michel',
    price: '3500',
    unit: 'régime',
  };

  const sampleProduct2 = {
    productId: '102',
    name: 'Manioc Frais de Bafoussam',
    price: '1200',
    unit: 'sac',
  };

  const defaultBuyerId = '1001';

  beforeEach(async () => {
    localStorage.clear();
    webDbService.setActiveBuyerId(defaultBuyerId);
    await cartStore.setBuyerId(defaultBuyerId);
    await webDbService.clearCart();
    await cartStore.clearCart();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    webDbService.setActiveBuyerId(null);
    cartStore.reset();
    vi.restoreAllMocks();
  });

  describe('0. Rejet systématique des opérations privées sans acheteur actif (requireActiveBuyerId)', () => {
    it('refuse toute opération sur le panier Web si aucun acheteur actif n’est défini', async () => {
      webDbService.setActiveBuyerId(null);

      await expect(webDbService.getCart()).rejects.toThrow(/Opération non autorisée/);
      await expect(webDbService.getCartCount()).rejects.toThrow(/Opération non autorisée/);
      await expect(webDbService.getCartTotal()).rejects.toThrow(/Opération non autorisée/);
      await expect(webDbService.getCartClientRequestId()).rejects.toThrow(/Opération non autorisée/);
      await expect(webDbService.getOrCreateCartClientRequestId()).rejects.toThrow(/Opération non autorisée/);
      await expect(webDbService.clearCart()).rejects.toThrow(/Opération non autorisée/);
      await expect(webDbService.addToCart(sampleProduct1)).rejects.toThrow(/Opération non autorisée/);
      await expect(webDbService.incrementCartItem(sampleProduct1.productId)).rejects.toThrow(/Opération non autorisée/);
      await expect(webDbService.decrementCartItem(sampleProduct1.productId)).rejects.toThrow(/Opération non autorisée/);
      await expect(webDbService.removeFromCart(sampleProduct1.productId)).rejects.toThrow(/Opération non autorisée/);
    });

    it('refuse toute opération sur les commandes et alertes Web si acheteur = "anonymous" ou blanc', async () => {
      expect(() => webDbService.setActiveBuyerId('anonymous')).toThrow(/Identifiant acheteur invalide/);
      expect(() => webDbService.setActiveBuyerId('   ')).toThrow(/Identifiant acheteur invalide/);
      webDbService.setActiveBuyerId(null);
      await expect(webDbService.getOrders()).rejects.toThrow(/Opération non autorisée/);
      await expect(webDbService.createOrderFromCart('commande_ferme')).rejects.toThrow(/Opération non autorisée/);
      await expect(webDbService.getAlertPreferences()).rejects.toThrow(/Opération non autorisée/);
      await expect(webDbService.saveAlertPreferences({ productNames: [], bassins: [] })).rejects.toThrow(/Opération non autorisée/);
      await expect(webDbService.getMatchingAlertCount()).rejects.toThrow(/Opération non autorisée/);
    });

    it('refuse toute opération privée en SQLite natif si aucun acheteur actif', async () => {
      // @ts-ignore
      const mod = await import('../src/services/database.ts');
      const native = mod.dbService;
      native.setActiveBuyerId(null);

      await expect(native.getCart()).rejects.toThrow(/Opération non autorisée/);
      await expect(native.getCartCount()).rejects.toThrow(/Opération non autorisée/);
      await expect(native.clearCart()).rejects.toThrow(/Opération non autorisée/);
      await expect(native.addToCart(sampleProduct1)).rejects.toThrow(/Opération non autorisée/);
      await expect(native.getOrders()).rejects.toThrow(/Opération non autorisée/);
      await expect(native.createOrderFromCart('commande_ferme')).rejects.toThrow(/Opération non autorisée/);
      await expect(native.getAlertPreferences()).rejects.toThrow(/Opération non autorisée/);
      await expect(native.saveAlertPreferences({ productNames: [], bassins: [] })).rejects.toThrow(/Opération non autorisée/);
      await expect(native.getMatchingAlertCount()).rejects.toThrow(/Opération non autorisée/);
    });
  });

  describe('1. Persistance et Opérations du Panier (Web localStorage)', () => {
    it('ajoute un article au panier avec une quantité initiale de 1', async () => {
      const item = await webDbService.addToCart(sampleProduct1);
      expect(item.productId).toBe('101');
      expect(item.quantity).toBe(1);

      const cart = await webDbService.getCart();
      expect(cart).toHaveLength(1);
      expect(cart[0].productId).toBe('101');
      expect(cart[0].quantity).toBe(1);

      const count = await webDbService.getCartCount();
      expect(count).toBe(1);
    });

    it('incrémente la quantité lors d’un second ajout du même produit', async () => {
      await webDbService.addToCart(sampleProduct1);
      const updated = await webDbService.addToCart(sampleProduct1);

      expect(updated.quantity).toBe(2);
      const cart = await webDbService.getCart();
      expect(cart).toHaveLength(1);
      expect(cart[0].quantity).toBe(2);
      expect(await webDbService.getCartCount()).toBe(2);
    });

    it('incrémente explicitement un article avec incrementCartItem', async () => {
      await webDbService.addToCart(sampleProduct1);
      const updated = await webDbService.incrementCartItem(sampleProduct1.productId);

      expect(updated).not.toBeNull();
      expect(updated?.quantity).toBe(2);
      expect(await webDbService.getCartCount()).toBe(2);
    });

    it('décrémente un article avec decrementCartItem sans le supprimer si quantité > 1', async () => {
      await webDbService.addToCart(sampleProduct1);
      await webDbService.incrementCartItem(sampleProduct1.productId);
      expect(await webDbService.getCartCount()).toBe(2);

      const updated = await webDbService.decrementCartItem(sampleProduct1.productId);
      expect(updated).not.toBeNull();
      expect(updated?.quantity).toBe(1);
      expect(await webDbService.getCartCount()).toBe(1);
    });

    it('supprime automatiquement l’article lorsque decrementCartItem atteint 0', async () => {
      await webDbService.addToCart(sampleProduct1);
      expect(await webDbService.getCartCount()).toBe(1);

      const updated = await webDbService.decrementCartItem(sampleProduct1.productId);
      expect(updated).toBeNull();
      expect(await webDbService.getCart()).toHaveLength(0);
      expect(await webDbService.getCartCount()).toBe(0);
    });

    it('supprime un article spécifique avec removeFromCart', async () => {
      await webDbService.addToCart(sampleProduct1);
      await webDbService.addToCart(sampleProduct2);
      expect(await webDbService.getCartCount()).toBe(2);

      await webDbService.removeFromCart(sampleProduct1.productId);
      const cart = await webDbService.getCart();
      expect(cart).toHaveLength(1);
      expect(cart[0].productId).toBe(sampleProduct2.productId);
      expect(await webDbService.getCartCount()).toBe(1);
    });

    it('vide entièrement le panier avec clearCart', async () => {
      await webDbService.addToCart(sampleProduct1);
      await webDbService.addToCart(sampleProduct2);
      expect(await webDbService.getCartCount()).toBe(2);

      await webDbService.clearCart();
      expect(await webDbService.getCart()).toHaveLength(0);
      expect(await webDbService.getCartCount()).toBe(0);
      expect(await webDbService.getCartTotal()).toBe(0);
    });

    it('calcule correctement le montant total du panier (getCartTotal)', async () => {
      await webDbService.addToCart(sampleProduct1); // 3500 x 1
      await webDbService.addToCart(sampleProduct1); // 3500 x 2 = 7000
      await webDbService.addToCart(sampleProduct2); // 1200 x 1 = 1200

      const total = await webDbService.getCartTotal();
      expect(total).toBe(8200);
    });
  });

  describe('2. Limitation par le stock disponible (quantiteDisponible)', () => {
    it('refuse d’ajouter un produit avec un stock disponible nul ou inférieur à 1', async () => {
      await expect(webDbService.addToCart(sampleProduct1, 0)).rejects.toThrow(
        /Stock indisponible/
      );
      expect(await webDbService.getCart()).toHaveLength(0);
    });

    it('refuse d’incrémenter au-delà du stock disponible dans addToCart', async () => {
      const maxStock = 2;
      await webDbService.addToCart(sampleProduct1, maxStock); // qty = 1
      await webDbService.addToCart(sampleProduct1, maxStock); // qty = 2

      await expect(webDbService.addToCart(sampleProduct1, maxStock)).rejects.toThrow(
        /Stock maximum atteint/
      );
      const cart = await webDbService.getCart();
      expect(cart[0].quantity).toBe(2);
    });

    it('refuse d’incrémenter au-delà du stock dans incrementCartItem', async () => {
      const maxStock = 1;
      await webDbService.addToCart(sampleProduct1, maxStock);

      await expect(
        webDbService.incrementCartItem(sampleProduct1.productId, maxStock)
      ).rejects.toThrow(/Stock maximum atteint/);

      const cart = await webDbService.getCart();
      expect(cart[0].quantity).toBe(1);
    });
  });

  describe('3. Cycle de vie de la clé d’idempotence (sitcha_cart_client_request_id)', () => {
    it('génère un identifiant UUID et le conserve entre plusieurs appels identiques', async () => {
      await webDbService.addToCart(sampleProduct1);

      const key1 = await webDbService.getOrCreateCartClientRequestId();
      expect(key1).toBeDefined();
      expect(typeof key1).toBe('string');
      expect(key1.length).toBeGreaterThan(10);

      const key2 = await webDbService.getOrCreateCartClientRequestId();
      expect(key2).toBe(key1);
    });

    it('invalide la clé d’idempotence dès qu’un article est ajouté ou incrémenté', async () => {
      await webDbService.addToCart(sampleProduct1);
      const key1 = await webDbService.getOrCreateCartClientRequestId();

      // Modification du panier -> invalidation de la clé
      await webDbService.addToCart(sampleProduct2);
      const storedKey = await webDbService.getCartClientRequestId();
      expect(storedKey).toBeNull();

      const key2 = await webDbService.getOrCreateCartClientRequestId();
      expect(key2).not.toBe(key1);
    });

    it('invalide la clé d’idempotence dès qu’un article est décrémenté ou retiré', async () => {
      await webDbService.addToCart(sampleProduct1);
      await webDbService.addToCart(sampleProduct1);
      const key1 = await webDbService.getOrCreateCartClientRequestId();

      await webDbService.decrementCartItem(sampleProduct1.productId);
      expect(await webDbService.getCartClientRequestId()).toBeNull();

      const key2 = await webDbService.getOrCreateCartClientRequestId();
      expect(key2).not.toBe(key1);

      await webDbService.removeFromCart(sampleProduct1.productId);
      expect(await webDbService.getCartClientRequestId()).toBeNull();
    });

    it('nettoie la clé d’idempotence lors du vidage du panier', async () => {
      await webDbService.addToCart(sampleProduct1);
      await webDbService.getOrCreateCartClientRequestId();
      expect(await webDbService.getCartClientRequestId()).not.toBeNull();

      await webDbService.clearCart();
      expect(await webDbService.getCartClientRequestId()).toBeNull();
    });
  });

  describe('4. Validation de commande atomique & Échecs (createOrderFromCart)', () => {
    it('passe la commande avec succès, nettoie le panier et synchronise les commandes', async () => {
      await webDbService.addToCart(sampleProduct1);
      const expectedRequestId = await webDbService.getOrCreateCartClientRequestId();

      const mockServerOrders = [
        {
          id: 'ord-100',
          type: 'commande_ferme',
          status: 'en_attente',
          productId: '101',
          productName: sampleProduct1.name,
          quantity: 1,
          unit: sampleProduct1.unit,
          price: sampleProduct1.price,
          gicName: 'GIC Partenaire',
          createdAt: new Date().toISOString(),
        },
      ];

      const createSpy = vi.spyOn(apiClient, 'createOrder').mockResolvedValueOnce({
        orders: mockServerOrders,
      });

      const getSpy = vi.spyOn(apiClient, 'getOrders').mockResolvedValueOnce({
        orders: mockServerOrders,
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });

      const result = await webDbService.createOrderFromCart('commande_ferme');

      expect(createSpy).toHaveBeenCalledWith(
        'commande_ferme',
        [{ productId: '101', quantity: 1 }],
        expectedRequestId
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ord-100');

      // Le panier local et la clé d'idempotence doivent être nettoyés
      expect(await webDbService.getCart()).toHaveLength(0);
      expect(await webDbService.getCartClientRequestId()).toBeNull();
    });

    it('NE VIDE PAS le panier et NE CRÉE AUCUNE fausse commande locale lors d’une erreur réseau', async () => {
      await webDbService.addToCart(sampleProduct1);
      const keyBefore = await webDbService.getOrCreateCartClientRequestId();

      const networkError = new ApiError('Failed to fetch', 0);
      vi.spyOn(apiClient, 'createOrder').mockRejectedValueOnce(networkError);

      await expect(webDbService.createOrderFromCart('commande_ferme')).rejects.toThrow();

      // Panier strictement intact
      const cart = await webDbService.getCart();
      expect(cart).toHaveLength(1);
      expect(cart[0].productId).toBe('101');
      expect(cart[0].quantity).toBe(1);

      // Clé d'idempotence conservée pour le retry
      const keyAfter = await webDbService.getCartClientRequestId();
      expect(keyAfter).toBe(keyBefore);

      // Aucune commande factice insérée localement
      const orders = await webDbService.getOrders(false);
      expect(orders).toHaveLength(0);
    });

    it('NE VIDE PAS le panier lors d’un conflit 409 de stock épuisé', async () => {
      await webDbService.addToCart(sampleProduct1);
      const keyBefore = await webDbService.getOrCreateCartClientRequestId();

      const stockError = new ApiError('Stock insuffisant pour ce produit', 409);
      vi.spyOn(apiClient, 'createOrder').mockRejectedValueOnce(stockError);

      await expect(webDbService.createOrderFromCart('commande_ferme')).rejects.toThrow(
        /Stock insuffisant/
      );

      // Panier intact et pas de fausse commande
      expect(await webDbService.getCart()).toHaveLength(1);
      expect(await webDbService.getCartClientRequestId()).toBe(keyBefore);
      expect(await webDbService.getOrders(false)).toHaveLength(0);
    });

    it('réutilise le même clientRequestId lors d’une retentative (retry) après un échec réseau', async () => {
      await webDbService.addToCart(sampleProduct1);
      const requestId = await webDbService.getOrCreateCartClientRequestId();

      // 1er appel : échec réseau
      const createSpy = vi
        .spyOn(apiClient, 'createOrder')
        .mockRejectedValueOnce(new ApiError('Network request failed', 0));

      await expect(webDbService.createOrderFromCart('commande_ferme')).rejects.toThrow();

      expect(createSpy).toHaveBeenLastCalledWith('commande_ferme', [{ productId: '101', quantity: 1 }], requestId);

      // 2ème appel : succès avec le MÊME requestId
      createSpy.mockResolvedValueOnce({
        orders: [{ id: 'ord-200', type: 'commande_ferme', status: 'en_attente', productId: '101', productName: 'Plantain', quantity: 1, unit: 'régime', price: '3500', gicName: 'GIC', createdAt: new Date().toISOString() }],
      });
      vi.spyOn(apiClient, 'getOrders').mockResolvedValueOnce({
        orders: [{ id: 'ord-200', type: 'commande_ferme', status: 'en_attente', productId: '101', productName: 'Plantain', quantity: 1, unit: 'régime', price: '3500', gicName: 'GIC', createdAt: new Date().toISOString() }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });

      const res = await webDbService.createOrderFromCart('commande_ferme');
      expect(createSpy).toHaveBeenLastCalledWith('commande_ferme', [{ productId: '101', quantity: 1 }], requestId);
      expect(res).toHaveLength(1);
      expect(await webDbService.getCart()).toHaveLength(0);
    });

    it('conserve la commande créée et vide le panier même si le GET de synchronisation échoue (erreur réseau)', async () => {
      await webDbService.addToCart(sampleProduct1);
      const createdOrder = {
        id: 'ord-res-1',
        type: 'commande_ferme',
        status: 'en_attente',
        productId: '101',
        productName: sampleProduct1.name,
        quantity: 1,
        unit: sampleProduct1.unit,
        price: sampleProduct1.price,
        gicName: 'GIC Test',
        createdAt: new Date().toISOString(),
      };

      vi.spyOn(apiClient, 'createOrder').mockResolvedValueOnce({
        orders: [createdOrder],
      });
      // Le GET en tâche de fond échoue avec une coupure réseau
      vi.spyOn(apiClient, 'getOrders').mockRejectedValue(new ApiError('Coupure réseau', 0));

      const res = await webDbService.createOrderFromCart('commande_ferme');
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('ord-res-1');

      // Panier vidé et commande présente dans le cache local
      expect(await webDbService.getCart()).toHaveLength(0);
      const cached = await webDbService.getOrders(false);
      expect(cached).toHaveLength(1);
      expect(cached[0].id).toBe('ord-res-1');
    });

    it('conserve la commande créée et vide le panier même si le GET subséquent retourne 500', async () => {
      await webDbService.addToCart(sampleProduct1);
      const createdOrder = {
        id: 'ord-res-500',
        type: 'commande_ferme',
        status: 'en_attente',
        productId: '101',
        productName: sampleProduct1.name,
        quantity: 1,
        unit: sampleProduct1.unit,
        price: sampleProduct1.price,
        gicName: 'GIC Test',
        createdAt: new Date().toISOString(),
      };

      vi.spyOn(apiClient, 'createOrder').mockResolvedValueOnce({
        orders: [createdOrder],
      });
      vi.spyOn(apiClient, 'getOrders').mockRejectedValue(new ApiError('Erreur 500 sur GET', 500));

      const res = await webDbService.createOrderFromCart('commande_ferme');
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('ord-res-500');

      // Panier vidé
      expect(await webDbService.getCart()).toHaveLength(0);
      const cached = await webDbService.getOrders(false);
      expect(cached).toHaveLength(1);
      expect(cached[0].id).toBe('ord-res-500');
    });

    it('gère correctement le rejeu idempotent 200 en nettoyant le panier et enregistrant la commande', async () => {
      await webDbService.addToCart(sampleProduct1);
      const replayOrder = {
        id: 'ord-replay-200',
        type: 'commande_ferme',
        status: 'en_attente',
        productId: '101',
        productName: sampleProduct1.name,
        quantity: 1,
        unit: sampleProduct1.unit,
        price: sampleProduct1.price,
        gicName: 'GIC Test',
        createdAt: new Date().toISOString(),
      };

      vi.spyOn(apiClient, 'createOrder').mockResolvedValueOnce({
        orders: [replayOrder],
        idempotentReplay: true,
      });

      const res = await webDbService.createOrderFromCart('commande_ferme');
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('ord-replay-200');
      expect(await webDbService.getCart()).toHaveLength(0);
    });
  });

  describe('5. Historique des commandes et résilience hors-ligne (getOrders)', () => {
    it('met en cache les commandes du serveur et retourne le statut de synchronisation réussi', async () => {
      const serverOrders = [
        {
          id: 'ord-1',
          type: 'commande_ferme',
          status: 'confirmee',
          productId: '101',
          productName: 'Plantain',
          quantity: 5,
          unit: 'régime',
          price: '3500',
          gicName: 'GIC Ouest',
          createdAt: '2026-09-07T05:00:00.000Z',
        },
      ];

      vi.spyOn(apiClient, 'getOrders').mockResolvedValueOnce({
        orders: serverOrders,
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });

      const orders = await webDbService.getOrders(true);
      expect(orders).toHaveLength(1);
      expect(orders[0].id).toBe('ord-1');
      expect(orders[0].status).toBe('confirmee');
      expect(orders[0].createdAt).toBe('2026-09-07T05:00:00.000Z');
      expect(webDbService.isLastOrdersSyncSuccessful()).toBe(true);
    });

    it('récupère toutes les pages lors d’un historique volumineux sans troncature à 20 (pagination contrôlée)', async () => {
      const page1Orders = Array.from({ length: 20 }, (_, i) => ({
        id: `ord-p1-${i}`,
        type: 'commande_ferme',
        status: 'confirmee',
        productId: '101',
        productName: 'Plantain',
        quantity: 1,
        unit: 'kg',
        price: '500',
        gicName: 'GIC',
        createdAt: new Date(2026, 8, 1, 10, i).toISOString(),
      }));
      const page2Orders = Array.from({ length: 10 }, (_, i) => ({
        id: `ord-p2-${i}`,
        type: 'commande_ferme',
        status: 'confirmee',
        productId: '102',
        productName: 'Manioc',
        quantity: 2,
        unit: 'sac',
        price: '1200',
        gicName: 'GIC',
        createdAt: new Date(2026, 8, 2, 10, i).toISOString(),
      }));

      const getSpy = vi
        .spyOn(apiClient, 'getOrders')
        .mockResolvedValueOnce({
          orders: page1Orders,
          meta: { total: 30, page: 1, limit: 20, totalPages: 2 },
        })
        .mockResolvedValueOnce({
          orders: page2Orders,
          meta: { total: 30, page: 2, limit: 20, totalPages: 2 },
        });

      const orders = await webDbService.getOrders(true);
      expect(getSpy).toHaveBeenCalledTimes(2);
      expect(orders).toHaveLength(30);
    });

    it('conserve le cache local intact sans planter si le réseau échoue lors de getOrders(true)', async () => {
      // 1. Initialise avec un cache local préexistant
      const initialCache = [
        {
          id: 'ord-cached',
          type: 'reservation' as const,
          status: 'en_attente' as const,
          productId: '101',
          productName: 'Plantain',
          quantity: 2,
          unit: 'régime',
          price: '3500',
          gicName: 'GIC Partenaire',
          createdAt: '2026-09-06T10:00:00.000Z',
        },
      ];
      localStorage.setItem(webDbService.getOrdersKey(), JSON.stringify(initialCache));

      // 2. Simule une panne réseau lors de la synchronisation
      vi.spyOn(apiClient, 'getOrders').mockRejectedValueOnce(new ApiError('Pas de réseau', 0));

      const orders = await webDbService.getOrders(true);

      // Ne plante pas, retourne le cache local, et signale l'état de synchronisation
      expect(orders).toHaveLength(1);
      expect(orders[0].id).toBe('ord-cached');
      expect(webDbService.isLastOrdersSyncSuccessful()).toBe(false);

      // Le cache local n'a pas été effacé ou corrompu
      const rawStored = JSON.parse(localStorage.getItem(webDbService.getOrdersKey()) || '[]');
      expect(rawStored).toHaveLength(1);
    });

    it('propage l’erreur sans masquer en mode hors-ligne lors d’une erreur serveur (500 ou 401)', async () => {
      vi.spyOn(apiClient, 'getOrders').mockRejectedValueOnce(
        new ApiError('Erreur interne serveur', 500)
      );

      await expect(webDbService.getOrders(true)).rejects.toThrow('Erreur interne serveur');
      expect(webDbService.isLastOrdersSyncSuccessful()).toBe(false);
    });
  });

  describe('6. Synchronisation réactive via cartStore', () => {
    it('notifie les abonnés lors des ajouts, incrémentations et suppressions', async () => {
      let notificationCount = 0;
      const unsubscribe = cartStore.subscribe(() => {
        notificationCount++;
      });

      await cartStore.addToCart(sampleProduct1);
      expect(cartStore.getCart()).toHaveLength(1);
      expect(cartStore.getCount()).toBe(1);
      expect(cartStore.getTotalAmount()).toBe(3500);

      await cartStore.incrementCartItem(sampleProduct1.productId);
      expect(cartStore.getCount()).toBe(2);
      expect(cartStore.getTotalAmount()).toBe(7000);

      await cartStore.decrementCartItem(sampleProduct1.productId);
      expect(cartStore.getCount()).toBe(1);

      await cartStore.removeFromCart(sampleProduct1.productId);
      expect(cartStore.getCount()).toBe(0);
      expect(cartStore.getTotalAmount()).toBe(0);

      unsubscribe();
      expect(notificationCount).toBeGreaterThanOrEqual(4);
    });

    it('isole et réinitialise les données via setBuyerId et reset', async () => {
      webDbService.setActiveBuyerId('1001');
      await cartStore.setBuyerId('1001');
      await cartStore.addToCart(sampleProduct1);
      expect(cartStore.getCount()).toBe(1);

      // Changement de session vers buyer 1002
      webDbService.setActiveBuyerId('1002');
      await cartStore.setBuyerId('1002');
      expect(cartStore.getCount()).toBe(0);
      expect(cartStore.getCart()).toHaveLength(0);

      // Reconnexion de buyer 1001
      webDbService.setActiveBuyerId('1001');
      await cartStore.setBuyerId('1001');
      expect(cartStore.getCount()).toBe(1);
      expect(cartStore.getCart()[0].productId).toBe('101');

      // Déconnexion avec reset()
      cartStore.reset();
      expect(cartStore.getCount()).toBe(0);
      expect(cartStore.getCart()).toHaveLength(0);
    });
  });

  describe('7. Parité de comportement Natif SQLite (database.ts)', () => {
    // Import dynamique du service natif SQLite
    let nativeDbService: any;

    beforeEach(async () => {
      (globalThis as any).resetSqliteMock?.();
      // @ts-ignore - vitest needs explicit .ts to distinguish from database.web.ts
      const mod = await import('../src/services/database.ts');
      nativeDbService = mod.dbService;
      nativeDbService.setActiveBuyerId('2001');
      await nativeDbService.clearCart();
    });

    it('gère l’ajout, incrémentation, décrémentation et vidage en SQLite natif', async () => {
      const item = await nativeDbService.addToCart(sampleProduct1);
      expect(item.productId).toBe('101');
      expect(item.quantity).toBe(1);

      const cart = await nativeDbService.getCart();
      expect(cart).toHaveLength(1);
      expect(cart[0].productId).toBe('101');

      await nativeDbService.incrementCartItem(sampleProduct1.productId);
      expect(await nativeDbService.getCartCount()).toBe(2);

      await nativeDbService.decrementCartItem(sampleProduct1.productId);
      expect(await nativeDbService.getCartCount()).toBe(1);

      await nativeDbService.clearCart();
      expect(await nativeDbService.getCart()).toHaveLength(0);
      expect(await nativeDbService.getCartTotal()).toBe(0);
    });

    it('respecte le plafond de stock en SQLite natif', async () => {
      await nativeDbService.addToCart(sampleProduct1, 1);
      await expect(
        nativeDbService.incrementCartItem(sampleProduct1.productId, 1)
      ).rejects.toThrow(/Stock maximum atteint/);
    });

    it('gère la clé d’idempotence et conserve le panier lors d’un échec réseau en natif', async () => {
      await nativeDbService.addToCart(sampleProduct1);
      const keyBefore = await nativeDbService.getOrCreateCartClientRequestId();

      vi.spyOn(apiClient, 'createOrder').mockRejectedValueOnce(
        new ApiError('Network connection failed', 0)
      );

      await expect(nativeDbService.createOrderFromCart('commande_ferme')).rejects.toThrow();

      // Panier intact et même clé d'idempotence
      expect(await nativeDbService.getCart()).toHaveLength(1);
      expect(await nativeDbService.getCartClientRequestId()).toBe(keyBefore);

      // Aucune commande factice
      expect(await nativeDbService.getOrders(false)).toHaveLength(0);
    });
  });

  describe('8. Isolation stricte multi-utilisateurs par buyerId', () => {
    it('isole strictement les paniers entre deux acheteurs différents sur le Web', async () => {
      // Acheteur 1
      webDbService.setActiveBuyerId('1001');
      await webDbService.clearCart();
      await webDbService.addToCart(sampleProduct1);
      const reqId1 = await webDbService.getOrCreateCartClientRequestId();
      expect(await webDbService.getCartCount()).toBe(1);

      // Acheteur 2
      webDbService.setActiveBuyerId('1002');
      await webDbService.clearCart();
      expect(await webDbService.getCartCount()).toBe(0);
      expect(await webDbService.getCart()).toHaveLength(0);
      expect(await webDbService.getCartClientRequestId()).toBeNull();

      await webDbService.addToCart(sampleProduct2);
      const reqId2 = await webDbService.getOrCreateCartClientRequestId();
      expect(await webDbService.getCartCount()).toBe(1);
      expect(reqId2).not.toBe(reqId1);

      // Retour à Acheteur 1
      webDbService.setActiveBuyerId('1001');
      const cart1 = await webDbService.getCart();
      expect(cart1).toHaveLength(1);
      expect(cart1[0].productId).toBe(sampleProduct1.productId);
      expect(await webDbService.getCartClientRequestId()).toBe(reqId1);

      // Vidage Acheteur 1 ne touche pas Acheteur 2
      await webDbService.clearCart();
      expect(await webDbService.getCartCount()).toBe(0);

      webDbService.setActiveBuyerId('1002');
      const cart2 = await webDbService.getCart();
      expect(cart2).toHaveLength(1);
      expect(cart2[0].productId).toBe(sampleProduct2.productId);
      expect(await webDbService.getCartClientRequestId()).toBe(reqId2);
    });

    it('isole strictement le cache des commandes entre deux acheteurs sur le Web', async () => {
      webDbService.setActiveBuyerId('1001');
      vi.spyOn(apiClient, 'getOrders').mockResolvedValueOnce({
        orders: [
          {
            id: 'ord-b1',
            type: 'commande_ferme',
            status: 'en_attente',
            productId: '101',
            productName: 'Plantain',
            quantity: 2,
            unit: 'régime',
            price: '3500',
            gicName: 'GIC 1',
            createdAt: '2026-09-07T05:00:00.000Z',
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
      const orders1 = await webDbService.getOrders(true);
      expect(orders1).toHaveLength(1);
      expect(orders1[0].id).toBe('ord-b1');

      // Acheteur 2 en mode hors-ligne ne doit voir aucune commande
      webDbService.setActiveBuyerId('1002');
      const orders2 = await webDbService.getOrders(false);
      expect(orders2).toHaveLength(0);
    });

    it('isole strictement les paniers et commandes en SQLite natif', async () => {
      // @ts-ignore
      const mod = await import('../src/services/database.ts');
      const native = mod.dbService;

      native.setActiveBuyerId('2001');
      await native.clearCart();
      await native.addToCart(sampleProduct1);
      const reqId1 = await native.getOrCreateCartClientRequestId();

      native.setActiveBuyerId('2002');
      await native.clearCart();
      expect(await native.getCart()).toHaveLength(0);
      expect(await native.getCartClientRequestId()).toBeNull();

      await native.addToCart(sampleProduct2);
      expect(await native.getCartCount()).toBe(1);

      // Retour buyer 1
      native.setActiveBuyerId('2001');
      const cart1 = await native.getCart();
      expect(cart1).toHaveLength(1);
      expect(cart1[0].productId).toBe('101');
      expect(await native.getCartClientRequestId()).toBe(reqId1);

      // Nettoyage buyer 1
      await native.clearCart();
      expect(await native.getCartCount()).toBe(0);

      native.setActiveBuyerId('2002');
      expect(await native.getCartCount()).toBe(1);
    });
  });

  describe('9. Isolation et synchronisation des préférences d’alertes (GET/PUT & fallback)', () => {
    it('récupère les préférences depuis GET /api/buyer/alert-preferences et les met en cache', async () => {
      webDbService.setActiveBuyerId('3001');
      const mockPrefs = {
        productNames: ['Tomates fraîches', 'Maïs jaune'],
        bassins: ['Ouest'],
      };

      const getSpy = vi.spyOn(apiClient, 'getAlertPreferences').mockResolvedValueOnce({
        preferences: mockPrefs,
      });

      const prefs = await webDbService.getAlertPreferences();
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(prefs.productNames).toEqual(['Tomates fraîches', 'Maïs jaune']);
      expect(prefs.bassins).toEqual(['Ouest']);

      // Vérifie que le cache isolé contient ces préférences
      const cached = JSON.parse(localStorage.getItem(webDbService.getAlertPrefsKey()) || '{}');
      expect(cached.productNames).toEqual(['Tomates fraîches', 'Maïs jaune']);
    });

    it('sauvegarde les préférences via PUT /api/buyer/alert-preferences et met à jour le cache', async () => {
      webDbService.setActiveBuyerId('3001');
      const newPrefs = {
        productNames: ['Manioc frais'],
        bassins: ['Centre', 'Nord'],
      };

      const putSpy = vi.spyOn(apiClient, 'saveAlertPreferences').mockResolvedValueOnce({
        preferences: newPrefs,
      });

      const saved = await webDbService.saveAlertPreferences(newPrefs);
      expect(putSpy).toHaveBeenCalledWith(newPrefs);
      expect(saved.productNames).toEqual(['Manioc frais']);
      expect(saved.bassins).toEqual(['Centre', 'Nord']);

      // Cache mis à jour
      const cached = JSON.parse(localStorage.getItem(webDbService.getAlertPrefsKey()) || '{}');
      expect(cached.productNames).toEqual(['Manioc frais']);
    });

    it('propage l’erreur si le PUT échoue avec une erreur serveur (500 ou 401)', async () => {
      webDbService.setActiveBuyerId('3001');
      vi.spyOn(apiClient, 'saveAlertPreferences').mockRejectedValueOnce(
        new ApiError('Erreur serveur alertes', 500)
      );

      await expect(
        webDbService.saveAlertPreferences({ productNames: ['Piment'], bassins: ['Ouest'] })
      ).rejects.toThrow('Erreur serveur alertes');
    });

    it('se replie sur le cache local de l’acheteur si le réseau est indisponible lors de getAlertPreferences', async () => {
      webDbService.setActiveBuyerId('3002');
      const offlinePrefs = {
        productNames: ['Poivrons rouges'],
        bassins: ['Littoral'],
      };
      localStorage.setItem(webDbService.getAlertPrefsKey(), JSON.stringify(offlinePrefs));

      vi.spyOn(apiClient, 'getAlertPreferences').mockRejectedValueOnce(new ApiError('Pas de réseau', 0));

      const res = await webDbService.getAlertPreferences();
      expect(res.productNames).toEqual(['Poivrons rouges']);
      expect(res.bassins).toEqual(['Littoral']);
    });

    it('isole strictement les préférences entre deux acheteurs distincts', async () => {
      // Acheteur 1
      webDbService.setActiveBuyerId('3001');
      await webDbService.saveAlertPreferences({ productNames: ['Tomates'], bassins: ['Ouest'] });

      // Acheteur 2
      webDbService.setActiveBuyerId('3002');
      await webDbService.saveAlertPreferences({ productNames: ['Maïs'], bassins: ['Nord'] });

      // Lecture Acheteur 1
      webDbService.setActiveBuyerId('3001');
      vi.spyOn(apiClient, 'getAlertPreferences').mockRejectedValueOnce(new ApiError('Offline', 0));
      const prefsA = await webDbService.getAlertPreferences();
      expect(prefsA.productNames).toEqual(['Tomates']);

      // Lecture Acheteur 2
      webDbService.setActiveBuyerId('3002');
      vi.spyOn(apiClient, 'getAlertPreferences').mockRejectedValueOnce(new ApiError('Offline', 0));
      const prefsB = await webDbService.getAlertPreferences();
      expect(prefsB.productNames).toEqual(['Maïs']);
    });
  });

  describe('10. Stabilité des références de callbacks useCart (useCallback)', () => {
    it('mémorise les handlers du panier avec un tableau de dépendances vide pour prévenir les boucles de re-render', () => {
      const useCallbackSpy = vi.spyOn(React, 'useCallback');

      function TestComponent() {
        useCart();
        return null;
      }

      renderToString(React.createElement(TestComponent));

      // Vérifie que useCallback est appelé pour tous les handlers de useCart
      expect(useCallbackSpy).toHaveBeenCalled();
      const calls = useCallbackSpy.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(6);

      // Vérifie que chaque appel utilise un tableau de dépendances vide []
      for (const call of calls) {
        expect(call[1]).toEqual([]);
      }
    });
  });

  describe('11. Durcissement strict des identifiants et clés de cache (Regex ^[1-9]\\d*$, validation, clés forgées)', () => {
    it('valide uniquement les chaînes représentant des entiers strictement positifs', () => {
      expect(isValidBuyerId('1')).toBe(true);
      expect(isValidBuyerId('42')).toBe(true);
      expect(isValidBuyerId('1001')).toBe(true);
      expect(isValidBuyerId('999999999')).toBe(true);

      // Rejet strict des cas invalides
      expect(isValidBuyerId('0')).toBe(false);
      expect(isValidBuyerId('01')).toBe(false);
      expect(isValidBuyerId('0010')).toBe(false);
      expect(isValidBuyerId('anonymous')).toBe(false);
      expect(isValidBuyerId('test-buyer-uuid-001')).toBe(false);
      expect(isValidBuyerId('123e4567-e89b-12d3-a456-426614174000')).toBe(false);
      expect(isValidBuyerId(' 1001 ')).toBe(false);
      expect(isValidBuyerId('1001 ')).toBe(false);
      expect(isValidBuyerId(' 1001')).toBe(false);
      expect(isValidBuyerId('1001/2')).toBe(false);
      expect(isValidBuyerId('../1001')).toBe(false);
      expect(isValidBuyerId('1001_1')).toBe(false);
      expect(isValidBuyerId('1001-1')).toBe(false);
      expect(isValidBuyerId('100.5')).toBe(false);
      expect(isValidBuyerId('100,5')).toBe(false);
      expect(isValidBuyerId('-1001')).toBe(false);
      expect(isValidBuyerId('')).toBe(false);
      expect(isValidBuyerId(null)).toBe(false);
      expect(isValidBuyerId(undefined)).toBe(false);
      expect(isValidBuyerId(1001)).toBe(false);
    });

    it('validateBuyerId lève une erreur explicite pour tout identifiant invalide', () => {
      expect(validateBuyerId('1001')).toBe('1001');

      const invalidCases = ['0', 'anonymous', '123e4567-e89b-12d3-a456-426614174000', ' 1001 ', '1001/2', '1001_1', '100.5', '-1001', ''];
      for (const invalid of invalidCases) {
        expect(() => validateBuyerId(invalid)).toThrow(/Identifiant acheteur invalide/);
      }
    });

    it('isValidBuyerStorageKey valide les 4 familles de clés privées attendues', () => {
      expect(isValidBuyerStorageKey('sitcha_buyer_cart_1001')).toBe(true);
      expect(isValidBuyerStorageKey('sitcha_buyer_orders_1001')).toBe(true);
      expect(isValidBuyerStorageKey('sitcha_buyer_client_req_1001')).toBe(true);
      expect(isValidBuyerStorageKey('sitcha_buyer_alert_prefs_1001')).toBe(true);

      // Clés forgées ou corrompues
      expect(isValidBuyerStorageKey('sitcha_buyer_cart_0')).toBe(false);
      expect(isValidBuyerStorageKey('sitcha_buyer_cart_anonymous')).toBe(false);
      expect(isValidBuyerStorageKey('sitcha_buyer_cart_uuid')).toBe(false);
      expect(isValidBuyerStorageKey('sitcha_buyer_orders_0')).toBe(false);
      expect(isValidBuyerStorageKey('sitcha_buyer_client_req_1001/traversal')).toBe(false);
      expect(isValidBuyerStorageKey('sitcha_buyer_cart_')).toBe(false);
      expect(isValidBuyerStorageKey('sitcha_cart_global')).toBe(false);
      expect(isValidBuyerStorageKey('sitcha_orders_global')).toBe(false);
      expect(isValidBuyerStorageKey('other_prefix_1001')).toBe(false);
      expect(isValidBuyerStorageKey(123 as any)).toBe(false);
    });

    it('setActiveBuyerId rejette immédiatement tout identifiant invalide (web et natif)', async () => {
      // @ts-ignore
      const mod = await import('../src/services/database.ts');
      const native = mod.dbService;

      const badIds = ['0', 'anonymous', 'test-uuid', ' 1001 ', '1001/2', '1001_1', '-5', '10.5'];
      for (const bad of badIds) {
        expect(() => webDbService.setActiveBuyerId(bad)).toThrow(/Identifiant acheteur invalide/);
        expect(() => native.setActiveBuyerId(bad)).toThrow(/Identifiant acheteur invalide/);
      }
    });
  });

  describe('12. Sécurité asynchrone et isolation des courses critiques CartStore', () => {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    it('refresh() A lent suivi de B rapide -> l’état final est B et les données de A sont ignorées', async () => {
      localStorage.setItem('sitcha_buyer_cart_1001', JSON.stringify([
        { ...sampleProduct1, quantity: 1, addedAt: new Date().toISOString() }
      ]));
      localStorage.setItem('sitcha_buyer_cart_1002', JSON.stringify([
        { ...sampleProduct2, quantity: 3, addedAt: new Date().toISOString() }
      ]));

      await cartStore.setBuyerId('1001');
      expect(cartStore.getCount()).toBe(1);

      const origGetCartForBuyer = webDbService.getCartForBuyer.bind(webDbService);
      vi.spyOn(webDbService, 'getCartForBuyer').mockImplementation(async (buyerId: string) => {
        if (buyerId === '1001') {
          await sleep(50);
        }
        return origGetCartForBuyer(buyerId);
      });

      const promiseA = cartStore.refresh();

      await cartStore.setBuyerId('1002');
      expect(cartStore.getBuyerId()).toBe('1002');
      expect(cartStore.getCount()).toBe(3);

      await promiseA;

      expect(cartStore.getBuyerId()).toBe('1002');
      expect(cartStore.getCount()).toBe(3);
      expect(cartStore.getCart()[0].productId).toBe('102');
    });

    it('refresh() B se termine avant A -> les données tardives de A ne polluent pas le store', async () => {
      localStorage.setItem('sitcha_buyer_cart_1001', JSON.stringify([
        { ...sampleProduct1, quantity: 1, addedAt: new Date().toISOString() }
      ]));
      localStorage.setItem('sitcha_buyer_cart_1002', JSON.stringify([
        { ...sampleProduct2, quantity: 2, addedAt: new Date().toISOString() }
      ]));

      await cartStore.setBuyerId('1001');

      const origGetCartForBuyer = webDbService.getCartForBuyer.bind(webDbService);
      vi.spyOn(webDbService, 'getCartForBuyer').mockImplementation(async (buyerId: string) => {
        if (buyerId === '1001') {
          await sleep(50);
        }
        return origGetCartForBuyer(buyerId);
      });

      const notifications: number[] = [];
      const unsubscribe = cartStore.subscribe(() => {
        notifications.push(cartStore.getCount());
      });

      const refreshA = cartStore.refresh();
      await cartStore.setBuyerId('1002');
      await refreshA;

      unsubscribe();

      expect(notifications[notifications.length - 1]).toBe(2);
      expect(cartStore.getCount()).toBe(2);
    });

    it('reset() / logout pendant refresh() -> état vide, aucun résidu de la session précédente', async () => {
      localStorage.setItem('sitcha_buyer_cart_1001', JSON.stringify([
        { ...sampleProduct1, quantity: 2, addedAt: new Date().toISOString() }
      ]));

      const origGetCartForBuyer = webDbService.getCartForBuyer.bind(webDbService);
      vi.spyOn(webDbService, 'getCartForBuyer').mockImplementation(async (buyerId: string) => {
        await sleep(50);
        return origGetCartForBuyer(buyerId);
      });

      await cartStore.setBuyerId('1001');
      const refreshPromise = cartStore.refresh();

      cartStore.reset();
      expect(cartStore.getBuyerId()).toBeNull();
      expect(cartStore.getCount()).toBe(0);

      await refreshPromise;

      expect(cartStore.getBuyerId()).toBeNull();
      expect(cartStore.getCount()).toBe(0);
      expect(cartStore.getCart()).toHaveLength(0);
    });

    it('addToCart ou clearCart initié sur A n’affecte pas B si le contexte a basculé', async () => {
      await cartStore.setBuyerId('1001');
      webDbService.setActiveBuyerId('1001');

      const origAddToCart = webDbService.addToCart.bind(webDbService);
      vi.spyOn(webDbService, 'addToCart').mockImplementation(async (item: any, max?: number) => {
        await sleep(40);
        return origAddToCart(item, max);
      });

      const addPromise = cartStore.addToCart(sampleProduct1);

      await cartStore.setBuyerId('1002');
      webDbService.setActiveBuyerId('1002');

      await expect(addPromise).rejects.toThrow(/Contexte acheteur modifié/);

      expect(cartStore.getBuyerId()).toBe('1002');
      expect(cartStore.getCount()).toBe(0);
      expect(cartStore.getCart()).toHaveLength(0);
    });
  });

  describe('13. Sécurité asynchrone et isolation DatabaseService', () => {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    it('syncBuyerData(A) en retard n’écrase pas activeBuyerId si B est devenu actif', async () => {
      webDbService.setActiveBuyerId('1001');

      vi.spyOn(apiClient, 'getOrders').mockImplementation(async () => {
        await sleep(50);
        return {
          orders: [
            {
              id: 'ord-delayed-a',
              type: 'commande_ferme',
              status: 'en_attente',
              productId: '101',
              productName: 'Plantain',
              quantity: 1,
              unit: 'régime',
              price: '3500',
              gicName: 'GIC',
              createdAt: new Date().toISOString(),
            },
          ],
          meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
        };
      });

      vi.spyOn(apiClient, 'getAlertPreferences').mockResolvedValue({
        preferences: { productNames: ['Plantain'], bassins: ['Ouest'] },
      });

      const syncPromise = webDbService.syncBuyerData('1001');

      webDbService.setActiveBuyerId('1002');
      expect(webDbService.getActiveBuyerId()).toBe('1002');

      await syncPromise;

      // activeBuyerId n'a JAMAIS été écrasé vers 1001
      expect(webDbService.getActiveBuyerId()).toBe('1002');

      // Le cache de B n'est absolument pas pollué par les données de A
      const ordersB = JSON.parse(localStorage.getItem('sitcha_buyer_orders_1002') || '[]');
      expect(ordersB).toHaveLength(0);
    });

    it('syncBuyerData(A) écrit correctement dans sitcha_buyer_orders_A si le contexte reste stable', async () => {
      webDbService.setActiveBuyerId('1001');

      vi.spyOn(apiClient, 'getOrders').mockResolvedValueOnce({
        orders: [
          {
            id: 'ord-sync-ok',
            type: 'commande_ferme',
            status: 'en_attente',
            productId: '101',
            productName: 'Plantain',
            quantity: 1,
            unit: 'régime',
            price: '3500',
            gicName: 'GIC',
            createdAt: new Date().toISOString(),
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });

      vi.spyOn(apiClient, 'getAlertPreferences').mockResolvedValueOnce({
        preferences: { productNames: ['Plantain'], bassins: ['Ouest'] },
      });

      await webDbService.syncBuyerData('1001');

      const ordersA = JSON.parse(localStorage.getItem('sitcha_buyer_orders_1001') || '[]');
      expect(ordersA).toHaveLength(1);
      expect(ordersA[0].id).toBe('ord-sync-ok');
    });

    it('getOrders(true) retardé de A n’écrit jamais dans le cache des commandes de B', async () => {
      webDbService.setActiveBuyerId('1001');

      vi.spyOn(apiClient, 'getOrders').mockImplementation(async () => {
        await sleep(50);
        return {
          orders: [
            {
              id: 'ord-delayed-get',
              type: 'commande_ferme',
              status: 'en_attente',
              productId: '101',
              productName: 'Plantain',
              quantity: 1,
              unit: 'régime',
              price: '3500',
              gicName: 'GIC',
              createdAt: new Date().toISOString(),
            },
          ],
          meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
        };
      });

      const getOrdersPromise = webDbService.getOrders(true);
      webDbService.setActiveBuyerId('1002');

      await getOrdersPromise;

      const ordersB = JSON.parse(localStorage.getItem('sitcha_buyer_orders_1002') || '[]');
      expect(ordersB).toHaveLength(0);
    });

    it('getAlertPreferences() retardé de A n’écrit jamais dans le cache des alertes de B', async () => {
      webDbService.setActiveBuyerId('1001');

      vi.spyOn(apiClient, 'getAlertPreferences').mockImplementation(async () => {
        await sleep(50);
        return {
          preferences: { productNames: ['Piment Rouge'], bassins: ['Nord'] },
        };
      });

      const getPrefsPromise = webDbService.getAlertPreferences();
      webDbService.setActiveBuyerId('1002');

      await getPrefsPromise;

      const prefsB = localStorage.getItem('sitcha_buyer_alert_prefs_1002');
      expect(prefsB).toBeNull();
    });
  });

  describe('14. Protection de createOrderFromCart face aux bascules de contexte', () => {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    it('POST A retardé après bascule vers B -> ne vide pas le panier de B et lève "Contexte acheteur modifié pendant la création de la commande."', async () => {
      webDbService.setActiveBuyerId('1001');
      await webDbService.addToCart(sampleProduct1);

      webDbService.setActiveBuyerId('1002');
      await webDbService.addToCart(sampleProduct2);

      webDbService.setActiveBuyerId('1001');

      vi.spyOn(apiClient, 'createOrder').mockImplementation(async () => {
        await sleep(50);
        return {
          orders: [
            {
              id: 'ord-race-1',
              type: 'commande_ferme',
              status: 'en_attente',
              productId: '101',
              productName: sampleProduct1.name,
              quantity: 1,
              unit: sampleProduct1.unit,
              price: sampleProduct1.price,
              gicName: 'GIC',
              createdAt: new Date().toISOString(),
            },
          ],
        };
      });

      vi.spyOn(apiClient, 'getOrders').mockResolvedValue({
        orders: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });

      const createOrderPromise = webDbService.createOrderFromCart('commande_ferme');
      webDbService.setActiveBuyerId('1002');

      await expect(createOrderPromise).rejects.toThrow(
        'Contexte acheteur modifié pendant la création de la commande.'
      );

      const cartB = await webDbService.getCart();
      expect(cartB).toHaveLength(1);
      expect(cartB[0].productId).toBe('102');

      const cartA = JSON.parse(localStorage.getItem('sitcha_buyer_cart_1001') || '[]');
      expect(cartA).toHaveLength(0);

      const ordersB = JSON.parse(localStorage.getItem('sitcha_buyer_orders_1002') || '[]');
      expect(ordersB).toHaveLength(0);
    });

    it('POST A retardé après déconnexion (null) -> lève l’erreur de contexte modifié', async () => {
      webDbService.setActiveBuyerId('1001');
      await webDbService.addToCart(sampleProduct1);

      vi.spyOn(apiClient, 'createOrder').mockImplementation(async () => {
        await sleep(50);
        return {
          orders: [
            {
              id: 'ord-race-null',
              type: 'commande_ferme',
              status: 'en_attente',
              productId: '101',
              productName: sampleProduct1.name,
              quantity: 1,
              unit: sampleProduct1.unit,
              price: sampleProduct1.price,
              gicName: 'GIC',
              createdAt: new Date().toISOString(),
            },
          ],
        };
      });

      const createPromise = webDbService.createOrderFromCart('commande_ferme');
      webDbService.setActiveBuyerId(null);

      await expect(createPromise).rejects.toThrow(
        'Contexte acheteur modifié pendant la création de la commande.'
      );
    });

    it('GET de fond de synchronisation de A retardé -> n’écrit pas dans le cache commandes de B', async () => {
      webDbService.setActiveBuyerId('1001');
      await webDbService.addToCart(sampleProduct1);

      vi.spyOn(apiClient, 'createOrder').mockResolvedValueOnce({
        orders: [
          {
            id: 'ord-bg-1',
            type: 'commande_ferme',
            status: 'en_attente',
            productId: '101',
            productName: sampleProduct1.name,
            quantity: 1,
            unit: sampleProduct1.unit,
            price: sampleProduct1.price,
            gicName: 'GIC',
            createdAt: new Date().toISOString(),
          },
        ],
      });

      vi.spyOn(apiClient, 'getOrders').mockImplementation(async () => {
        await sleep(60);
        return {
          orders: [
            {
              id: 'ord-bg-synced',
              type: 'commande_ferme',
              status: 'en_attente',
              productId: '101',
              productName: sampleProduct1.name,
              quantity: 1,
              unit: sampleProduct1.unit,
              price: sampleProduct1.price,
              gicName: 'GIC',
              createdAt: new Date().toISOString(),
            },
          ],
          meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
        };
      });

      const result = await webDbService.createOrderFromCart('commande_ferme');
      expect(result).toHaveLength(1);

      webDbService.setActiveBuyerId('1002');
      await sleep(80);

      const ordersB = JSON.parse(localStorage.getItem('sitcha_buyer_orders_1002') || '[]');
      expect(ordersB).toHaveLength(0);

      const ordersA = JSON.parse(localStorage.getItem('sitcha_buyer_orders_1001') || '[]');
      // Le GET en tâche de fond a été invalidé et ignoré suite à la bascule vers 1002
      expect(ordersA.some((o: any) => o.id === 'ord-bg-synced')).toBe(false);
    });
  });

  describe('15. Tests de non-régression des courses critiques (Coordinations de production & Atomicité de Session)', () => {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    it('1. A login lent, B rapide, avec les vraies mutations saveSession : stockage final B', async () => {
      _resetSessionMutationSeqForTesting(0);
      const userA = { id: '1001', buyerId: '1001', role: 'buyer' as const, name: 'Acheteur A', phone: '+237699000001', phoneVerified: true, status: 'active' as const };
      const userB = { id: '1002', buyerId: '1002', role: 'buyer' as const, name: 'Acheteur B', phone: '+237699000002', phoneVerified: true, status: 'active' as const };

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, options: any) => {
        const body = options?.body ? JSON.parse(options.body) : {};
        if (body.phone === '+237699000001') {
          await sleep(60);
          return {
            ok: true,
            status: 200,
            json: async () => ({
              token: 'tok-A',
              user: userA,
            }),
          } as any;
        }
        await sleep(10);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            token: 'tok-B',
            user: userB,
          }),
        } as any;
      });

      const authCoordinator = new AuthSessionCoordinator();
      const promiseA = authCoordinator.signIn('+237699000001', '1234');
      await sleep(5);
      const promiseB = authCoordinator.signIn('+237699000002', '1234');

      const [resA, resB] = await Promise.all([promiseA, promiseB]);

      expect(resA.obsolete).toBe(true);
      expect(resA.token).toBeUndefined();
      expect(resB.token).toBe('tok-B');
      expect(resB.user?.name).toBe('Acheteur B');

      const stored = await readStoredSession();
      expect(stored?.token).toBe('tok-B');
      expect(stored?.user.name).toBe('Acheteur B');
      expect(authCoordinator.getState().user?.name).toBe('Acheteur B');
    });

    it('2. saveSession A retardé terminant après B : stockage final B', async () => {
      _resetSessionMutationSeqForTesting(0);
      const userA = { id: '1001', buyerId: '1001', role: 'buyer' as const, name: 'Acheteur A', phone: '+237699000001', phoneVerified: true, status: 'active' as const };
      const userB = { id: '1002', buyerId: '1002', role: 'buyer' as const, name: 'Acheteur B', phone: '+237699000002', phoneVerified: true, status: 'active' as const };

      const promiseA = (async () => {
        await sleep(40);
        return saveSession('tok-A', userA, 1);
      })();

      const promiseB = (async () => {
        await sleep(10);
        return saveSession('tok-B', userB, 2);
      })();

      await Promise.all([promiseA, promiseB]);

      const stored = await readStoredSession();
      expect(stored?.token).toBe('tok-B');
      expect(stored?.user.name).toBe('Acheteur B');
    });

    it('3. signOut A retardé après login B : B reste en mémoire et dans le stockage', async () => {
      _resetSessionMutationSeqForTesting(0);
      const userB = { id: '1002', buyerId: '1002', role: 'buyer' as const, name: 'Acheteur B', phone: '+237699000002', phoneVerified: true, status: 'active' as const };

      const authCoordinator = new AuthSessionCoordinator();
      await authCoordinator.commitSession(2, { status: 'authenticated', user: userB, token: 'tok-B', error: null }, userB, { saveToken: 'tok-B' });

      // Tentative de déconnexion d'une ancienne session A (opId 1)
      await clearSession(1);

      const stored = await readStoredSession();
      expect(stored?.token).toBe('tok-B');
      expect(stored?.user.name).toBe('Acheteur B');
      expect(authCoordinator.getState().status).toBe('authenticated');
      expect(authCoordinator.getState().user?.name).toBe('Acheteur B');
    });

    it('4. HTTP 401 tardif utilisant le token A après login B : B reste connecté', async () => {
      _resetSessionMutationSeqForTesting(0);
      const userA = { id: '1001', buyerId: '1001', role: 'buyer' as const, name: 'Acheteur A', phone: '+237699000001', phoneVerified: true, status: 'active' as const };
      const userB = { id: '1002', buyerId: '1002', role: 'buyer' as const, name: 'Acheteur B', phone: '+237699000002', phoneVerified: true, status: 'active' as const };

      // 1. Initialiser avec le token A
      await saveSession('tok-A', userA, 1);

      let unblockFetch: () => void = () => {};
      const fetchGate = new Promise<void>((r) => { unblockFetch = r; });

      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        await fetchGate;
        return {
          ok: false,
          status: 401,
          json: async () => ({ message: 'Session expirée sur token A' }),
        } as any;
      });

      // Lancer la requête avec token A (readToken lira 'tok-A')
      const requestPromise = request('/buyer/orders', 'GET');

      // 2. Pendant ce temps, l'utilisateur B se connecte avec 'tok-B'
      await saveSession('tok-B', userB, 2);

      // 3. Débloquer la réponse HTTP 401 pour la requête qui utilisait token A
      unblockFetch();

      await expect(requestPromise).rejects.toThrow('Session expirée sur token A');

      // La session courante dans le stockage est toujours celle de B !
      const currentStored = await readStoredSession();
      expect(currentStored).not.toBeNull();
      expect(currentStored?.token).toBe('tok-B');
      expect(currentStored?.user.name).toBe('Acheteur B');
    });

    it('5. compteur d’alertes A déjà affiché, bascule directe vers B : zéro immédiatement, puis valeur de B uniquement', async () => {
      vi.spyOn(webDbService, 'syncPublicData').mockResolvedValue(true);
      vi.spyOn(webDbService, 'syncBuyerData').mockResolvedValue(true);
      const homeCoord = new BuyerHomeCoordinator('1001', false, true);
      vi.spyOn(webDbService, 'getProducts').mockResolvedValue([]);
      vi.spyOn(webDbService, 'getMatchingAlertCount').mockResolvedValueOnce(5);

      await homeCoord.silentSync();
      expect(homeCoord.getState().alertCount).toBe(5);

      // Bascule directe vers B : synchro ralentie pour B
      vi.spyOn(webDbService, 'getMatchingAlertCount').mockImplementation(async () => {
        await sleep(40);
        return 2;
      });

      homeCoord.updateSession('1002', false, true);

      // ZÉRO IMMÉDIATEMENT : le compteur de A ne doit jamais fuiter vers B
      expect(homeCoord.getState().alertCount).toBe(0);

      await sleep(60);

      // Valeur de B uniquement une fois la synchro achevée
      expect(homeCoord.getState().alertCount).toBe(2);
    });

    it('6. écran orders/alerts restant monté pendant A vers B : chargement B automatique', async () => {
      // Test Orders
      vi.spyOn(webDbService, 'getOrders').mockResolvedValueOnce([]);
      const ordersCoord = new BuyerOrdersCoordinator('1001', false, true);
      await sleep(20);
      expect(ordersCoord.getState().loadedBuyerId).toBe('1001');

      vi.spyOn(webDbService, 'getOrders').mockResolvedValueOnce([
        { id: 'ord-B-1', type: 'commande_ferme', status: 'confirmee', productId: '101', productName: 'P1', quantity: 3, unit: 'kg', price: '300', gicName: 'GIC', createdAt: new Date().toISOString() },
      ]);

      ordersCoord.updateSession('1002', false, true);
      expect(ordersCoord.getState().isLoading).toBe(true);

      await sleep(30);
      expect(ordersCoord.getState().loadedBuyerId).toBe('1002');
      expect(ordersCoord.getState().orders).toHaveLength(1);
      expect(ordersCoord.getState().orders[0].id).toBe('ord-B-1');

      // Test Alerts
      vi.spyOn(webDbService, 'getAlertPreferences').mockResolvedValueOnce({
        productNames: [],
        bassins: [],
      });
      vi.spyOn(webDbService, 'getMatchingAlertCount').mockResolvedValueOnce(0);
      const alertsCoord = new BuyerAlertsCoordinator('1001', false, true);
      await sleep(20);

      vi.spyOn(webDbService, 'getAlertPreferences').mockResolvedValueOnce({
        productNames: ['Tomates cerises'],
        bassins: ['Ouest'],
      });
      vi.spyOn(webDbService, 'getMatchingAlertCount').mockResolvedValueOnce(3);

      alertsCoord.updateSession('1002', false, true);
      expect(alertsCoord.getState().isLoading).toBe(true);

      await sleep(30);
      expect(alertsCoord.getState().prefs.productNames).toEqual(['Tomates cerises']);
    });

    it('7. commande A encore busy, bascule B : B n’est pas bloqué', async () => {
      const checkoutCoord = new BuyerCheckoutCoordinator('1001', false, true);
      await cartStore.setBuyerId('1001');

      vi.spyOn(webDbService, 'createOrderFromCart').mockImplementation(async () => {
        await sleep(80);
        return [{ id: 'ord-delayed' } as any];
      });

      const confirmPromise = checkoutCoord.confirmOrder(
        'commande_ferme',
        async () => {},
        { onSuccess: () => {}, onError: () => {} },
        [{ id: 'item-101', productId: '101', name: 'Plantain', price: '1000', quantity: 1, unit: 'kg' }]
      );

      expect(checkoutCoord.getState().busy).toBe(true);

      // Bascule directe vers l'acheteur B pendant que la commande de A est encore en cours
      await cartStore.setBuyerId('1002');
      checkoutCoord.updateSession('1002', false, true);

      // B n'est pas bloqué : busy est remis immédiatement à false !
      expect(checkoutCoord.getState().busy).toBe(false);

      await confirmPromise;
      expect(checkoutCoord.getState().busy).toBe(false);
    });

    it('8. notation pendant loadOrders : le chargement ne reste pas bloqué', async () => {
      const ordersCoord = new BuyerOrdersCoordinator('1001', false, true);

      vi.spyOn(webDbService, 'getOrders').mockImplementation(async () => {
        await sleep(40);
        return [
          { id: 'ord-100', type: 'achat_direct', status: 'livree', productId: '101', productName: 'P', quantity: 1, unit: 'kg', price: '100', gicName: 'GIC', createdAt: new Date().toISOString() },
        ];
      });

      const loadPromise = ordersCoord.loadOrders();
      expect(ordersCoord.getState().isLoading).toBe(true);

      // Notation déclenchée pendant que loadOrders est en cours
      vi.spyOn(webDbService, 'addTrustRating').mockResolvedValueOnce({} as any);
      let ratingSuccess = false;
      const ratePromise = ordersCoord.submitRating(
        { id: 'ord-100', gicName: 'GIC' } as any,
        5,
        'Excellent service',
        { onSuccess: () => { ratingSuccess = true; } }
      );

      await Promise.all([loadPromise, ratePromise]);

      // Les deux opérations indépendantes réussissent sans bloquer isLoading
      expect(ratingSuccess).toBe(true);
      expect(ordersCoord.getState().isLoading).toBe(false);
      expect(ordersCoord.getState().orders).toHaveLength(1);
    });

    it('9. sauvegarde pendant loadAlerts : le chargement ne reste pas bloqué', async () => {
      const alertsCoord = new BuyerAlertsCoordinator('1001', false, true);

      vi.spyOn(webDbService, 'getAlertPreferences').mockImplementation(async () => {
        await sleep(40);
        return { productNames: ['P1'], bassins: ['B1'] };
      });

      const loadPromise = alertsCoord.loadAlerts();
      expect(alertsCoord.getState().isLoading).toBe(true);

      // Sauvegarde pendant que loadAlerts est en cours
      vi.spyOn(webDbService, 'saveAlertPreferences').mockResolvedValueOnce({
        productNames: ['P2'],
        bassins: ['B2'],
      });
      let saveSuccess = false;
      const savePromise = alertsCoord.saveAlerts(
        { productNames: ['P2'], bassins: ['B2'] },
        { onSuccess: () => { saveSuccess = true; } }
      );

      await Promise.all([loadPromise, savePromise]);

      expect(saveSuccess).toBe(true);
      expect(alertsCoord.getState().isLoading).toBe(false);
    });

    it('10. ajout panier pendant silentSync : le chargement ne reste pas bloqué', async () => {
      const homeCoord = new BuyerHomeCoordinator('1001', false, true);

      vi.spyOn(webDbService, 'getProducts').mockImplementation(async () => {
        await sleep(40);
        return [{ id: 'p1', name: 'Manioc', price: '500', unit: 'sac', volumeDisponible: 10 } as any];
      });

      const syncPromise = homeCoord.silentSync();
      expect(homeCoord.getState().isLoading).toBe(true);

      const mockAddToCart = vi.fn().mockResolvedValue(true);
      let addSuccess = false;
      const addPromise = homeCoord.handleAddToCartSafe(
        { id: 'p1', name: 'Manioc', price: '500', unit: 'sac', volumeDisponible: 10 } as any,
        mockAddToCart,
        { onSuccess: () => { addSuccess = true; } }
      );

      await Promise.all([syncPromise, addPromise]);

      expect(addSuccess).toBe(true);
      expect(mockAddToCart).toHaveBeenCalledTimes(1);
      expect(homeCoord.getState().isLoading).toBe(false);
      expect(homeCoord.getState().products).toHaveLength(1);
    });

    it('11. désynchronisation du panier (panier de A alors que session est B) : checkout bloqué et badge masqué', async () => {
      // Panier initialisé pour acheteur 1001
      await cartStore.setBuyerId('1001');
      await cartStore.addToCart({ productId: '101', name: 'Plantain', price: '1000', unit: 'kg' }, 10);
      expect(cartStore.getCart()).toHaveLength(1);

      // Checkout monté avec utilisateur courant = 1002 (désynchronisé)
      const checkoutCoord = new BuyerCheckoutCoordinator('1002', false, true);
      const homeCoord = new BuyerHomeCoordinator('1002', false, true);

      // Le checkout détecte l'inadéquation et masque le panier
      const checkoutState = checkoutCoord.getState(cartStore.getCart(), cartStore.getTotalAmount());
      expect(checkoutState.isCartAligned).toBe(false);
      expect(checkoutState.effectiveCart).toHaveLength(0);
      expect(checkoutState.effectiveTotalAmount).toBe(0);

      // La validation est refusée
      const success = await checkoutCoord.confirmOrder(
        'commande_ferme',
        async () => {},
        { onSuccess: () => {}, onError: () => {} },
        checkoutState.effectiveCart
      );
      expect(success).toBe(false);

      // Sur l'écran d'accueil, le badge panier est forcé à 0
      const homeState = homeCoord.getState(cartStore.getCount());
      expect(homeState.isCartAligned).toBe(false);
      expect(homeState.effectiveCartCount).toBe(0);
    });

    it('12. comparaison explicite : neutralisation par génération de session vs capture stale', async () => {
      let activeBuyerId = '1001';
      let sessionGen = 1;

      let resultCaptured = 'pending';
      const slowAction = async () => {
        const capturedBuyerId = activeBuyerId;
        const capturedGen = sessionGen;
        await sleep(50);
        if (sessionGen !== capturedGen || activeBuyerId !== capturedBuyerId) {
          resultCaptured = 'aborted_stale_detected';
          return;
        }
        resultCaptured = 'committed_stale_bug';
      };

      const actionPromise = slowAction();

      // Bascule de session pendant l'exécution
      activeBuyerId = '1002';
      sessionGen = 2;

      await actionPromise;
      expect(resultCaptured).toBe('aborted_stale_detected');
    });
  });

  describe('16. Parité des garanties asynchrones et d’isolation en SQLite natif', () => {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    let nativeDbService: any;

    beforeEach(async () => {
      (globalThis as any).resetSqliteMock?.();
      // @ts-ignore
      const mod = await import('../src/services/database.ts');
      nativeDbService = mod.dbService;
    });

    it('createOrderFromCart natif lève l’erreur de contexte modifié et préserve le panier du nouvel acheteur', async () => {
      nativeDbService.setActiveBuyerId('2001');
      await nativeDbService.addToCart(sampleProduct1);

      nativeDbService.setActiveBuyerId('2002');
      await nativeDbService.addToCart(sampleProduct2);

      nativeDbService.setActiveBuyerId('2001');

      vi.spyOn(apiClient, 'createOrder').mockImplementation(async () => {
        await sleep(50);
        return {
          orders: [
            {
              id: 'ord-native-race-1',
              type: 'commande_ferme',
              status: 'en_attente',
              productId: '101',
              productName: sampleProduct1.name,
              quantity: 1,
              unit: sampleProduct1.unit,
              price: sampleProduct1.price,
              gicName: 'GIC',
              createdAt: new Date().toISOString(),
            },
          ],
        };
      });

      vi.spyOn(apiClient, 'getOrders').mockResolvedValue({
        orders: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });

      const createPromise = nativeDbService.createOrderFromCart('commande_ferme');
      nativeDbService.setActiveBuyerId('2002');

      await expect(createPromise).rejects.toThrow(
        'Contexte acheteur modifié pendant la création de la commande.'
      );

      nativeDbService.setActiveBuyerId('2002');
      const cart2002 = await nativeDbService.getCart();
      expect(cart2002).toHaveLength(1);
      expect(cart2002[0].productId).toBe('102');
    });

    it('syncBuyerData(A) natif tardif ne réassigne pas activeBuyerId lorsque B est actif', async () => {
      nativeDbService.setActiveBuyerId('2001');

      vi.spyOn(apiClient, 'getOrders').mockImplementation(async () => {
        await sleep(50);
        return {
          orders: [],
          meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
        };
      });

      vi.spyOn(apiClient, 'getAlertPreferences').mockResolvedValue({
        preferences: { productNames: [], bassins: [] },
      });

      const syncPromise = nativeDbService.syncBuyerData('2001');
      nativeDbService.setActiveBuyerId('2002');

      await syncPromise;

      expect(nativeDbService.getActiveBuyerId()).toBe('2002');
    });
  });
});
