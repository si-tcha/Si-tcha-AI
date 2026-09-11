import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { dbService, OrderRecord, ProductOffer, AlertPreferences, CartItemRecord } from '@/services/database';
import { cartStore } from '@/services/cart-store';
import { isNetworkError } from '@/services/api';

const EMPTY_ORDERS: OrderRecord[] = Object.freeze([]) as any;
const DEFAULT_PREFERENCES: AlertPreferences = Object.freeze({ productNames: [], bassins: [] }) as any;

// ─── 1. COORDINATEUR DES COMMANDES ACHETEUR (orders.tsx) ──────────────────────

export interface BuyerOrdersStoreState {
  orders: OrderRecord[];
  loadedBuyerId: string | null;
  selectedOrder: OrderRecord | null;
  ratingOrder: OrderRecord | null;
  isLoading: boolean;
  isOffline: boolean;
  serverError: string | null;
}

export type BuyerOrdersState = BuyerOrdersStoreState & { isDataValid?: boolean };

export class BuyerOrdersCoordinator {
  private buyerId: string | null = null;
  private authLoading = false;
  private authenticated = false;

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
  private snapshot: BuyerOrdersStoreState;

  // Déduplication sous Strict Mode & requêtes en vol
  private inFlightPromise: Promise<void> | null = null;
  private inFlightBuyerId: string | null = null;
  private inFlightGen = -1;
  private isInitialized = false;

  constructor(buyerId: string | null = null, authLoading = false, authenticated = false) {
    this.buyerId = buyerId;
    this.authLoading = authLoading;
    this.authenticated = authenticated;
    this.snapshot = Object.freeze({
      orders: EMPTY_ORDERS,
      loadedBuyerId: null,
      selectedOrder: null,
      ratingOrder: null,
      isLoading: Boolean(buyerId && !authLoading && authenticated),
      isOffline: false,
      serverError: null,
    });
    // Pureté React : aucun effet ni appel réseau dans le constructeur
  }

  public subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify() {
    this.snapshot = Object.freeze({
      orders: this.rawOrders.length ? [...this.rawOrders] : EMPTY_ORDERS,
      loadedBuyerId: this.loadedBuyerId,
      selectedOrder: this.selectedOrder,
      ratingOrder: this.ratingOrder,
      isLoading: this.isLoading,
      isOffline: this.isOffline,
      serverError: this.serverError,
    });
    for (const listener of this.listeners) {
      listener();
    }
  }

  public getSnapshot = (): BuyerOrdersStoreState => {
    return this.snapshot;
  };

  public getServerSnapshot = (): BuyerOrdersStoreState => {
    return this.snapshot;
  };

  public getState = (): BuyerOrdersState => {
    return this.snapshot;
  };

