import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { dbService, OrderRecord, ProductOffer, AlertPreferences, CartItemRecord } from '@/services/database';
import { cartStore } from '@/services/cart-store';
import { isNetworkError } from '@/services/api';

// ─── 1. COORDINATEUR DES COMMANDES ACHETEUR (orders.tsx) ──────────────────────

export interface BuyerOrdersState {
  orders: OrderRecord[];
  loadedBuyerId: string | null;
  selectedOrder: OrderRecord | null;
  ratingOrder: OrderRecord | null;
  isLoading: boolean;
  isOffline: boolean;
  serverError: string | null;
}

export class BuyerOrdersCoordinator {
  private buyerId: string | null;
  private authLoading: boolean;
  private authenticated: boolean;

  // Séquences indépendantes par nature d'opération
  private loadOrdersSeq = 0;
  private ratingSeq = 0;
  private sessionGen = 0;

  private rawOrders: OrderRecord[] = [];
  private loadedBuyerId: string | null = null;
  private selectedOrder: OrderRecord | null = null;
  private ratingOrder: OrderRecord | null = null;
  private isLoading = false;
  private isOffline = false;
  private serverError: string | null = null;

  private listeners = new Set<() => void>();

  constructor(buyerId: string | null = null, authLoading = false, authenticated = false) {
    this.buyerId = buyerId;
    this.authLoading = authLoading;
    this.authenticated = authenticated;
    if (buyerId && !authLoading && authenticated) {
      this.isLoading = true;
      this.loadOrders();
    }
  }

  public subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  // Masquage synchrone immédiat : si l'acheteur actif diffère de celui qui a chargé les données, masquer sans attendre useEffect
  public getState = (): BuyerOrdersState => {
    const isContextValid = Boolean(
      this.buyerId &&
      !this.authLoading &&
      this.authenticated &&
      this.loadedBuyerId === this.buyerId
    );

    return {
      orders: isContextValid ? this.rawOrders : [],
      loadedBuyerId: this.loadedBuyerId,
      selectedOrder: isContextValid ? this.selectedOrder : null,
      ratingOrder: isContextValid ? this.ratingOrder : null,
      isLoading: this.isLoading,
      isOffline: this.isOffline,
      serverError: this.serverError,
    };
  };

  public updateSession(buyerId: string | null, authLoading: boolean, authenticated: boolean) {
    const activeBuyerChanged = this.buyerId !== buyerId;
    const authChanged = this.authLoading !== authLoading || this.authenticated !== authenticated;

    if (!activeBuyerChanged && !authChanged) {
      return;
    }

    this.buyerId = buyerId;
    this.authLoading = authLoading;
    this.authenticated = authenticated;

    // Détecter tout changement de buyerId (y compris A valide -> B valide)
    this.sessionGen++;
    this.rawOrders = [];
    this.loadedBuyerId = null;
    this.selectedOrder = null;
    this.ratingOrder = null;
    this.serverError = null;

    if (buyerId && !authLoading && authenticated) {
      this.isLoading = true;
      this.notify();
      this.loadOrders();
    } else {
      this.isLoading = false;
      this.notify();
    }
  }

  public setSelectedOrder = (order: OrderRecord | null) => {
    this.selectedOrder = order;
    this.notify();
  };

  public setRatingOrder = (order: OrderRecord | null) => {
    this.ratingOrder = order;
    this.notify();
  };

