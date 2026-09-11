import React, { useEffect, useState } from 'react';
import { dbService, CartItemRecord } from './database';
import { validateBuyerId, isValidBuyerId } from './database.shared';

type Listener = () => void;

class CartStore {
  private cart: CartItemRecord[] = [];
  private listeners: Set<Listener> = new Set();
  private initialized = false;
  private currentBuyerId: string | null = null;
  private currentGeneration = 0;

  getBuyerId(): string | null {
    return this.currentBuyerId;
  }

  getGeneration(): number {
    return this.currentGeneration;
  }

  async init() {
    const buyerId = dbService.getActiveBuyerId();
    if (!buyerId || !isValidBuyerId(buyerId)) {
      this.currentBuyerId = null;
      this.currentGeneration++;
      this.cart = [];
      this.initialized = true;
      this.notify();
      return;
    }
    await this.setBuyerId(buyerId);
  }

  getCart(): CartItemRecord[] {
    return this.cart;
  }

  getCount(): number {
    return this.cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  getTotalAmount(): number {
    return this.cart.reduce(
      (sum, item) => sum + (parseFloat(item.price || '0') * item.quantity),
      0
    );
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    this.refresh();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  async addToCart(
    product: { productId: string; name: string; price: string; unit: string },
    maxStock?: number
  ) {
    const capturedBuyerId = this.currentBuyerId;
    const capturedGen = this.currentGeneration;
    if (!capturedBuyerId) {
      throw new Error('Opération non autorisée : aucun acheteur connecté.');
    }

    await dbService.initDatabase();
    if (this.currentGeneration !== capturedGen || this.currentBuyerId !== capturedBuyerId) {
      throw new Error('Contexte acheteur modifié.');
    }

    const item = await dbService.addToCart(product, maxStock);
    if (this.currentGeneration !== capturedGen || this.currentBuyerId !== capturedBuyerId) {
      return item;
    }

    const cart = await dbService.getCartForBuyer(capturedBuyerId);
    if (this.currentGeneration !== capturedGen || this.currentBuyerId !== capturedBuyerId) {
      return item;
    }

    this.cart = cart;
    this.initialized = true;
    this.notify();
    return item;
  }

  async incrementCartItem(productId: string, maxStock?: number) {
    const capturedBuyerId = this.currentBuyerId;
    const capturedGen = this.currentGeneration;
    if (!capturedBuyerId) {
      throw new Error('Opération non autorisée : aucun acheteur connecté.');
    }

    await dbService.initDatabase();
    if (this.currentGeneration !== capturedGen || this.currentBuyerId !== capturedBuyerId) {
      throw new Error('Contexte acheteur modifié.');
    }

    const item = await dbService.incrementCartItem(productId, maxStock);
    if (this.currentGeneration !== capturedGen || this.currentBuyerId !== capturedBuyerId) {
      return item;
    }

    const cart = await dbService.getCartForBuyer(capturedBuyerId);
    if (this.currentGeneration !== capturedGen || this.currentBuyerId !== capturedBuyerId) {
      return item;
    }

    this.cart = cart;
    this.initialized = true;
    this.notify();
    return item;
  }

  async decrementCartItem(productId: string) {
    const capturedBuyerId = this.currentBuyerId;
    const capturedGen = this.currentGeneration;
    if (!capturedBuyerId) {
      throw new Error('Opération non autorisée : aucun acheteur connecté.');
    }

    await dbService.initDatabase();
    if (this.currentGeneration !== capturedGen || this.currentBuyerId !== capturedBuyerId) {
      throw new Error('Contexte acheteur modifié.');
    }

    const item = await dbService.decrementCartItem(productId);
    if (this.currentGeneration !== capturedGen || this.currentBuyerId !== capturedBuyerId) {
      return item;
    }

    const cart = await dbService.getCartForBuyer(capturedBuyerId);
    if (this.currentGeneration !== capturedGen || this.currentBuyerId !== capturedBuyerId) {
      return item;
    }

    this.cart = cart;
    this.initialized = true;
    this.notify();
    return item;
  }

  async removeFromCart(productId: string) {
    const capturedBuyerId = this.currentBuyerId;
    const capturedGen = this.currentGeneration;
    if (!capturedBuyerId) {
      throw new Error('Opération non autorisée : aucun acheteur connecté.');
    }

    await dbService.initDatabase();
    if (this.currentGeneration !== capturedGen || this.currentBuyerId !== capturedBuyerId) {
      throw new Error('Contexte acheteur modifié.');
    }

    await dbService.removeFromCart(productId);
    if (this.currentGeneration !== capturedGen || this.currentBuyerId !== capturedBuyerId) {
      return;
    }

    const cart = await dbService.getCartForBuyer(capturedBuyerId);
    if (this.currentGeneration !== capturedGen || this.currentBuyerId !== capturedBuyerId) {
      return;
    }

    this.cart = cart;
    this.initialized = true;
    this.notify();
  }

  async clearCart() {
    const capturedBuyerId = this.currentBuyerId;
    const capturedGen = this.currentGeneration;
    if (!capturedBuyerId) {
      throw new Error('Opération non autorisée : aucun acheteur connecté.');
    }

    await dbService.initDatabase();
    if (this.currentGeneration !== capturedGen || this.currentBuyerId !== capturedBuyerId) {
      throw new Error('Contexte acheteur modifié.');
    }

    await dbService.clearCart();
    if (this.currentGeneration !== capturedGen || this.currentBuyerId !== capturedBuyerId) {
      return;
    }

    this.cart = [];
    this.initialized = true;
    this.notify();
  }

  async refresh(targetBuyerId?: string | null, targetGen?: number) {
    const capturedBuyerId = targetBuyerId !== undefined ? targetBuyerId : this.currentBuyerId;
    const capturedGen = targetGen !== undefined ? targetGen : this.currentGeneration;

    if (!capturedBuyerId) {
      if (this.currentGeneration === capturedGen) {
        this.cart = [];
        this.initialized = true;
        this.notify();
      }
      return;
    }

    try {
      await dbService.initDatabase();
      if (this.currentGeneration !== capturedGen || this.currentBuyerId !== capturedBuyerId) {
        return;
      }
      const cart = await dbService.getCartForBuyer(capturedBuyerId);
      if (this.currentGeneration !== capturedGen || this.currentBuyerId !== capturedBuyerId) {
        return;
      }
      this.cart = cart;
      this.initialized = true;
      this.notify();
    } catch {
      if (this.currentGeneration === capturedGen && this.currentBuyerId === capturedBuyerId) {
        this.cart = [];
        this.initialized = true;
        this.notify();
      }
    }
  }

  async setBuyerId(buyerId: string | null) {
    const validBuyerId = buyerId && isValidBuyerId(buyerId) ? validateBuyerId(buyerId) : null;
    this.currentGeneration++;
    const gen = this.currentGeneration;
    this.currentBuyerId = validBuyerId;
    dbService.setActiveBuyerId(validBuyerId);
    this.cart = [];
    this.initialized = false;
    this.notify();

    if (validBuyerId) {
      await this.refresh(validBuyerId, gen);
    }
  }

  reset() {
    this.currentGeneration++;
    this.currentBuyerId = null;
    dbService.setActiveBuyerId(null);
    this.cart = [];
    this.initialized = false;
    this.notify();
  }
}

export const cartStore = new CartStore();

export function useCart() {
  const [cart, setCart] = useState<CartItemRecord[]>(cartStore.getCart());
  const [cartCount, setCartCount] = useState<number>(cartStore.getCount());
  const [totalAmount, setTotalAmount] = useState<number>(cartStore.getTotalAmount());

  useEffect(() => {
    cartStore.refresh();
    const unsubscribe = cartStore.subscribe(() => {
      setCart([...cartStore.getCart()]);
      setCartCount(cartStore.getCount());
      setTotalAmount(cartStore.getTotalAmount());
    });
    return unsubscribe;
  }, []);

  const addToCart = React.useCallback(
    (p: { productId: string; name: string; price: string; unit: string }, maxStock?: number) =>
      cartStore.addToCart(p, maxStock),
    []
  );

  const incrementCartItem = React.useCallback(
    (productId: string, maxStock?: number) => cartStore.incrementCartItem(productId, maxStock),
    []
  );

  const decrementCartItem = React.useCallback(
    (productId: string) => cartStore.decrementCartItem(productId),
    []
  );

  const removeFromCart = React.useCallback(
    (productId: string) => cartStore.removeFromCart(productId),
    []
  );

  const clearCart = React.useCallback(() => cartStore.clearCart(), []);

  const refreshCart = React.useCallback(() => cartStore.refresh(), []);

  return {
    cart,
    cartCount,
    totalAmount,
    addToCart,
    incrementCartItem,
    decrementCartItem,
    removeFromCart,
    clearCart,
    refreshCart,
  };
}
