import { useCallback, useEffect, useRef, useState } from 'react';
import { dbService, OrderRecord, ProductOffer, AlertPreferences, CartItemRecord } from '@/services/database';
import { cartStore } from '@/services/cart-store';
import { isNetworkError } from '@/services/api';

/**
 * 1. Coordinateur pour l'écran des commandes acheteur (orders.tsx)
 * Garantit qu'aucun résultat différé n'écrase l'état d'un acheteur différent ou après déconnexion.
 */
export function useBuyerOrdersCoordinator(
  buyerId: string | null,
  authLoading: boolean,
  authenticated: boolean
) {
  const buyerIdRef = useRef(buyerId);
  buyerIdRef.current = buyerId;

  const authLoadingRef = useRef(authLoading);
  authLoadingRef.current = authLoading;

  const authenticatedRef = useRef(authenticated);
  authenticatedRef.current = authenticated;

  const reqSeqRef = useRef(0);

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loadedBuyerId, setLoadedBuyerId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [ratingOrder, setRatingOrder] = useState<OrderRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Réinitialisation immédiate si la session change ou repasse en chargement
  useEffect(() => {
    if (!buyerId || authLoading || !authenticated || (loadedBuyerId && loadedBuyerId !== buyerId)) {
      reqSeqRef.current++;
      setOrders([]);
      setLoadedBuyerId(null);
      setSelectedOrder(null);
      setRatingOrder(null);
      setServerError(null);
      setIsLoading(false);
    }
  }, [buyerId, authLoading, authenticated, loadedBuyerId]);

  const loadOrders = useCallback(
    async (options?: { onExpired?: () => void; onError?: (msg: string) => void }) => {
    if (authLoadingRef.current || !buyerIdRef.current || !authenticatedRef.current) {
      setOrders([]);
      setLoadedBuyerId(null);
      setIsLoading(false);
      return;
    }

    const reqId = ++reqSeqRef.current;
    const capturedBuyerId = buyerIdRef.current;
    const capturedGen = dbService.getContextGeneration();

    setIsLoading(true);
    setServerError(null);

    const isStale = () =>
      reqSeqRef.current !== reqId ||
      buyerIdRef.current !== capturedBuyerId ||
      authLoadingRef.current ||
      !authenticatedRef.current ||
      dbService.getContextGeneration() !== capturedGen;

    try {
      await dbService.initDatabase();
      if (isStale()) return;

      const loaded = await dbService.getOrders(true);
      if (isStale()) return;

      setOrders(loaded);
      setLoadedBuyerId(capturedBuyerId);
      setIsOffline(!dbService.isLastOrdersSyncSuccessful());
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
          setOrders(cached);
          setLoadedBuyerId(capturedBuyerId);
          setIsOffline(true);
        } catch {
          if (isStale()) return;
          setServerError('Impossible de charger les commandes hors ligne.');
        }
      } else {
        const msg = err?.message || 'Erreur lors du chargement des commandes.';
        setServerError(msg);
        options?.onError?.(msg);
      }
    } finally {
      if (!isStale()) {
        setIsLoading(false);
      }
    }
  }, []);

  const submitRating = useCallback(
    async (
      order: OrderRecord,
      stars: number,
      comment: string,
      callbacks?: { onSuccess?: () => void; onError?: (err: any) => void }
    ) => {
      if (!order || stars === 0 || authLoadingRef.current || !buyerIdRef.current || !authenticatedRef.current) {
        return false;
      }

      const reqId = ++reqSeqRef.current;
      const capturedBuyerId = buyerIdRef.current;
      const capturedGen = dbService.getContextGeneration();

      const isStale = () =>
        reqSeqRef.current !== reqId ||
        buyerIdRef.current !== capturedBuyerId ||
        authLoadingRef.current ||
        !authenticatedRef.current ||
        dbService.getContextGeneration() !== capturedGen;

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
    },
    []
  );

  return {
    orders,
    loadedBuyerId,
    selectedOrder,
    setSelectedOrder,
    ratingOrder,
    setRatingOrder,
    isLoading,
    isOffline,
    serverError,
    loadOrders,
    submitRating,
    reqSeqRef,
  };
}

/**
 * 2. Coordinateur pour l'écran des alertes récoltes (alerts.tsx)
 * Empêche les sauvegardes et lectures fantômes en arrière-plan.
 */