  public loadOrders = async (options?: { onExpired?: () => void; onError?: (msg: string) => void }) => {
    if (this.authLoading || !this.buyerId || !this.authenticated) {
      this.rawOrders = [];
      this.loadedBuyerId = null;
      this.isLoading = false;
      this.notify();
      return;
    }

    const reqId = ++this.loadOrdersSeq;
    const capturedSessionGen = this.sessionGen;
    const capturedBuyerId = this.buyerId;
    const capturedDbGen = dbService.getContextGeneration();

    this.isLoading = true;
    this.serverError = null;
    this.notify();

    const isStale = () =>
      this.loadOrdersSeq !== reqId ||
      this.sessionGen !== capturedSessionGen ||
      this.buyerId !== capturedBuyerId ||
      this.authLoading ||
      !this.authenticated ||
      dbService.getContextGeneration() !== capturedDbGen;

    try {
      await dbService.initDatabase();
      if (isStale()) return;

      const loaded = await dbService.getOrders(true);
      if (isStale()) return;

      this.rawOrders = loaded;
      this.loadedBuyerId = capturedBuyerId;
      this.isOffline = !dbService.isLastOrdersSyncSuccessful();
    } catch (err: any) {
      if (isStale()) return;

      if (err?.status === 401) {
        options?.onExpired?.();
        return;
      }

      if (isNetworkError(err)) {
        try {
          const cached = await dbService.getOrders(false);
          if (isStale()) return;
          this.rawOrders = cached;
          this.loadedBuyerId = capturedBuyerId;
          this.isOffline = true;
        } catch {
          if (isStale()) return;
          this.serverError = 'Impossible de charger les commandes hors ligne.';
        }
      } else {
        const msg = err?.message || 'Erreur lors du chargement des commandes.';
        this.serverError = msg;
        options?.onError?.(msg);
      }
    } finally {
      if (!isStale()) {
        this.isLoading = false;
        this.notify();
      }
    }
  };

  public submitRating = async (
    order: OrderRecord,
    stars: number,
    comment: string,
    callbacks?: { onSuccess?: () => void; onError?: (err: any) => void }
  ): Promise<boolean> => {
    if (!order || stars === 0 || this.authLoading || !this.buyerId || !this.authenticated) {
      return false;
    }

    const reqId = ++this.ratingSeq;
    const capturedSessionGen = this.sessionGen;
    const capturedBuyerId = this.buyerId;
    const capturedDbGen = dbService.getContextGeneration();

    const isStale = () =>
      this.ratingSeq !== reqId ||
      this.sessionGen !== capturedSessionGen ||
      this.buyerId !== capturedBuyerId ||
      this.authLoading ||
      !this.authenticated ||
      dbService.getContextGeneration() !== capturedDbGen;

    try {
      await dbService.addTrustRating(
        order.gicName,
        'gic',
        stars,
        comment.trim(),
        'Acheteur'
      );
      if (isStale()) return false;

      callbacks?.onSuccess?.();
      return true;
    } catch (err) {
      if (isStale()) return false;
      callbacks?.onError?.(err);
      return false;
    }
  };
}

export function useBuyerOrdersCoordinator(
  buyerId: string | null,
  authLoading: boolean,
  authenticated: boolean
) {
  const coordinatorRef = useRef<BuyerOrdersCoordinator | null>(null);
  if (!coordinatorRef.current) {
    coordinatorRef.current = new BuyerOrdersCoordinator(buyerId, authLoading, authenticated);
  }
  const coordinator = coordinatorRef.current;

  const state = useSyncExternalStore(coordinator.subscribe, coordinator.getState);

  useEffect(() => {
    coordinator.updateSession(buyerId, authLoading, authenticated);
  }, [coordinator, buyerId, authLoading, authenticated]);

  return {
    ...state,
    loadOrders: coordinator.loadOrders,
    submitRating: coordinator.submitRating,
    setSelectedOrder: coordinator.setSelectedOrder,
    setRatingOrder: coordinator.setRatingOrder,
  };
}

// ─── 2. COORDINATEUR DES ALERTES RÉCOLTES (alerts.tsx) ────────────────────────

export interface BuyerAlertsState {
  prefs: AlertPreferences;
  matchCount: number;
  isLoading: boolean;
  isDataValid: boolean;
}

export class BuyerAlertsCoordinator {
  private buyerId: string | null;
  private authLoading: boolean;
  private authenticated: boolean;

  // Séquences séparées : la sauvegarde ne bloque ni n'annule le chargement
  private loadAlertsSeq = 0;
  private saveAlertsSeq = 0;
  private sessionGen = 0;

  private rawPrefs: AlertPreferences = { productNames: [], bassins: [] };
  private rawMatchCount = 0;
  private loadedBuyerId: string | null = null;
  private isLoading = false;

  private listeners = new Set<() => void>();

  constructor(buyerId: string | null = null, authLoading = false, authenticated = false) {
    this.buyerId = buyerId;
    this.authLoading = authLoading;
    this.authenticated = authenticated;
    if (buyerId && !authLoading && authenticated) {
      this.isLoading = true;
      this.loadAlerts();
    }
  }

