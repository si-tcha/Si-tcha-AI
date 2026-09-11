import React, { useEffect, useState } from 'react';
import { dbService, CartItemRecord } from './database';

type Listener = () => void;

class CartStore {
  private cart: CartItemRecord[] = [];
  private listeners: Set<Listener> = new Set();
  private initialized = false;

  async init() {
    if (!dbService.getActiveBuyerId()) {
      this.cart = [];
      this.initialized = true;
      this.notify();
      return;
    }
    try {
      await dbService.initDatabase();
      this.cart = await dbService.getCart();
      this.initialized = true;
      this.notify();
    } catch (err) {
      console.warn('Erreur init cartStore:', err);
    }
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
    await dbService.initDatabase();
    const item = await dbService.addToCart(product, maxStock);
    this.cart = await dbService.getCart();
    this.initialized = true;
    this.notify();
    return item;
  }

  async incrementCartItem(productId: string, maxStock?: number) {
    await dbService.initDatabase();
    const item = await dbService.incrementCartItem(productId, maxStock);
    this.cart = await dbService.getCart();
    this.initialized = true;
    this.notify();
    return item;
  }

  async decrementCartItem(productId: string) {
    await dbService.initDatabase();
    const item = await dbService.decrementCartItem(productId);
    this.cart = await dbService.getCart();
    this.initialized = true;
    this.notify();
    return item;
  }

  async removeFromCart(productId: string) {
    await dbService.initDatabase();
    await dbService.removeFromCart(productId);
    this.cart = await dbService.getCart();
    this.initialized = true;
    this.notify();
  }

  async clearCart() {
    await dbService.initDatabase();
    await dbService.clearCart();
    this.cart = [];
    this.initialized = true;
    this.notify();
  }

  async refresh() {
    if (!dbService.getActiveBuyerId()) {
      this.cart = [];
      this.initialized = true;
      this.notify();
      return;
    }
    try {
      await dbService.initDatabase();
      this.cart = await dbService.getCart();
    } catch {
      this.cart = [];
    }
    this.initialized = true;
    this.notify();
  }

  async setBuyerId(buyerId: string | null) {
    dbService.setActiveBuyerId(buyerId);
    this.cart = [];
    this.initialized = false;
    this.notify();
    if (buyerId) {
      await this.refresh();
    }
  }

  reset() {
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