  public updateSession(buyerId: string | null, authLoading: boolean, authenticated: boolean) {
    const activeBuyerChanged = !this.isInitialized || this.buyerId !== buyerId;
    const authChanged = !this.isInitialized || this.authLoading !== authLoading || this.authenticated !== authenticated;
    this.isInitialized = true;

    if (!activeBuyerChanged && !authChanged) {
      return;
    }

    this.buyerId = buyerId;
    this.authLoading = authLoading;
    this.authenticated = authenticated;

    if (activeBuyerChanged) {
      this.sessionGen++;
      this.rawOrders = [];
      this.loadedBuyerId = null;
      this.selectedOrder = null;
      this.ratingOrder = null;
      this.serverError = null;
    }

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

  public loadOrders = async (options?: { onExpired?: () => void; onError?: (msg: string) => void }): Promise<void> => {
    if (this.authLoading || !this.buyerId || !this.authenticated) {
      this.rawOrders = [];
      this.loadedBuyerId = null;
      this.isLoading = false;
      this.notify();
      return;
    }

    // Déduplication sous Strict Mode si une requête identique est déjà en cours
    if (
      this.inFlightPromise &&
      this.inFlightBuyerId === this.buyerId &&
      this.inFlightGen === this.sessionGen
    ) {
      return this.inFlightPromise;
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

    const task = (async () => {
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
        if (this.inFlightBuyerId === capturedBuyerId && this.inFlightGen === capturedSessionGen) {
          this.inFlightPromise = null;
          this.inFlightBuyerId = null;
        }
      }
    })();

    this.inFlightPromise = task;
    this.inFlightBuyerId = capturedBuyerId;
    this.inFlightGen = capturedSessionGen;

    return task;
  };

  public submitRating = async (
    order: OrderRecord,
    stars: number,
    comment: string,
    callbacks?: { onSuccess?: () => void; onError?: (err: any) => void }
  ): Promise<boolean> => {
    if (this.authLoading || !this.buyerId || !this.authenticated) {
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

  const rawState = useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getSnapshot,
    coordinator.getServerSnapshot
  );

  useEffect(() => {
    coordinator.updateSession(buyerId, authLoading, authenticated);
  }, [coordinator, buyerId, authLoading, authenticated]);

  // DERIVATION SYNCHRONE IMMEDIATE AVEC LES PROPS COURANTES (GARANTIE PREMIER RENDU A -> B)
  const isDataValid = Boolean(
    !authLoading &&
    authenticated &&
    buyerId &&
    rawState.loadedBuyerId === buyerId
  );

  return {
    orders: isDataValid ? rawState.orders : EMPTY_ORDERS,
    loadedBuyerId: isDataValid ? rawState.loadedBuyerId : null,
    selectedOrder: isDataValid ? rawState.selectedOrder : null,
    ratingOrder: isDataValid ? rawState.ratingOrder : null,
    isLoading: isDataValid ? rawState.isLoading : Boolean(buyerId && !authLoading && authenticated),
    isOffline: isDataValid ? rawState.isOffline : false,
    serverError: isDataValid ? rawState.serverError : null,
    isDataValid,
    loadOrders: coordinator.loadOrders,
    submitRating: coordinator.submitRating,
    setSelectedOrder: coordinator.setSelectedOrder,
    setRatingOrder: coordinator.setRatingOrder,
  };
}

// ─── 2. COORDINATEUR DES ALERTES RÉCOLTES (alerts.tsx) ────────────────────────

export interface BuyerAlertsStoreState {
  prefs: AlertPreferences;
  matchCount: number;
  isLoading: boolean;
  loadedBuyerId: string | null;
}

export type BuyerAlertsState = BuyerAlertsStoreState & { isDataValid: boolean };

export class BuyerAlertsCoordinator {
  private buyerId: string | null = null;
  private authLoading = false;
  private authenticated = false;

  // Séquences séparées : la sauvegarde ne bloque ni n'annule le chargement
  private loadAlertsSeq = 0;
  private saveAlertsSeq = 0;
  private sessionGen = 0;

  private rawPrefs: AlertPreferences = DEFAULT_PREFERENCES;
  private rawMatchCount = 0;
  private loadedBuyerId: string | null = null;
  private isLoading = false;

  private listeners = new Set<() => void>();
  private snapshot: BuyerAlertsStoreState;

  private inFlightPromise: Promise<void> | null = null;
  private inFlightBuyerId: string | null = null;
  private inFlightGen = -1;
  private isInitialized = false;

  constructor(buyerId: string | null = null, authLoading = false, authenticated = false) {
    this.buyerId = buyerId;
    this.authLoading = authLoading;
    this.authenticated = authenticated;
    this.snapshot = Object.freeze({
      prefs: DEFAULT_PREFERENCES,
      matchCount: 0,
      isLoading: Boolean(buyerId && !authLoading && authenticated),
      loadedBuyerId: null,
    });
    // Pureté React : aucun effet ni appel réseau dans le constructeur
  }

  public subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify() {
    this.snapshot = Object.freeze({
      prefs: this.rawPrefs,
      matchCount: this.rawMatchCount,
      isLoading: this.isLoading,
      loadedBuyerId: this.loadedBuyerId,
    });
    for (const listener of this.listeners) {
      listener();
    }
  }

  public getSnapshot = (): BuyerAlertsStoreState => {
    return this.snapshot;
  };

  public getServerSnapshot = (): BuyerAlertsStoreState => {
    return this.snapshot;
  };

  public getState = (): BuyerAlertsState => {
    const isDataValid = Boolean(
      this.buyerId &&
      !this.authLoading &&
      this.authenticated &&
      this.loadedBuyerId === this.buyerId
    );
    return {
      ...this.snapshot,
      prefs: isDataValid ? this.snapshot.prefs : DEFAULT_PREFERENCES,
      matchCount: isDataValid ? this.snapshot.matchCount : 0,
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
    const activeBuyerChanged = !this.isInitialized || this.buyerId !== buyerId;
    const authChanged = !this.isInitialized || this.authLoading !== authLoading || this.authenticated !== authenticated;
    this.isInitialized = true;

    if (!activeBuyerChanged && !authChanged) {
      return;
    }

    this.buyerId = buyerId;
    this.authLoading = authLoading;
    this.authenticated = authenticated;

    if (activeBuyerChanged) {
      this.sessionGen++;
      this.rawPrefs = DEFAULT_PREFERENCES;
      this.rawMatchCount = 0;
      this.loadedBuyerId = null;
    }

    if (buyerId && !authLoading && authenticated) {
      this.isLoading = true;
      this.notify();
      this.loadAlerts();
    } else {
      this.isLoading = false;
      this.notify();
    }
  }

  public loadAlerts = async (): Promise<void> => {
    if (this.authLoading || !this.buyerId || !this.authenticated) {
      this.isLoading = false;
      this.notify();
      return;
    }

    if (
      this.inFlightPromise &&
      this.inFlightBuyerId === this.buyerId &&
      this.inFlightGen === this.sessionGen
    ) {
      return this.inFlightPromise;
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

    const task = (async () => {
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
        if (this.inFlightBuyerId === capturedBuyerId && this.inFlightGen === capturedSessionGen) {
          this.inFlightPromise = null;
          this.inFlightBuyerId = null;
        }
      }
    })();

    this.inFlightPromise = task;
    this.inFlightBuyerId = capturedBuyerId;
    this.inFlightGen = capturedSessionGen;

    return task;
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

  const rawState = useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getSnapshot,
    coordinator.getServerSnapshot
  );

  useEffect(() => {
    coordinator.updateSession(buyerId, authLoading, authenticated);
  }, [coordinator, buyerId, authLoading, authenticated]);

  const isDataValid = Boolean(
    !authLoading &&
    authenticated &&
    buyerId &&
    rawState.loadedBuyerId === buyerId
  );

  return {
    prefs: isDataValid ? rawState.prefs : DEFAULT_PREFERENCES,
    matchCount: isDataValid ? rawState.matchCount : 0,
    isLoading: isDataValid ? rawState.isLoading : Boolean(buyerId && !authLoading && authenticated),
    isDataValid,
    setPrefs: coordinator.setPrefs,
    loadAlerts: coordinator.loadAlerts,
    saveAlerts: coordinator.saveAlerts,
  };
}

// ─── 3. COORDINATEUR DE VALIDATION DU PANIER (checkout.tsx) ───────────────────

const EMPTY_CART: CartItemRecord[] = Object.freeze([]) as any;
const EMPTY_PRODUCTS: ProductOffer[] = Object.freeze([]) as any;

export interface BuyerCheckoutStoreState {
  busy: boolean;
  products: ProductOffer[];
  isLoadingProducts: boolean;
  loadedBuyerId: string | null;
}

export interface BuyerCheckoutState {
  isCartAligned: boolean;
  effectiveCart: CartItemRecord[];
  effectiveTotalAmount: number;
  busy: boolean;
  products: ProductOffer[];
  isLoading: boolean;
}

export class BuyerCheckoutCoordinator {
  private buyerId: string | null = null;
  private authLoading = false;
  private authenticated = false;

  private loadProductsSeq = 0;
  private confirmOrderSeq = 0;
  private sessionGen = 0;

  private busy = false;
  private products: ProductOffer[] = EMPTY_PRODUCTS;
  private isLoadingProducts = false;
  private loadedBuyerId: string | null = null;

  private listeners = new Set<() => void>();
  private snapshot: BuyerCheckoutStoreState;

  private inFlightPromise: Promise<void> | null = null;
  private inFlightBuyerId: string | null = null;
  private inFlightGen = -1;
  private isInitialized = false;

  constructor(buyerId: string | null = null, authLoading = false, authenticated = false) {
    this.buyerId = buyerId;
    this.authLoading = authLoading;
    this.authenticated = authenticated;
    this.snapshot = Object.freeze({
      busy: false,
      products: EMPTY_PRODUCTS,
      isLoadingProducts: Boolean(buyerId && !authLoading && authenticated),
      loadedBuyerId: null,
    });
    // Pureté React : aucun appel dans le constructeur
  }

  public subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify() {
    this.snapshot = Object.freeze({
      busy: this.busy,
      products: this.products.length ? [...this.products] : EMPTY_PRODUCTS,
      isLoadingProducts: this.isLoadingProducts,
      loadedBuyerId: this.loadedBuyerId,
    });
    for (const listener of this.listeners) {
      listener();
    }
  }

  public getSnapshot = (): BuyerCheckoutStoreState => {
    return this.snapshot;
  };

  public getServerSnapshot = (): BuyerCheckoutStoreState => {
    return this.snapshot;
  };

  public getState = (cart: CartItemRecord[] = [], totalAmount = 0): BuyerCheckoutState => {
    const isCartAligned = Boolean(
      !this.authLoading &&
      this.buyerId &&
      this.authenticated &&
      cartStore.getBuyerId() === this.buyerId
    );

    const isBusy = Boolean(
      this.busy &&
      this.loadedBuyerId === this.buyerId &&
      !this.authLoading &&
      this.authenticated
    );

    return {
      isCartAligned,
      effectiveCart: isCartAligned ? cart : EMPTY_CART,
      effectiveTotalAmount: isCartAligned ? totalAmount : 0,
      busy: isBusy,
      products: this.snapshot.products,
      isLoading: this.snapshot.isLoadingProducts,
    };
  };

  public updateSession(buyerId: string | null, authLoading: boolean, authenticated: boolean) {
    const activeBuyerChanged = !this.isInitialized || this.buyerId !== buyerId;
    const authChanged = !this.isInitialized || this.authLoading !== authLoading || this.authenticated !== authenticated;
    this.isInitialized = true;

    if (!activeBuyerChanged && !authChanged) {
      return;
    }

    this.buyerId = buyerId;
    this.authLoading = authLoading;
    this.authenticated = authenticated;

    if (activeBuyerChanged) {
      this.sessionGen++;
      // Remettre immédiatement busy à false lors du changement de contexte
      this.busy = false;
      this.loadedBuyerId = null;
    }

    if (buyerId && !authLoading && authenticated) {
      this.isLoadingProducts = true;
      this.notify();
      this.loadProducts();
    } else {
      this.isLoadingProducts = false;
      this.notify();
    }
  }

  public loadProducts = async (): Promise<void> => {
    if (this.authLoading || !this.buyerId || !this.authenticated) {
      this.isLoadingProducts = false;
      this.notify();
      return;
    }

    if (
      this.inFlightPromise &&
      this.inFlightBuyerId === this.buyerId &&
      this.inFlightGen === this.sessionGen
    ) {
      return this.inFlightPromise;
    }

    const reqId = ++this.loadProductsSeq;
    const capturedSessionGen = this.sessionGen;
    const capturedBuyerId = this.buyerId;
    const capturedDbGen = dbService.getContextGeneration();

    this.isLoadingProducts = true;
    this.notify();

    const isStale = () =>
      this.loadProductsSeq !== reqId ||
      this.sessionGen !== capturedSessionGen ||
      this.buyerId !== capturedBuyerId ||
      this.authLoading ||
      !this.authenticated ||
      dbService.getContextGeneration() !== capturedDbGen;

    const task = (async () => {
      try {
        const items = await dbService.getProducts();
        if (isStale()) return;
        this.products = items;
        this.loadedBuyerId = capturedBuyerId;
      } catch {
        // Ignorer les erreurs d'affichage catalogue
      } finally {
        if (!isStale()) {
          this.isLoadingProducts = false;
          this.notify();
        }
        if (this.inFlightBuyerId === capturedBuyerId && this.inFlightGen === capturedSessionGen) {
          this.inFlightPromise = null;
          this.inFlightBuyerId = null;
        }
      }
    })();

    this.inFlightPromise = task;
    this.inFlightBuyerId = capturedBuyerId;
    this.inFlightGen = capturedSessionGen;

    return task;
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
    this.loadedBuyerId = capturedBuyerId;
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

  const rawState = useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getSnapshot,
    coordinator.getServerSnapshot
  );

  useEffect(() => {
    coordinator.updateSession(buyerId, authLoading, authenticated);
  }, [coordinator, buyerId, authLoading, authenticated]);

  // Synchronous guard for cart alignment
  const isCartAligned = Boolean(
    !authLoading &&
    authenticated &&
    buyerId &&
    cartStore.getBuyerId() === buyerId
  );

  // Busy de A ne doit JAMAIS bloquer B
  const isBusy = Boolean(
    rawState.busy &&
    rawState.loadedBuyerId === buyerId &&
    !authLoading &&
    authenticated
  );

  const confirmOrder = useCallback(
    (
      orderType: any,
      callbacks: { onSuccess: () => void; onError: (err: any) => void }
    ) => coordinator.confirmOrder(orderType, refreshCart, callbacks, isCartAligned ? cart : []),
    [coordinator, refreshCart, isCartAligned, cart]
  );

  return {
    isCartAligned,
    effectiveCart: isCartAligned ? cart : EMPTY_CART,
    effectiveTotalAmount: isCartAligned ? totalAmount : 0,
    busy: isBusy,
    products: rawState.products,
    isLoading: rawState.isLoadingProducts,
    loadProducts: coordinator.loadProducts,
    confirmOrder,
  };
}

// ─── 4. COORDINATEUR DE L'ACCUEIL ACHETEUR (home.tsx) ─────────────────────────

export interface BuyerHomeStoreState {
  products: ProductOffer[];
  isLoading: boolean;
  rawAlertCount: number;
  loadedAlertBuyerId: string | null;
}

export interface BuyerHomeState {
  isCartAligned: boolean;
  effectiveCartCount: number;
  alertCount: number;
  products: ProductOffer[];
  isLoading: boolean;
}

export class BuyerHomeCoordinator {
  private buyerId: string | null = null;
  private authLoading = false;
  private authenticated = false;

  // Séquences indépendantes : l'ajout au panier ne bloque pas la synchro silencieuse
  private syncSeq = 0;
  private cartActionSeq = 0;
  private sessionGen = 0;

  private rawAlertCount = 0;
  private loadedAlertBuyerId: string | null = null;
  private products: ProductOffer[] = EMPTY_PRODUCTS;
  private isLoading = false;

  private listeners = new Set<() => void>();
  private snapshot: BuyerHomeStoreState;

  private inFlightPromise: Promise<void> | null = null;
  private inFlightBuyerId: string | null = null;
  private inFlightGen = -1;
  private isInitialized = false;

  constructor(buyerId: string | null = null, authLoading = false, authenticated = false) {
    this.buyerId = buyerId;
    this.authLoading = authLoading;
    this.authenticated = authenticated;
    this.snapshot = Object.freeze({
      products: EMPTY_PRODUCTS,
      isLoading: !authLoading,
      rawAlertCount: 0,
      loadedAlertBuyerId: null,
    });
    // Pureté React : aucun appel dans le constructeur
  }

  public subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify() {
    this.snapshot = Object.freeze({
      products: this.products.length ? [...this.products] : EMPTY_PRODUCTS,
      isLoading: this.isLoading,
      rawAlertCount: this.rawAlertCount,
      loadedAlertBuyerId: this.loadedAlertBuyerId,
    });
    for (const listener of this.listeners) {
      listener();
    }
  }

  public getSnapshot = (): BuyerHomeStoreState => {
    return this.snapshot;
  };

  public getServerSnapshot = (): BuyerHomeStoreState => {
    return this.snapshot;
  };

  public getState = (cartCount = 0): BuyerHomeState => {
    const isCartAligned = Boolean(
      !this.authLoading &&
      this.buyerId &&
      this.authenticated &&
      cartStore.getBuyerId() === this.buyerId
    );

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
      products: this.snapshot.products,
      isLoading: this.snapshot.isLoading,
    };
  };

  public updateSession(buyerId: string | null, authLoading: boolean, authenticated: boolean) {
    const activeBuyerChanged = !this.isInitialized || this.buyerId !== buyerId;
    const authChanged = !this.isInitialized || this.authLoading !== authLoading || this.authenticated !== authenticated;
    this.isInitialized = true;

    if (!activeBuyerChanged && !authChanged) {
      return;
    }

    this.buyerId = buyerId;
    this.authLoading = authLoading;
    this.authenticated = authenticated;

    if (activeBuyerChanged) {
      this.sessionGen++;
      // Compteur d'alertes A déjà affiché, bascule directe vers B : zéro immédiatement !
      this.rawAlertCount = 0;
      this.loadedAlertBuyerId = null;
    }

    if (!authLoading) {
      this.isLoading = true;
      this.notify();
      this.silentSync();
    } else {
      this.isLoading = false;
      this.notify();
    }
  }

  public silentSync = async (): Promise<void> => {
    if (
      this.inFlightPromise &&
      this.inFlightBuyerId === this.buyerId &&
      this.inFlightGen === this.sessionGen
    ) {
      return this.inFlightPromise;
    }

    const reqId = ++this.syncSeq;
    const capturedSessionGen = this.sessionGen;
    const capturedBuyerId = this.buyerId;
    const capturedDbGen = dbService.getContextGeneration();

    this.isLoading = true;
    this.notify();

    const isStale = () =>
      this.syncSeq !== reqId ||
      this.sessionGen !== capturedSessionGen ||
      this.buyerId !== capturedBuyerId ||
      this.authLoading ||
      !this.authenticated ||
      dbService.getContextGeneration() !== capturedDbGen;

    const task = (async () => {
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
      } catch (err) {
        console.warn('Erreur synchro silencieuse acheteur:', err);
      } finally {
        if (!isStale()) {
          this.isLoading = false;
          this.notify();
        }
        if (this.inFlightBuyerId === capturedBuyerId && this.inFlightGen === capturedSessionGen) {
          this.inFlightPromise = null;
          this.inFlightBuyerId = null;
        }
      }
    })();

    this.inFlightPromise = task;
    this.inFlightBuyerId = capturedBuyerId;
    this.inFlightGen = capturedSessionGen;

    return task;
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

  const rawState = useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getSnapshot,
    coordinator.getServerSnapshot
  );

  useEffect(() => {
    coordinator.updateSession(buyerId, authLoading, authenticated);
  }, [coordinator, buyerId, authLoading, authenticated]);

  const isCartAligned = Boolean(
    !authLoading &&
    authenticated &&
    buyerId &&
    cartStore.getBuyerId() === buyerId
  );

  const isAlertAligned = Boolean(
    !authLoading &&
    authenticated &&
    buyerId &&
    rawState.loadedAlertBuyerId === buyerId
  );

  const handleAddToCartSafe = useCallback(
    (product: ProductOffer, callbacks?: { onSuccess?: () => void; onError?: (err: any) => void }) =>
      coordinator.handleAddToCartSafe(product, addProductToCart, callbacks),
    [coordinator, addProductToCart]
  );

  return {
    isCartAligned,
    effectiveCartCount: isCartAligned ? cartCount : 0,
    alertCount: isAlertAligned ? rawState.rawAlertCount : 0,
    products: rawState.products,
    isLoading: rawState.isLoading,
    silentSync: coordinator.silentSync,
    handleAddToCartSafe,
  };
}