  public subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  // Masquage synchrone immédiat lors d'un switch utilisateur
  public getState = (): BuyerAlertsState => {
    const isDataValid = Boolean(
      this.buyerId &&
      !this.authLoading &&
      this.authenticated &&
      this.loadedBuyerId === this.buyerId
    );

    return {
      prefs: isDataValid ? this.rawPrefs : { productNames: [], bassins: [] },
      matchCount: isDataValid ? this.rawMatchCount : 0,
      isLoading: this.isLoading,
      isDataValid,
    };
  };

  public setPrefs = (newPrefs: AlertPreferences | ((prev: AlertPreferences) => AlertPreferences)) => {
    if (typeof newPrefs === 'function') {
      this.rawPrefs = newPrefs(this.rawPrefs);
    } else {
      this.rawPrefs = newPrefs;
    }
    this.notify();
  };

  public updateSession(buyerId: string | null, authLoading: boolean, authenticated: boolean) {
    const activeBuyerChanged = this.buyerId !== buyerId;
    const authChanged = this.authLoading !== authLoading || this.authenticated !== authenticated;

    if (!activeBuyerChanged && !authChanged) {
      return;
    }

    this.buyerId = buyerId;
    this.authLoading = authLoading;
    this.authenticated = authenticated;

    this.sessionGen++;
    this.rawPrefs = { productNames: [], bassins: [] };
    this.rawMatchCount = 0;
    this.loadedBuyerId = null;

    if (buyerId && !authLoading && authenticated) {
      this.isLoading = true;
      this.notify();
      this.loadAlerts();
    } else {
      this.isLoading = false;
      this.notify();
    }
  }

  public loadAlerts = async () => {
    if (this.authLoading || !this.buyerId || !this.authenticated) {
      this.isLoading = false;
      this.notify();
      return;
    }

    const reqId = ++this.loadAlertsSeq;
    const capturedSessionGen = this.sessionGen;
    const capturedBuyerId = this.buyerId;
    const capturedDbGen = dbService.getContextGeneration();

    this.isLoading = true;
    this.notify();

    const isStale = () =>
      this.loadAlertsSeq !== reqId ||
      this.sessionGen !== capturedSessionGen ||
      this.buyerId !== capturedBuyerId ||
      this.authLoading ||
      !this.authenticated ||
      dbService.getContextGeneration() !== capturedDbGen;

    try {
      await dbService.initDatabase();
      if (isStale()) return;

      const stored = await dbService.getAlertPreferences();
      if (isStale()) return;

      const count = await dbService.getMatchingAlertCount();
      if (isStale()) return;

      this.rawPrefs = stored;
      this.rawMatchCount = count;
      this.loadedBuyerId = capturedBuyerId;
    } catch (err) {
      console.warn('Erreur chargement alertes:', err);
    } finally {
      if (!isStale()) {
        this.isLoading = false;
        this.notify();
      }
    }
  };

  public saveAlerts = async (
    newPrefs: AlertPreferences,
    callbacks?: { onSuccess?: (count: number) => void; onError?: (err: any) => void }
  ): Promise<boolean> => {
    if (this.authLoading || !this.buyerId || !this.authenticated) {
      return false;
    }

    const reqId = ++this.saveAlertsSeq;
    const capturedSessionGen = this.sessionGen;
    const capturedBuyerId = this.buyerId;
    const capturedDbGen = dbService.getContextGeneration();

    const isStale = () =>
      this.saveAlertsSeq !== reqId ||
      this.sessionGen !== capturedSessionGen ||
      this.buyerId !== capturedBuyerId ||
      this.authLoading ||
      !this.authenticated ||
      dbService.getContextGeneration() !== capturedDbGen;

    try {
      await dbService.saveAlertPreferences(newPrefs);
      if (isStale()) return false;

      const updatedCount = await dbService.getMatchingAlertCount();
      if (isStale()) return false;

      this.rawPrefs = newPrefs;
      this.rawMatchCount = updatedCount;
      this.loadedBuyerId = capturedBuyerId;
      this.notify();

      callbacks?.onSuccess?.(updatedCount);
      return true;
    } catch (err: any) {
      if (isStale()) return false;
      callbacks?.onError?.(err);
      return false;
    }
  };
}

