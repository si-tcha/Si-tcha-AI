import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dbService as webDbService } from '../src/services/database.web';
import { cartStore } from '../src/services/cart-store';
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

  beforeEach(async () => {
    localStorage.clear();
    await webDbService.clearCart();
    await cartStore.clearCart();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(initialCache));

      // 2. Simule une panne réseau lors de la synchronisation
      vi.spyOn(apiClient, 'getOrders').mockRejectedValueOnce(new ApiError('Pas de réseau', 0));

      const orders = await webDbService.getOrders(true);

      // Ne plante pas, retourne le cache local, et signale l'état de synchronisation
      expect(orders).toHaveLength(1);
      expect(orders[0].id).toBe('ord-cached');
      expect(webDbService.isLastOrdersSyncSuccessful()).toBe(false);

      // Le cache local n'a pas été effacé ou corrompu
      const rawStored = JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDERS) || '[]');
      expect(rawStored).toHaveLength(1);
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
  });

  describe('7. Parité de comportement Natif SQLite (database.ts)', () => {
    // Import dynamique du service natif SQLite
    let nativeDbService: any;

    beforeEach(async () => {
      (globalThis as any).resetSqliteMock?.();
      // @ts-ignore - vitest needs explicit .ts to distinguish from database.web.ts
      const mod = await import('../src/services/database.ts');
      nativeDbService = mod.dbService;
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
});