export function useBuyerAlertsCoordinator(
  buyerId: string | null,
  authLoading: boolean,
  authenticated: boolean
) {
  const buyerIdRef = useRef(buyerId);
  buyerIdRef.current = buyerId;

  const authLoadingRef = useRef(authLoading);
  authLoadingRef.current = authLoading;

  const authenticatedRef = useRef(authenticated);
  authenticatedRef.current = authenticated;

  const reqSeqRef = useRef(0);

  const [prefs, setPrefs] = useState<AlertPreferences>({ productNames: [], bassins: [] });
  const [matchCount, setMatchCount] = useState(0);
  const [loadedBuyerId, setLoadedBuyerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Réinitialisation immédiate
  useEffect(() => {
    if (!buyerId || authLoading || !authenticated || (loadedBuyerId && loadedBuyerId !== buyerId)) {
      reqSeqRef.current++;
      setPrefs({ productNames: [], bassins: [] });
      setMatchCount(0);
      setLoadedBuyerId(null);
      setIsLoading(false);
    }
  }, [buyerId, authLoading, authenticated, loadedBuyerId]);

  const loadAlerts = useCallback(async () => {
    if (authLoadingRef.current || !buyerIdRef.current || !authenticatedRef.current) {
      setIsLoading(false);
      return;
    }

    const reqId = ++reqSeqRef.current;
    const capturedBuyerId = buyerIdRef.current;
    const capturedGen = dbService.getContextGeneration();

    setIsLoading(true);

    const isStale = () =>
      reqSeqRef.current !== reqId ||
      buyerIdRef.current !== capturedBuyerId ||
      authLoadingRef.current ||
      !authenticatedRef.current ||
      dbService.getContextGeneration() !== capturedGen;

    try {
      await dbService.initDatabase();
      if (isStale()) return;

      const stored = await dbService.getAlertPreferences();
      if (isStale()) return;

      const count = await dbService.getMatchingAlertCount();
      if (isStale()) return;

      setPrefs(stored);
      setMatchCount(count);
      setLoadedBuyerId(capturedBuyerId);
    } catch (err) {
      console.warn('Erreur chargement alertes:', err);
    } finally {
      if (!isStale()) {
        setIsLoading(false);
      }
    }
  }, []);

  const saveAlerts = useCallback(
    async (
      newPrefs: AlertPreferences,
      callbacks?: { onSuccess?: (count: number) => void; onError?: (err: any) => void }
    ) => {
      if (authLoadingRef.current || !buyerIdRef.current || !authenticatedRef.current) {
        return false;
      }

      const reqId = ++reqSeqRef.current;
      const capturedBuyerId = buyerIdRef.current;
      const capturedGen = dbService.getContextGeneration();

      const isStale = () =>
        reqSeqRef.current !== reqId ||
        buyerIdRef.current !== capturedBuyerId ||
        authLoadingRef.current ||
        !authenticatedRef.current ||
        dbService.getContextGeneration() !== capturedGen;

      try {
        await dbService.saveAlertPreferences(newPrefs);
        if (isStale()) return false;

        const updatedCount = await dbService.getMatchingAlertCount();
        if (isStale()) return false;

        setMatchCount(updatedCount);
        callbacks?.onSuccess?.(updatedCount);
        return true;
      } catch (err: any) {
        if (isStale()) return false;
        callbacks?.onError?.(err);
        return false;
      }
    },
    []
  );

  const isDataValid =
    !authLoading && Boolean(buyerId) && loadedBuyerId === buyerId && authenticated;

  return {
    prefs,
    setPrefs,
    matchCount,
    isLoading,
    isDataValid,
    loadAlerts,
    saveAlerts,
    reqSeqRef,
  };
}

/**
 * 3. Coordinateur pour l'écran de validation panier / commande (checkout.tsx)
 * Masque immédiatement le panier si cartStore n'est pas aligné ou pendant le chargement.
 */
export function useBuyerCheckoutCoordinator(
  buyerId: string | null,
  authLoading: boolean,
  authenticated: boolean,
  cart: CartItemRecord[],
  totalAmount: number,
  refreshCart: () => Promise<void>
) {
  const buyerIdRef = useRef(buyerId);
  buyerIdRef.current = buyerId;

  const authLoadingRef = useRef(authLoading);
  authLoadingRef.current = authLoading;

  const authenticatedRef = useRef(authenticated);
  authenticatedRef.current = authenticated;

  const reqSeqRef = useRef(0);

  const [busy, setBusy] = useState(false);
  const [products, setProducts] = useState<ProductOffer[]>([]);

  // Vérification stricte d'alignement du panier
  const isCartAligned =
    !authLoading &&
    Boolean(buyerId) &&
    authenticated &&
    cartStore.getBuyerId() === buyerId;

  const effectiveCart: CartItemRecord[] = isCartAligned ? cart : [];
  const effectiveTotalAmount: number = isCartAligned ? totalAmount : 0;

  // Réinitialisation immédiate si changement d'acheteur
  useEffect(() => {
    if (!buyerId || authLoading || !authenticated) {
      reqSeqRef.current++;
      setBusy(false);
    }
  }, [buyerId, authLoading, authenticated]);

  const loadProducts = useCallback(async () => {
    if (authLoadingRef.current || !buyerIdRef.current || !authenticatedRef.current) return;

    const reqId = ++reqSeqRef.current;
    const capturedBuyerId = buyerIdRef.current;
    const capturedGen = dbService.getContextGeneration();

    const isStale = () =>
      reqSeqRef.current !== reqId ||
      buyerIdRef.current !== capturedBuyerId ||
      authLoadingRef.current ||
      !authenticatedRef.current ||
      dbService.getContextGeneration() !== capturedGen;

    try {
      const items = await dbService.getProducts();
      if (isStale()) return;
      setProducts(items);
    } catch {
      // Ignorer les erreurs d'affichage catalogue
    }
  }, []);

  const confirmOrder = useCallback(
    async (
      orderType: any,
      callbacks: {
        onSuccess: () => void;
        onError: (err: any) => void;
      }
    ): Promise<boolean> => {
      if (
        !isCartAligned ||
        busy ||
        !effectiveCart.length ||
        authLoadingRef.current ||
        !buyerIdRef.current ||
        !authenticatedRef.current
      ) {
        return false;
      }

      const reqId = ++reqSeqRef.current;
      const capturedBuyerId = buyerIdRef.current;
      const capturedGen = dbService.getContextGeneration();

      setBusy(true);

      const isStale = () =>
        reqSeqRef.current !== reqId ||
        buyerIdRef.current !== capturedBuyerId ||
        authLoadingRef.current ||
        !authenticatedRef.current ||
        dbService.getContextGeneration() !== capturedGen;

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
        if (reqSeqRef.current === reqId) {
          setBusy(false);
        }
      }
    },
    [isCartAligned, busy, effectiveCart.length, refreshCart]
  );

  return {
    isCartAligned,
    effectiveCart,
    effectiveTotalAmount,
    busy,
    products,
    loadProducts,
    confirmOrder,
    reqSeqRef,
  };
}