export function useBuyerAlertsCoordinator(
  buyerId: string | null,
  authLoading: boolean,
  authenticated: boolean
) {
  const coordinatorRef = useRef<BuyerAlertsCoordinator | null>(null);
  if (!coordinatorRef.current) {
    coordinatorRef.current = new BuyerAlertsCoordinator(buyerId, authLoading, authenticated);
  }
  const coordinator = coordinatorRef.current;

  const state = useSyncExternalStore(coordinator.subscribe, coordinator.getState);

  useEffect(() => {
    coordinator.updateSession(buyerId, authLoading, authenticated);
  }, [coordinator, buyerId, authLoading, authenticated]);

  return {
    ...state,
    setPrefs: coordinator.setPrefs,
    loadAlerts: coordinator.loadAlerts,
    saveAlerts: coordinator.saveAlerts,
  };
}

// ─── 3. COORDINATEUR DE VALIDATION DU PANIER (checkout.tsx) ───────────────────

export interface BuyerCheckoutState {
  isCartAligned: boolean;
  effectiveCart: CartItemRecord[];
  effectiveTotalAmount: number;
  busy: boolean;
  products: ProductOffer[];
}

export class BuyerCheckoutCoordinator {
  private buyerId: string | null;
  private authLoading: boolean;
  private authenticated: boolean;

  private loadProductsSeq = 0;
  private confirmOrderSeq = 0;
  private sessionGen = 0;

  private busy = false;
  private products: ProductOffer[] = [];

  private listeners = new Set<() => void>();

  constructor(buyerId: string | null = null, authLoading = false, authenticated = false) {
    this.buyerId = buyerId;
    this.authLoading = authLoading;
    this.authenticated = authenticated;
    if (buyerId && !authLoading && authenticated) {
      this.loadProducts();
    }
  }

  public subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public getState = (cart: CartItemRecord[] = [], totalAmount = 0): BuyerCheckoutState => {
    const isCartAligned = Boolean(
      !this.authLoading &&
      this.buyerId &&
      this.authenticated &&
      cartStore.getBuyerId() === this.buyerId
    );

    return {
      isCartAligned,
      effectiveCart: isCartAligned ? cart : [],
      effectiveTotalAmount: isCartAligned ? totalAmount : 0,
      busy: this.busy,
      products: this.products,
    };
  };

  public updateSession(buyerId: string | null, authLoading: boolean, authenticated: boolean) {
    const activeBuyerChanged = this.buyerId !== buyerId;
    const authChanged = this.authLoading !== authLoading || this.authenticated !== authenticated;

    if (!activeBuyerChanged && !authChanged) {
      return;
    }

    this.buyerId = buyerId;
    this.authLoading = authLoading;
    this.authenticated = authenticated;

    this.sessionGen++;
    // Remettre immédiatement busy à false lors du changement de contexte
    this.busy = false;

    if (buyerId && !authLoading && authenticated) {
      this.notify();
      this.loadProducts();
    } else {
      this.notify();
    }
  }

  public loadProducts = async () => {
    if (this.authLoading || !this.buyerId || !this.authenticated) return;

    const reqId = ++this.loadProductsSeq;
    const capturedSessionGen = this.sessionGen;
    const capturedBuyerId = this.buyerId;
    const capturedDbGen = dbService.getContextGeneration();

    const isStale = () =>
      this.loadProductsSeq !== reqId ||
      this.sessionGen !== capturedSessionGen ||
      this.buyerId !== capturedBuyerId ||
      this.authLoading ||
      !this.authenticated ||
      dbService.getContextGeneration() !== capturedDbGen;

    try {
      const items = await dbService.getProducts();
      if (isStale()) return;
      this.products = items;
      this.notify();
    } catch {
      // Ignorer les erreurs d'affichage catalogue
    }
  };

