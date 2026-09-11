import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
// @ts-ignore
import { renderToString } from 'react-dom/server';
import { dbService as webDbService } from '../src/services/database.web';
import { cartStore, useCart } from '../src/services/cart-store';
import { apiClient, ApiError } from '../src/services/api';
import { STORAGE_KEYS, CartItemRecord } from '../src/services/database.shared';

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

  const defaultBuyerId = 'test-buyer-uuid-001';

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
      webDbService.setActiveBuyerId('anonymous');
      await expect(webDbService.getOrders()).rejects.toThrow(/Opération non autorisée/);
      await expect(webDbService.createOrderFromCart('commande_ferme')).rejects.toThrow(/Opération non autorisée/);
      await expect(webDbService.getAlertPreferences()).rejects.toThrow(/Opération non autorisée/);
      await expect(webDbService.saveAlertPreferences({ productNames: [], bassins: [] })).rejects.toThrow(/Opération non autorisée/);
      await expect(webDbService.getMatchingAlertCount()).rejects.toThrow(/Opération non autorisée/);

      webDbService.setActiveBuyerId('   ');
      await expect(webDbService.getOrders()).rejects.toThrow(/Opération non autorisée/);
      await expect(webDbService.createOrderFromCart('commande_ferme')).rejects.toThrow(/Opération non autorisée/);
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
      webDbService.setActiveBuyerId('buyer-alpha');
      await cartStore.setBuyerId('buyer-alpha');
      await cartStore.addToCart(sampleProduct1);
      expect(cartStore.getCount()).toBe(1);

      // Changement de session vers buyer-beta
      webDbService.setActiveBuyerId('buyer-beta');
      await cartStore.setBuyerId('buyer-beta');
      expect(cartStore.getCount()).toBe(0);
      expect(cartStore.getCart()).toHaveLength(0);

      // Reconnexion de buyer-alpha
      webDbService.setActiveBuyerId('buyer-alpha');
      await cartStore.setBuyerId('buyer-alpha');
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
      nativeDbService.setActiveBuyerId('test-native-buyer-001');
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
      webDbService.setActiveBuyerId('buyer-1');
      await webDbService.clearCart();
      await webDbService.addToCart(sampleProduct1);
      const reqId1 = await webDbService.getOrCreateCartClientRequestId();
      expect(await webDbService.getCartCount()).toBe(1);

      // Acheteur 2
      webDbService.setActiveBuyerId('buyer-2');
      await webDbService.clearCart();
      expect(await webDbService.getCartCount()).toBe(0);
      expect(await webDbService.getCart()).toHaveLength(0);
      expect(await webDbService.getCartClientRequestId()).toBeNull();

      await webDbService.addToCart(sampleProduct2);
      const reqId2 = await webDbService.getOrCreateCartClientRequestId();
      expect(await webDbService.getCartCount()).toBe(1);
      expect(reqId2).not.toBe(reqId1);

      // Retour à Acheteur 1
      webDbService.setActiveBuyerId('buyer-1');
      const cart1 = await webDbService.getCart();
      expect(cart1).toHaveLength(1);
      expect(cart1[0].productId).toBe(sampleProduct1.productId);
      expect(await webDbService.getCartClientRequestId()).toBe(reqId1);

      // Vidage Acheteur 1 ne touche pas Acheteur 2
      await webDbService.clearCart();
      expect(await webDbService.getCartCount()).toBe(0);

      webDbService.setActiveBuyerId('buyer-2');
      const cart2 = await webDbService.getCart();
      expect(cart2).toHaveLength(1);
      expect(cart2[0].productId).toBe(sampleProduct2.productId);
      expect(await webDbService.getCartClientRequestId()).toBe(reqId2);
    });

    it('isole strictement le cache des commandes entre deux acheteurs sur le Web', async () => {
      webDbService.setActiveBuyerId('buyer-1');
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
      webDbService.setActiveBuyerId('buyer-2');
      const orders2 = await webDbService.getOrders(false);
      expect(orders2).toHaveLength(0);
    });

    it('isole strictement les paniers et commandes en SQLite natif', async () => {
      // @ts-ignore
      const mod = await import('../src/services/database.ts');
      const native = mod.dbService;

      native.setActiveBuyerId('native-buyer-1');
      await native.clearCart();
      await native.addToCart(sampleProduct1);
      const reqId1 = await native.getOrCreateCartClientRequestId();

      native.setActiveBuyerId('native-buyer-2');
      await native.clearCart();
      expect(await native.getCart()).toHaveLength(0);
      expect(await native.getCartClientRequestId()).toBeNull();

      await native.addToCart(sampleProduct2);
      expect(await native.getCartCount()).toBe(1);

      // Retour buyer 1
      native.setActiveBuyerId('native-buyer-1');
      const cart1 = await native.getCart();
      expect(cart1).toHaveLength(1);
      expect(cart1[0].productId).toBe('101');
      expect(await native.getCartClientRequestId()).toBe(reqId1);

      // Nettoyage buyer 1
      await native.clearCart();
      expect(await native.getCartCount()).toBe(0);

      native.setActiveBuyerId('native-buyer-2');
      expect(await native.getCartCount()).toBe(1);
    });
  });

  describe('9. Isolation et synchronisation des préférences d’alertes (GET/PUT & fallback)', () => {
    it('récupère les préférences depuis GET /api/buyer/alert-preferences et les met en cache', async () => {
      webDbService.setActiveBuyerId('buyer-alert-1');
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
      webDbService.setActiveBuyerId('buyer-alert-1');
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
      webDbService.setActiveBuyerId('buyer-alert-1');
      vi.spyOn(apiClient, 'saveAlertPreferences').mockRejectedValueOnce(
        new ApiError('Erreur serveur alertes', 500)
      );

      await expect(
        webDbService.saveAlertPreferences({ productNames: ['Piment'], bassins: ['Ouest'] })
      ).rejects.toThrow('Erreur serveur alertes');
    });

    it('se replie sur le cache local de l’acheteur si le réseau est indisponible lors de getAlertPreferences', async () => {
      webDbService.setActiveBuyerId('buyer-alert-offline');
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
      webDbService.setActiveBuyerId('buyer-prefs-A');
      await webDbService.saveAlertPreferences({ productNames: ['Tomates'], bassins: ['Ouest'] });

      // Acheteur 2
      webDbService.setActiveBuyerId('buyer-prefs-B');
      await webDbService.saveAlertPreferences({ productNames: ['Maïs'], bassins: ['Nord'] });

      // Lecture Acheteur 1
      webDbService.setActiveBuyerId('buyer-prefs-A');
      vi.spyOn(apiClient, 'getAlertPreferences').mockRejectedValueOnce(new ApiError('Offline', 0));
      const prefsA = await webDbService.getAlertPreferences();
      expect(prefsA.productNames).toEqual(['Tomates']);

      // Lecture Acheteur 2
      webDbService.setActiveBuyerId('buyer-prefs-B');
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
});
