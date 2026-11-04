import React from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { PaymentRecordDto, PaymentStatus } from '@/services/payment';

export interface PaymentStatusModalProps {
  visible: boolean;
  status: PaymentStatus;
  payment?: PaymentRecordDto | null;
  onRefresh: () => void;
  onClose: () => void;
  refreshing?: boolean;
}

export function PaymentStatusModal({
  visible,
  status,
  payment,
  onRefresh,
  onClose,
  refreshing = false,
}: PaymentStatusModalProps) {
  const isFinalSuccess = status === 'SUCCESS';
  const isFinalFailed = status === 'FAILED';
  const isPending = status === 'PENDING' || status === 'AWAITING_OTP';
  const isUnknown = status === 'UNKNOWN';

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Icône d'état */}
          <View
            style={[
              styles.iconWrapper,
              isFinalSuccess && styles.iconWrapperSuccess,
              isFinalFailed && styles.iconWrapperFailed,
              isPending && styles.iconWrapperPending,
              isUnknown && styles.iconWrapperUnknown,
            ]}
          >
            {isPending ? (
              <ActivityIndicator size="large" color="#d97834" />
            ) : isFinalSuccess ? (
              <Feather name="check-circle" size={42} color="#15803d" />
            ) : isFinalFailed ? (
              <Feather name="x-circle" size={42} color="#dc2626" />
            ) : (
              <Feather name="alert-triangle" size={42} color="#b45309" />
            )}
          </View>

          {/* Titre et sous-titre */}
          <Text style={styles.title}>
            {isFinalSuccess
              ? 'Paiement Confirmé !'
              : isFinalFailed
              ? 'Échec du Paiement'
              : isPending
              ? 'Traitement en cours…'
              : 'En attente de confirmation'}
          </Text>

          <Text style={styles.message}>
            {isFinalSuccess
              ? 'Votre paiement Mobile Money a été validé avec succès par votre opérateur. Votre commande est confirmée.'
              : isFinalFailed
              ? "La transaction n'a pas pu aboutir ou a été rejetée. Aucun montant n'a été prélevé."
              : isPending
              ? "Vérifiez votre téléphone : confirmez l'invite Mobile Money (ou le SMS de confirmation) pour finaliser le débit."
              : 'La réponse de validation de l’opérateur est encore en cours. Vous pouvez réactualiser ou consulter votre suivi plus tard.'}
          </Text>

          {/* Détails de la transaction */}
          {payment && (
            <View style={styles.detailsBox}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Montant réglé :</Text>
                <Text style={styles.detailValue}>
                  {Number(payment.amount).toLocaleString()} {payment.currency}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Opérateur :</Text>
                <Text style={styles.detailValue}>{payment.operator?.toUpperCase()}</Text>
              </View>
              {payment.phoneNumberMasked ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Téléphone :</Text>
                  <Text style={styles.detailValue}>{payment.phoneNumberMasked}</Text>
                </View>
              ) : null}
              {payment.reference ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Référence :</Text>
                  <Text style={styles.detailValue} numberOfLines={1}>
                    {payment.reference.substring(0, 16)}…
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Boutons d'action */}
          <View style={styles.actionsColumn}>
            {(isPending || isUnknown) && (
              <TouchableOpacity
                style={styles.refreshBtn}
                onPress={onRefresh}
                disabled={refreshing}
                activeOpacity={0.8}
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color="#101e0f" />
                ) : (
                  <>
                    <Feather name="refresh-cw" size={14} color="#101e0f" style={{ marginRight: 6 }} />
                    <Text style={styles.refreshBtnText}>Actualiser le statut</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                isFinalSuccess && styles.primaryBtnSuccess,
                isFinalFailed && styles.primaryBtnFailed,
              ]}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>
                {isFinalSuccess ? 'Consulter mes commandes' : 'Fermer'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(16, 30, 15, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e6dfcc',
    gap: 12,
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconWrapperSuccess: {
    backgroundColor: '#dcfce7',
  },
  iconWrapperFailed: {
    backgroundColor: '#fee2e2',
  },
  iconWrapperPending: {
    backgroundColor: '#ffedd5',
  },
  iconWrapperUnknown: {
    backgroundColor: '#fef3c7',
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    color: '#101e0f',
    textAlign: 'center',
  },
  message: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
  },
  detailsBox: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 6,
    marginVertical: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#101e0f',
  },
  actionsColumn: {
    width: '100%',
    gap: 8,
    marginTop: 8,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f1f5f9',
  },
  refreshBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#101e0f',
  },
  primaryBtn: {
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#101e0f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnSuccess: {
    backgroundColor: '#15803d',
  },
  primaryBtnFailed: {
    backgroundColor: '#b91c1c',
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
});