  public confirmOrder = async (
    orderType: any,
    refreshCart: () => Promise<void>,
    callbacks: { onSuccess: () => void; onError: (err: any) => void },
    cart: CartItemRecord[] = []
  ): Promise<boolean> => {
    const isAligned = Boolean(
      !this.authLoading &&
      this.buyerId &&
      this.authenticated &&
      cartStore.getBuyerId() === this.buyerId
    );

    if (!isAligned || this.busy || !cart.length || this.authLoading || !this.buyerId || !this.authenticated) {
      return false;
    }

    const reqId = ++this.confirmOrderSeq;
    const capturedSessionGen = this.sessionGen;
    const capturedBuyerId = this.buyerId;
    const capturedDbGen = dbService.getContextGeneration();

    this.busy = true;
    this.notify();

    const isStale = () =>
      this.confirmOrderSeq !== reqId ||
      this.sessionGen !== capturedSessionGen ||
      this.buyerId !== capturedBuyerId ||
      this.authLoading ||
      !this.authenticated ||
      dbService.getContextGeneration() !== capturedDbGen;

    try {
      await dbService.createOrderFromCart(orderType);
      if (isStale()) return false;

      await refreshCart();
      if (isStale()) return false;

      callbacks.onSuccess();
      return true;
    } catch (err: any) {
      if (isStale()) return false;
      callbacks.onError(err);
      return false;
    } finally {
      if (this.confirmOrderSeq === reqId && this.sessionGen === capturedSessionGen) {
        this.busy = false;
        this.notify();
      }
    }
  };
}

export function useBuyerCheckoutCoordinator(
  buyerId: string | null,
  authLoading: boolean,
  authenticated: boolean,
  cart: CartItemRecord[],
  totalAmount: number,
  refreshCart: () => Promise<void>
) {
  const coordinatorRef = useRef<BuyerCheckoutCoordinator | null>(null);
  if (!coordinatorRef.current) {
    coordinatorRef.current = new BuyerCheckoutCoordinator(buyerId, authLoading, authenticated);
  }
  const coordinator = coordinatorRef.current;

  const getSnapshot = useCallback(
    () => coordinator.getState(cart, totalAmount),
    [coordinator, cart, totalAmount]
  );
  const state = useSyncExternalStore(coordinator.subscribe, getSnapshot);

  useEffect(() => {
    coordinator.updateSession(buyerId, authLoading, authenticated);
  }, [coordinator, buyerId, authLoading, authenticated]);

  const confirmOrder = useCallback(
    (
      orderType: any,
      callbacks: { onSuccess: () => void; onError: (err: any) => void }
    ) => coordinator.confirmOrder(orderType, refreshCart, callbacks, cart),
    [coordinator, refreshCart, cart]
  );

  return {
    ...state,
    loadProducts: coordinator.loadProducts,
    confirmOrder,
  };
}

// ─── 4. COORDINATEUR DE L'ACCUEIL ACHETEUR (home.tsx) ─────────────────────────

export interface BuyerHomeState {
  isCartAligned: boolean;
  effectiveCartCount: number;
  alertCount: number;
  products: ProductOffer[];
  isLoading: boolean;
}

export class BuyerHomeCoordinator {
  private buyerId: string | null;
  private authLoading: boolean;
  private authenticated: boolean;

  // Séquences indépendantes : l'ajout au panier ne bloque pas la synchro silencieuse
  private syncSeq = 0;
  private cartActionSeq = 0;
  private sessionGen = 0;

  private rawAlertCount = 0;
  private loadedAlertBuyerId: string | null = null;
  private products: ProductOffer[] = [];
  private isLoading = false;

  private listeners = new Set<() => void>();

  constructor(buyerId: string | null = null, authLoading = false, authenticated = false) {
    this.buyerId = buyerId;
    this.authLoading = authLoading;
    this.authenticated = authenticated;
    if (!authLoading) {
      this.isLoading = true;
      this.silentSync();
    }
  }

  public subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public getState = (cartCount = 0): BuyerHomeState => {
    const isCartAligned = Boolean(
      !this.authLoading &&
      this.buyerId &&
      this.authenticated &&
      cartStore.getBuyerId() === this.buyerId
    );

    // Associer alertCount à l'acheteur qui l'a chargé, ne jamais afficher le compteur de A à B
    const isAlertAligned = Boolean(
      !this.authLoading &&
      this.buyerId &&
      this.authenticated &&
      this.loadedAlertBuyerId === this.buyerId
    );

    return {
      isCartAligned,
      effectiveCartCount: isCartAligned ? cartCount : 0,
      alertCount: isAlertAligned ? this.rawAlertCount : 0,
      products: this.products,
      isLoading: this.isLoading,
    };
  };

