import React from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ModalKeyboardContainer } from '@/components/ui/modal-keyboard-container';
import type { OrderRecord } from '@/services/database';
import type { PaymentOperator } from '@/services/payment';

export interface OrderPaymentModalProps {
  visible: boolean;
  order: OrderRecord | null;
  operators: PaymentOperator[];
  selectedOperator: string;
  onSelectOperator: (op: string) => void;
  phoneNumber: string;
  onChangePhoneNumber: (phone: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}

export function OrderPaymentModal({
  visible,
  order,
  operators,
  selectedOperator,
  onSelectOperator,
  phoneNumber,
  onChangePhoneNumber,
  onConfirm,
  onClose,
  busy = false,
}: OrderPaymentModalProps) {
  if (!order) return null;

  const currentOperator = operators.find((op) => op.code.toLowerCase() === selectedOperator.toLowerCase());
  const totalAmount = order.quantity * parseFloat(order.price || '0');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <ModalKeyboardContainer>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.headerLeft}>
                <View style={styles.iconCircle}>
                  <Feather name="smartphone" size={16} color="#d97834" />
                </View>
                <Text style={styles.modalTitle}>Régler par Mobile Money</Text>
              </View>
              <TouchableOpacity onPress={onClose} disabled={busy} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#101e0f" />
              </TouchableOpacity>
            </View>

            {/* Corps */}
            <View style={styles.body}>
              <View style={styles.orderSummaryBox}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Produit :</Text>
                  <Text style={styles.summaryValue}>{order.productName}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Quantité :</Text>
                  <Text style={styles.summaryValue}>
                    {order.quantity} {order.unit}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total à régler :</Text>
                  <Text style={styles.totalValue}>{totalAmount.toLocaleString()} FCFA</Text>
                </View>
              </View>

              {/* Opérateurs */}
              <Text style={styles.fieldLabel}>Choisir un opérateur</Text>
              <View style={styles.operatorsGrid}>
                {operators.map((op) => {
                  const isSelected = op.code.toLowerCase() === selectedOperator.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={op.code}
                      style={[styles.operatorChip, isSelected && styles.operatorChipSelected]}
                      onPress={() => onSelectOperator(op.code)}
                      disabled={busy}
                      activeOpacity={0.8}
                    >
                      <View style={styles.operatorTop}>
                        <Feather
                          name={isSelected ? 'check-circle' : 'circle'}
                          size={14}
                          color={isSelected ? '#d97834' : '#889e87'}
                        />
                        <Text style={[styles.operatorName, isSelected && styles.operatorNameSelected]}>
                          {op.name}
                        </Text>
                      </View>
                      {op.requiresOtp && (
                        <View style={styles.otpBadge}>
                          <Text style={styles.otpBadgeText}>Code OTP requis</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Téléphone */}
              <Text style={styles.fieldLabel}>Numéro Mobile Money</Text>
              <View style={styles.phoneInputRow}>
                <View style={styles.phonePrefixBox}>
                  <Text style={styles.phonePrefixText}>+237</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="6XX XXX XXX"
                  placeholderTextColor="#889e87"
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={onChangePhoneNumber}
                  maxLength={13}
                  editable={!busy}
                />
              </View>

              {currentOperator?.requiresOtp && (
                <View style={styles.otpNotice}>
                  <Feather name="info" size={13} color="#b45309" />
                  <Text style={styles.otpNoticeText}>
                    {currentOperator.instructions ||
                      "Cet opérateur requiert la saisie d'un code OTP à l'étape suivante."}
                  </Text>
                </View>
              )}

              {/* Bouton de confirmation */}
              <TouchableOpacity
                style={[styles.confirmBtn, busy && styles.confirmBtnDisabled]}
                onPress={onConfirm}
                disabled={busy}
                activeOpacity={0.85}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Feather name="check-circle" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.confirmBtnText}>
                      Initier le paiement ({totalAmount.toLocaleString()} FCFA)
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ModalKeyboardContainer>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(16, 30, 15, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#f3ecd8',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e6dfcc',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e6dfcc',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#101e0f',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    padding: 16,
    gap: 12,
  },
  orderSummaryBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    padding: 12,
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#5a6258',
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#101e0f',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#d97834',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#101e0f',
    textTransform: 'uppercase',
  },
  operatorsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  operatorChip: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    padding: 10,
    gap: 4,
  },
  operatorChipSelected: {
    backgroundColor: '#fff7ed',
    borderColor: '#d97834',
  },
  operatorTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  operatorName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  operatorNameSelected: {
    color: '#c2410c',
  },
  otpBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  otpBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#92400e',
  },
  phoneInputRow: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6dfcc',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  phonePrefixBox: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e2e8f0',
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
  },
  phonePrefixText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#101e0f',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#101e0f',
  },
  otpNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fffbeb',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  otpNoticeText: {
    flex: 1,
    fontSize: 11,
    color: '#92400e',
    fontWeight: '600',
  },
  confirmBtn: {
    flexDirection: 'row',
    marginTop: 6,
    backgroundColor: '#d97834',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
