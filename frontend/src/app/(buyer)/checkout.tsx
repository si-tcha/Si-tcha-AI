import {
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';
import { dbService, OrderRecord, OrderType, ProductOffer } from '@/services/database';
import { isNetworkError } from '@/services/api';
import { useCart } from '@/services/cart-store';
import { BottomNavBar } from '@/components/ui/bottom-nav-bar';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/context/AuthContext';
import { useBuyerCheckoutCoordinator } from '@/hooks/useBuyerCoordinators';
import {
  PaymentMethodSelector,
  PaymentMode,
} from '@/components/payment/PaymentMethodSelector';
import { PaymentOtpModal } from '@/components/payment/PaymentOtpModal';
import { PaymentStatusModal } from '@/components/payment/PaymentStatusModal';
import {
  confirmPaymentWithOtp,
  getPaymentMethods,
  getPaymentStatus,
  initiatePayment,
  PaymentOperator,
  PaymentRecordDto,
  PaymentStatus,
  isMobileMoneyAvailableForCart,
  pollPaymentStatusUntilFinal,
  requestPaymentOtp,
} from '@/services/payment';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const CONTAINER_WIDTH = isWeb ? Math.min(SCREEN_WIDTH, 420) : SCREEN_WIDTH;

const ORDER_TYPES: { type: OrderType; label: string; hint: string }[] = [
  { type: 'commande_ferme', label: 'Commande ferme', hint: 'Engagement d\'achat confirmé' },
  { type: 'achat_direct', label: 'Achat direct', hint: 'Prise immédiate sur stock disponible' },
  { type: 'reservation', label: 'Bon de réservation', hint: 'Sécurise la récolte future' },
];

export default function BuyerCheckoutScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { buyerId: currentBuyerId, loading: authLoading, authenticated, sessionSeq, user } = useAuth();
  const {
    cart,
    totalAmount,
    incrementCartItem,
    decrementCartItem,
    removeFromCart,
    clearCart,
    refreshCart,
  } = useCart();
  const [selectedType, setSelectedType] = useState<OrderType>('commande_ferme');

  // État du mode de règlement (Espèces par défaut ou Mobile Money)
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [operators, setOperators] = useState<PaymentOperator[]>([]);
  const [selectedOperator, setSelectedOperator] = useState<string>('mtn');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [loadingMethods, setLoadingMethods] = useState<boolean>(false);

  // État du flux de paiement AfribaPay (OTP et Statut)
  const [otpModalVisible, setOtpModalVisible] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState<string>('');
  const [otpBusy, setOtpBusy] = useState<boolean>(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const [statusModalVisible, setStatusModalVisible] = useState<boolean>(false);
  const [currentPayment, setCurrentPayment] = useState<PaymentRecordDto | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('PENDING');
  const [statusRefreshing, setStatusRefreshing] = useState<boolean>(false);

  // Pré-remplissage du numéro depuis le profil si disponible
  useEffect(() => {
    if (user?.phone && !phoneNumber) {
      const clean = user.phone.replace(/^(\+237|237)/, '').trim();
      if (clean) setPhoneNumber(clean);
    }
  }, [user?.phone, phoneNumber]);

  // Chargement des opérateurs de paiement disponibles au Cameroun
  const loadPaymentMethods = useCallback(async () => {
    try {
      setLoadingMethods(true);
      const res = await getPaymentMethods('CM');
      const cameroon = res.countries.find((c) => c.countryCode === 'CM');
      if (cameroon && cameroon.operators.length > 0) {
        setOperators(cameroon.operators);
        setSelectedOperator(cameroon.operators[0].code);
      }
    } catch (err) {
      console.warn('Erreur chargement opérateurs paiement:', err);
    } finally {
      setLoadingMethods(false);
    }
  }, []);

  const {
    isCartAligned,
    effectiveCart,
    effectiveTotalAmount,
    busy,
    products,
    loadProducts,
    confirmOrder,
  } = useBuyerCheckoutCoordinator(
    currentBuyerId,
    authLoading,
    authenticated,
    cart,
    totalAmount,
    refreshCart,
    sessionSeq
  );

  // A cart can create several orders; the current provider flow settles one
  // order only. Return safely to cash if a second product is added.
  useEffect(() => {
    if (!isMobileMoneyAvailableForCart(effectiveCart.length) && paymentMode === 'mobile_money') {
      setPaymentMode('cash');
    }
  }, [effectiveCart.length, paymentMode]);

  useFocusEffect(
    useCallback(() => {
      refreshCart();
      loadProducts();
      loadPaymentMethods();
    }, [refreshCart, loadProducts, loadPaymentMethods])
  );

  const handleIncrement = async (productId: string) => {
    if (!isCartAligned || busy) return;
    const product = products.find((p) => p.id === productId);
    const maxStock = product?.volumeDisponible;
    try {
      await incrementCartItem(productId, maxStock);
    } catch (err: any) {
      showToast({
        message: err?.message || 'Stock maximal atteint pour ce produit.',
        type: 'warning',
      });
    }
  };

  const handleDecrement = async (productId: string) => {
    if (!isCartAligned || busy) return;
    try {
      await decrementCartItem(productId);
    } catch {
      showToast({ message: 'Erreur lors de la modification de quantité.', type: 'error' });
    }
  };

  const handleRemove = async (productId: string) => {
    if (!isCartAligned || busy) return;
    try {
      await removeFromCart(productId);
      showToast({ message: 'Article retiré du panier.', type: 'info' });
    } catch {
      showToast({ message: 'Erreur lors du retrait de l\'article.', type: 'error' });
    }
  };

  const handleClearCart = async () => {
    if (!isCartAligned || busy) return;
    await clearCart();
    showToast({ message: 'Panier vidé.', type: 'info' });
  };

  const cleanPhoneInput = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('237') && digits.length >= 12) {
      return digits.substring(3);
    }
    return digits;
  };

  const handleConfirm = async () => {
    // Si Mobile Money sélectionné, valider le numéro de téléphone au préalable
    const cleanPhone = cleanPhoneInput(phoneNumber);
    if (paymentMode === 'mobile_money') {
      if (!isMobileMoneyAvailableForCart(effectiveCart.length)) {
        showToast({
          message: 'Mobile Money est disponible pour un seul produit à la fois. Choisissez les espèces ou passez les produits séparément.',
          type: 'warning',
          duration: 7000,
        });
        return;
      }
      if (!cleanPhone || cleanPhone.length < 9) {
        showToast({
          message: 'Veuillez renseigner un numéro de téléphone Mobile Money valide (9 chiffres).',
          type: 'warning',
        });
        return;
      }
    }

    await confirmOrder(selectedType, {
      onSuccess: async (createdOrders?: OrderRecord[]) => {
        // Parcours 1 : Règlement en espèces (conservation intégrale)
        if (paymentMode === 'cash') {
          showToast({
            message: 'Commande enregistrée auprès du GIC ! Le règlement s\'effectuera en espèces lors de la livraison.',
            type: 'success',
          });
          router.replace('/(buyer)/orders');
          return;
        }

        // Parcours 2 : Règlement Mobile Money via AfribaPay
        if (!createdOrders || createdOrders.length === 0) {
          showToast({
            message: 'Commande enregistrée. Vous pouvez finaliser le paiement depuis vos commandes.',
            type: 'info',
          });
          router.replace('/(buyer)/orders');
          return;
        }

        const primaryOrder = createdOrders[0];
        const selectedOpObj = operators.find(
          (o) => o.code.toLowerCase() === selectedOperator.toLowerCase()
        );
        const requiresOtp = selectedOpObj?.requiresOtp ?? false;

        try {
          if (requiresOtp) {
            // Demande préalable de code OTP
            const res = await requestPaymentOtp({
              resourceType: 'ORDER',
              resourceId: primaryOrder.id,
              countryCode: 'CM',
              operator: selectedOpObj?.code || selectedOperator,
              phoneNumber: cleanPhone,
            });
            setCurrentPayment(res.payment);
            setPaymentStatus('AWAITING_OTP');
            setOtpCode('');
            setOtpError(null);
            setOtpModalVisible(true);
          } else {
            // Initiation directe
            const res = await initiatePayment({
              resourceType: 'ORDER',
              resourceId: primaryOrder.id,
              countryCode: 'CM',
              operator: selectedOpObj?.code || selectedOperator,
              phoneNumber: cleanPhone,
            });
            setCurrentPayment(res.payment);
            setPaymentStatus(res.payment.status);
            setStatusModalVisible(true);

            // Sondage en arrière-plan
            pollPaymentStatusUntilFinal(res.payment.id, {
              onUpdate: (st, pay) => {
                setPaymentStatus(st);
                setCurrentPayment(pay);
              },
            });
          }
        } catch (err: any) {
          console.warn('Erreur initiation paiement AfribaPay:', err);
          showToast({
            message:
              err?.message ||
              'La commande a été créée mais l\'initiation du paiement a échoué. Vous pouvez reprendre le paiement dans vos commandes.',
            type: 'warning',
            duration: 7000,
          });
          router.replace('/(buyer)/orders');
        }
      },
      onError: (err: any) => {
        console.warn('Erreur validation commande:', err);
        let errorMsg = 'Impossible de valider la commande. Votre panier a été conservé.';
        if (isNetworkError(err)) {
          errorMsg = 'Connexion réseau impossible. Votre panier reste intact, vous pouvez retenter dès le retour de la connexion.';
        } else if (err?.status === 409) {
          errorMsg =
            err.payload?.message ||
            err.message ||
            'Stock insuffisant ou conflit d\'idempotence. Votre panier a été conservé.';
        } else if (err?.status === 401) {
          errorMsg = 'Session expirée. Veuillez vous reconnecter pour valider votre commande.';
        } else if (err?.message) {
          errorMsg = err.message;
        }
        showToast({ message: errorMsg, type: 'error', duration: 7000 });
      },
    });
  };

  // Soumission du code OTP saisi par l'acheteur
  const handleConfirmOtp = async () => {
    if (!currentPayment || !otpCode.trim()) return;
    const cleanPhone = cleanPhoneInput(phoneNumber);
    try {
      setOtpBusy(true);
      setOtpError(null);
      const res = await confirmPaymentWithOtp(currentPayment.id, {
        phoneNumber: cleanPhone,
        otpCode: otpCode.trim(),
      });
      setCurrentPayment(res.payment);
      setOtpModalVisible(false);
      setPaymentStatus(res.payment.status);
      setStatusModalVisible(true);

      // Sondage du statut jusqu'à confirmation finale
      pollPaymentStatusUntilFinal(res.payment.id, {
        onUpdate: (st, pay) => {
          setPaymentStatus(st);
          setCurrentPayment(pay);
        },
      });
    } catch (err: any) {
      setOtpError(err?.message || 'Code OTP invalide ou expiré. Veuillez vérifier et réessayer.');
    } finally {
      setOtpBusy(false);
    }
  };

  // Rafraîchissement manuel du statut
  const handleRefreshStatus = async () => {
    if (!currentPayment) return;
    try {
      setStatusRefreshing(true);
      const res = await getPaymentStatus(currentPayment.id);
      setCurrentPayment(res.payment);
      setPaymentStatus(res.status);
    } catch (err) {
      console.warn('Erreur actualisation statut paiement:', err);
    } finally {
      setStatusRefreshing(false);
    }
  };

  const handleCloseStatusModal = () => {
    setStatusModalVisible(false);
    router.replace('/(buyer)/orders');
  };

  return (
    <SafeAreaView style={styles.outerContainer} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#101e0f" />

        {/* Header Fixe 56px */}
        <View style={styles.header}>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Mon Panier & Commande</Text>
            <Text style={styles.headerSubtitle}>
              {paymentMode === 'cash'
                ? 'Règlement en espèces à la livraison'
                : 'Paiement Mobile Money (AfribaPay)'}
            </Text>
          </View>

          <View style={styles.headerIcons}>
            {effectiveCart.length > 0 && (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={handleClearCart}
                accessibilityLabel="Vider le panier"
                disabled={busy}
              >
                <Feather name="trash-2" size={16} color="#d97834" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Section Liste Panier */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Articles du panier ({effectiveCart.length})</Text>
            {effectiveCart.length > 0 && (
              <TouchableOpacity onPress={handleClearCart} disabled={busy}>
                <Text style={styles.clearCartText}>Vider tout</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.listCard}>
            {effectiveCart.length === 0 ? (
              <View style={styles.emptyItem}>
                <Feather name="shopping-cart" size={40} color="#889e87" />
                <Text style={styles.emptyTitle}>Votre panier est actuellement vide.</Text>
                <Text style={styles.emptySub}>Ajoutez des récoltes fraîches depuis le marché direct.</Text>
                <TouchableOpacity
                  style={styles.browseBtn}
                  onPress={() => router.replace('/(buyer)/home')}
                >
                  <Text style={styles.browseBtnText}>Explorer le Marché</Text>
                </TouchableOpacity>
              </View>
            ) : (
              effectiveCart.map((item) => {
                const product = products.find((p) => p.id === item.productId);
                const maxStock = product?.volumeDisponible;
                const isAtMaxStock = maxStock !== undefined && item.quantity >= maxStock;

                return (
                  <View key={item.id} style={styles.listItem}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.itemTitle}>{item.name}</Text>
                      <Text style={styles.meta}>
                        {item.price} FCFA / {item.unit}
                        {maxStock !== undefined ? ` · Dispo: ${maxStock} ${item.unit}` : ''}
                      </Text>
                    </View>

                    <View style={styles.quantityControlRow}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => handleDecrement(item.productId)}
                        disabled={busy}
                        accessibilityLabel="Diminuer la quantité"
                      >
                        <Feather name={item.quantity === 1 ? 'trash' : 'minus'} size={14} color="#f3ecd8" />
                      </TouchableOpacity>

                      <Text style={styles.qtyText}>{item.quantity}</Text>

                      <TouchableOpacity
                        style={[styles.qtyBtn, isAtMaxStock && styles.qtyBtnDisabled]}
                        onPress={() => handleIncrement(item.productId)}
                        disabled={busy || isAtMaxStock}
                        accessibilityLabel="Augmenter la quantité"
                      >
                        <Feather name="plus" size={14} color={isAtMaxStock ? '#889e87' : '#f3ecd8'} />
                      </TouchableOpacity>

                      <View style={styles.itemTotalContainer}>
                        <Text style={styles.itemTotal}>
                          {(parseFloat(item.price || '0') * item.quantity).toLocaleString()} FCFA
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => handleRemove(item.productId)}
                        disabled={busy}
                        accessibilityLabel="Supprimer l'article"
                      >
                        <Feather name="x" size={16} color="#d97834" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {effectiveCart.length > 0 && (
            <>
              {/* Total Résumé */}
              <View style={styles.totalSummaryCard}>
                <Text style={styles.totalSummaryLabel}>Total de la commande</Text>
                <Text style={styles.totalSummaryValue}>{effectiveTotalAmount.toLocaleString()} FCFA</Text>
              </View>

              {/* Type de transaction */}
              <Text style={styles.sectionTitle}>Type d'engagement d'achat</Text>
              {ORDER_TYPES.map((opt) => (
                <TouchableOpacity
                  key={opt.type}
                  style={[styles.typeCard, selectedType === opt.type && styles.typeCardActive]}
                  onPress={() => setSelectedType(opt.type)}
                  disabled={busy}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.typeLabel, selectedType === opt.type && styles.typeLabelActive]}>
                    {opt.label}
                  </Text>
                  <Text style={[styles.meta, selectedType === opt.type && { color: '#889e87' }]}>
                    {opt.hint}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Sélecteur de modalité de règlement (Espèces vs Mobile Money) */}
              <PaymentMethodSelector
                selectedMode={paymentMode}
                onSelectMode={setPaymentMode}
                operators={operators}
                selectedOperator={selectedOperator}
                onSelectOperator={setSelectedOperator}
                phoneNumber={phoneNumber}
                onChangePhoneNumber={setPhoneNumber}
                loadingMethods={loadingMethods}
                disabled={busy}
                mobileMoneyAvailable={isMobileMoneyAvailableForCart(effectiveCart.length)}
              />

              {/* Bouton de confirmation */}
              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  paymentMode === 'cash' && styles.confirmBtnCash,
                  (!effectiveCart.length || busy) && styles.confirmDisabled,
                ]}
                onPress={handleConfirm}
                disabled={!effectiveCart.length || busy}
                activeOpacity={0.85}
              >
                <Feather
                  name={busy ? 'loader' : paymentMode === 'cash' ? 'check-circle' : 'smartphone'}
                  size={18}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.confirmText}>
                  {busy
                    ? 'Transmission en cours…'
                    : paymentMode === 'cash'
                    ? `Valider la commande (espèces - ${effectiveTotalAmount.toLocaleString()} FCFA)`
                    : `Payer par Mobile Money (${effectiveTotalAmount.toLocaleString()} FCFA)`}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>

        {/* Modales de flux de paiement AfribaPay */}
        <PaymentOtpModal
          visible={otpModalVisible}
          operatorName={
            operators.find((o) => o.code.toLowerCase() === selectedOperator.toLowerCase())?.name ||
            selectedOperator.toUpperCase()
          }
          phoneNumberMasked={currentPayment?.phoneNumberMasked || phoneNumber}
          instructions={
            operators.find((o) => o.code.toLowerCase() === selectedOperator.toLowerCase())?.instructions
          }
          otpCode={otpCode}
          onChangeOtp={setOtpCode}
          onSubmit={handleConfirmOtp}
          onCancel={() => {
            setOtpModalVisible(false);
            router.replace('/(buyer)/orders');
          }}
          busy={otpBusy}
          errorMessage={otpError}
        />

        <PaymentStatusModal
          visible={statusModalVisible}
          status={paymentStatus}
          payment={currentPayment}
          onRefresh={handleRefreshStatus}
          onClose={handleCloseStatusModal}
          refreshing={statusRefreshing}
        />

        <BottomNavBar
          role="buyer"
          cartCount={effectiveCart.reduce((sum, item) => sum + item.quantity, 0)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#101e0f', alignItems: 'center' },
  container: { flex: 1, width: CONTAINER_WIDTH, backgroundColor: '#f3ecd8' },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    backgroundColor: '#101e0f',
    borderBottomWidth: 1,
    borderBottomColor: '#1d331b',
  },
  headerTitleGroup: { gap: 1 },
  headerTitle: { fontSize: 15, fontWeight: '900', color: '#f3ecd8' },
  headerSubtitle: { fontSize: 10, fontWeight: '600', color: '#889e87' },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#1d331b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { padding: Spacing.four, gap: 12, paddingBottom: 90 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#101e0f' },
  clearCartText: { fontSize: 11, fontWeight: '800', color: '#d97834', textDecorationLine: 'underline' },
  listCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    overflow: 'hidden',
  },
  emptyItem: { padding: 40, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: '#101e0f' },
  emptySub: { fontSize: 12, color: '#5a6258', textAlign: 'center' },
  browseBtn: { backgroundColor: '#101e0f', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginTop: 6 },
  browseBtnText: { color: '#f3ecd8', fontWeight: '800', fontSize: 12 },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3ecd8',
  },
  itemTitle: { fontSize: 14, fontWeight: '800', color: '#101e0f' },
  meta: { fontSize: 11, color: '#5a6258', marginTop: 2, fontWeight: '600' },
  quantityControlRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#101e0f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnDisabled: {
    backgroundColor: '#cfd8ce',
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#101e0f',
    minWidth: 20,
    textAlign: 'center',
  },
  itemTotalContainer: {
    minWidth: 70,
    alignItems: 'flex-end',
    marginLeft: 4,
  },
  itemTotal: { fontSize: 13, fontWeight: '900', color: '#d97834' },
  removeBtn: {
    padding: 4,
    marginLeft: 2,
  },
  totalSummaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#101e0f',
    padding: 14,
    borderRadius: 16,
  },
  totalSummaryLabel: { color: '#889e87', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  totalSummaryValue: { color: '#f3ecd8', fontSize: 18, fontWeight: '900' },
  typeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    padding: 14,
    gap: 2,
  },
  typeCardActive: { backgroundColor: '#101e0f', borderColor: '#101e0f' },
  typeLabel: { fontSize: 14, fontWeight: '800', color: '#101e0f' },
  typeLabelActive: { color: '#f3ecd8' },
  cashNoticeCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#bbf7d0',
    padding: 14,
    gap: 8,
  },
  cashNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cashNoticeBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashNoticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803d',
  },
  cashNoticeSubtitle: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '600',
  },
  cashNoticeBody: {
    fontSize: 11,
    color: '#166534',
    lineHeight: 16,
  },
  confirmBtn: {
    marginTop: 6,
    marginBottom: 20,
    backgroundColor: '#d97834',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#d97834',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  confirmBtnCash: {
    backgroundColor: '#15803d',
    shadowColor: '#15803d',
  },
  confirmDisabled: { opacity: 0.5 },
  confirmText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
});