  public updateSession(buyerId: string | null, authLoading: boolean, authenticated: boolean) {
    const activeBuyerChanged = this.buyerId !== buyerId;
    const authChanged = this.authLoading !== authLoading || this.authenticated !== authenticated;

    if (!activeBuyerChanged && !authChanged) {
      return;
    }

    this.buyerId = buyerId;
    this.authLoading = authLoading;
    this.authenticated = authenticated;

    this.sessionGen++;
    // Compteur d'alertes A déjà affiché, bascule directe vers B : zéro immédiatement !
    this.rawAlertCount = 0;
    this.loadedAlertBuyerId = null;

    if (!authLoading) {
      this.isLoading = true;
      this.notify();
      this.silentSync();
    } else {
      this.isLoading = false;
      this.notify();
    }
  }

  public silentSync = async () => {
    const reqId = ++this.syncSeq;
    const capturedSessionGen = this.sessionGen;
    const capturedBuyerId = this.buyerId;
    const capturedDbGen = dbService.getContextGeneration();

    const isStale = () =>
      this.syncSeq !== reqId ||
      this.sessionGen !== capturedSessionGen ||
      this.buyerId !== capturedBuyerId ||
      this.authLoading ||
      !this.authenticated ||
      dbService.getContextGeneration() !== capturedDbGen;

    try {
      await dbService.initDatabase();
      if (isStale()) return;

      await dbService.syncPublicData().catch(() => {});
      if (isStale()) return;

      if (capturedBuyerId && !this.authLoading && this.authenticated) {
        await dbService.syncBuyerData(capturedBuyerId).catch(() => {});
        if (isStale()) return;
      }

      const [offers, matches] = await Promise.all([
        dbService.getProducts(),
        capturedBuyerId && !this.authLoading && this.authenticated
          ? dbService.getMatchingAlertCount().catch(() => 0)
          : Promise.resolve(0),
      ]);
      if (isStale()) return;

      this.rawAlertCount = matches;
      this.loadedAlertBuyerId = capturedBuyerId;
      this.products = offers;
      this.notify();
    } catch (err) {
      console.warn('Erreur synchro silencieuse acheteur:', err);
    } finally {
      if (!isStale()) {
        this.isLoading = false;
        this.notify();
      }
    }
  };

  public handleAddToCartSafe = async (
    product: ProductOffer,
    addProductToCart: (product: any, maxStock?: number) => Promise<any>,
    callbacks?: { onSuccess?: () => void; onError?: (err: any) => void }
  ): Promise<boolean> => {
    // Séquence indépendante pour l'ajout au panier
    const reqId = ++this.cartActionSeq;
    const capturedSessionGen = this.sessionGen;
    const capturedBuyerId = this.buyerId;
    const capturedDbGen = dbService.getContextGeneration();

    const isStale = () =>
      this.cartActionSeq !== reqId ||
      this.sessionGen !== capturedSessionGen ||
      this.buyerId !== capturedBuyerId ||
      this.authLoading ||
      !this.authenticated ||
      dbService.getContextGeneration() !== capturedDbGen;

    try {
      await addProductToCart(
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          unit: product.unit,
        },
        product.volumeDisponible
      );
      if (isStale()) return false;

      callbacks?.onSuccess?.();
      return true;
    } catch (err: any) {
      if (isStale()) return false;
      callbacks?.onError?.(err);
      return false;
    }
  };
}

export function useBuyerHomeCoordinator(
  buyerId: string | null,
  authLoading: boolean,
  authenticated: boolean,
  cartCount: number,
  addProductToCart: (product: any, maxStock?: number) => Promise<any>
) {
  const coordinatorRef = useRef<BuyerHomeCoordinator | null>(null);
  if (!coordinatorRef.current) {
    coordinatorRef.current = new BuyerHomeCoordinator(buyerId, authLoading, authenticated);
  }
  const coordinator = coordinatorRef.current;

  const getSnapshot = useCallback(
    () => coordinator.getState(cartCount),
    [coordinator, cartCount]
  );
  const state = useSyncExternalStore(coordinator.subscribe, getSnapshot);

  useEffect(() => {
    coordinator.updateSession(buyerId, authLoading, authenticated);
  }, [coordinator, buyerId, authLoading, authenticated]);

  const handleAddToCartSafe = useCallback(
    (product: ProductOffer, callbacks?: { onSuccess?: () => void; onError?: (err: any) => void }) =>
      coordinator.handleAddToCartSafe(product, addProductToCart, callbacks),
    [coordinator, addProductToCart]
  );

  return {
    ...state,
    silentSync: coordinator.silentSync,
    handleAddToCartSafe,
  };
}