/**
 * 4. Coordinateur pour l'écran d'accueil acheteur (home.tsx)
 * Masque tout compteur d'articles si cartStore n'est pas aligné ou pendant authLoading.
 */
export function useBuyerHomeCoordinator(
  buyerId: string | null,
  authLoading: boolean,
  authenticated: boolean,
  cartCount: number,
  addProductToCart: (product: any, maxStock?: number) => Promise<any>
) {
  const buyerIdRef = useRef(buyerId);
  buyerIdRef.current = buyerId;

  const authLoadingRef = useRef(authLoading);
  authLoadingRef.current = authLoading;

  const authenticatedRef = useRef(authenticated);
  authenticatedRef.current = authenticated;

  const reqSeqRef = useRef(0);

  const [alertCount, setAlertCount] = useState(0);
  const [products, setProducts] = useState<ProductOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Vérification stricte d'alignement panier
  const isCartAligned =
    !authLoading &&
    Boolean(buyerId) &&
    authenticated &&
    cartStore.getBuyerId() === buyerId;

  const effectiveCartCount = isCartAligned ? cartCount : 0;

  // Réinitialisation immédiate si changement d'acheteur
  useEffect(() => {
    if (!buyerId || authLoading || !authenticated) {
      reqSeqRef.current++;
      setAlertCount(0);
      setIsLoading(false);
    }
  }, [buyerId, authLoading, authenticated]);

  const silentSync = useCallback(async () => {
    const reqId = ++reqSeqRef.current;
    const capturedBuyerId = buyerIdRef.current;
    const capturedGen = dbService.getContextGeneration();

    const isStale = () =>
      reqSeqRef.current !== reqId ||
      buyerIdRef.current !== capturedBuyerId ||
      authLoadingRef.current ||
      !authenticatedRef.current ||
      dbService.getContextGeneration() !== capturedGen;

    try {
      await dbService.initDatabase();
      if (isStale()) return;

      await dbService.syncPublicData().catch(() => {});
      if (isStale()) return;

      if (capturedBuyerId && !authLoadingRef.current && authenticatedRef.current) {
        await dbService.syncBuyerData(capturedBuyerId).catch(() => {});
        if (isStale()) return;
      }

      const [offers, matches] = await Promise.all([
        dbService.getProducts(),
        capturedBuyerId && !authLoadingRef.current && authenticatedRef.current
          ? dbService.getMatchingAlertCount().catch(() => 0)
          : Promise.resolve(0),
      ]);
      if (isStale()) return;

      setAlertCount(matches);
      setProducts(offers);
    } catch (err) {
      console.warn('Erreur synchro silencieuse acheteur:', err);
    } finally {
      if (!isStale()) {
        setIsLoading(false);
      }
    }
  }, []);

  const handleAddToCartSafe = useCallback(
    async (
      product: ProductOffer,
      callbacks?: { onSuccess?: () => void; onError?: (err: any) => void }
    ): Promise<boolean> => {
      const reqId = ++reqSeqRef.current;
      const capturedBuyerId = buyerIdRef.current;
      const capturedGen = dbService.getContextGeneration();

      const isStale = () =>
        reqSeqRef.current !== reqId ||
        buyerIdRef.current !== capturedBuyerId ||
        authLoadingRef.current ||
        !authenticatedRef.current ||
        dbService.getContextGeneration() !== capturedGen;

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
    },
    [addProductToCart]
  );

  return {
    isCartAligned,
    effectiveCartCount,
    alertCount,
    products,
    isLoading,
    silentSync,
    handleAddToCartSafe,
    reqSeqRef,
  };
}
