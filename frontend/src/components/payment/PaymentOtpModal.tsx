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

export interface PaymentOtpModalProps {
  visible: boolean;
  operatorName: string;
  phoneNumberMasked?: string;
  instructions?: string;
  otpCode: string;
  onChangeOtp: (code: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  busy?: boolean;
  errorMessage?: string | null;
}

export function PaymentOtpModal({
  visible,
  operatorName,
  phoneNumberMasked,
  instructions,
  otpCode,
  onChangeOtp,
  onSubmit,
  onCancel,
  busy = false,
  errorMessage,
}: PaymentOtpModalProps) {
  const isSubmitDisabled = busy || otpCode.trim().length < 4;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <ModalKeyboardContainer>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.headerLeft}>
                <View style={styles.iconCircle}>
                  <Feather name="key" size={16} color="#d97834" />
                </View>
                <Text style={styles.modalTitle}>Validation du Paiement</Text>
              </View>
              <TouchableOpacity onPress={onCancel} disabled={busy} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#101e0f" />
              </TouchableOpacity>
            </View>

            {/* Corps */}
            <View style={styles.body}>
              <Text style={styles.promptText}>
                Un code d'autorisation temporaire (OTP) est requis par{' '}
                <Text style={styles.boldText}>{operatorName}</Text>
                {phoneNumberMasked ? ` pour le numéro ${phoneNumberMasked}` : ''}.
              </Text>

              {instructions ? (
                <View style={styles.instructionsBox}>
                  <Feather name="info" size={14} color="#b45309" />
                  <Text style={styles.instructionsText}>{instructions}</Text>
                </View>
              ) : null}

              <Text style={styles.inputLabel}>Code de validation OTP</Text>
              <TextInput
                style={styles.otpInput}
                placeholder="Ex : 1234"
                placeholderTextColor="#889e87"
                keyboardType="number-pad"
                value={otpCode}
                onChangeText={onChangeOtp}
                maxLength={10}
                editable={!busy}
                autoFocus
              />

              {errorMessage ? (
                <View style={styles.errorBox}>
                  <Feather name="alert-triangle" size={13} color="#dc2626" />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              <Text style={styles.securityNotice}>
                🔒 Le code OTP est à usage unique et n'est jamais conservé en base de données.
              </Text>

              {/* Boutons d'action */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onCancel}
                  disabled={busy}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelBtnText}>Annuler</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, isSubmitDisabled && styles.submitBtnDisabled]}
                  onPress={onSubmit}
                  disabled={isSubmitDisabled}
                  activeOpacity={0.85}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Feather name="check-circle" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text style={styles.submitBtnText}>Confirmer le débit</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
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
  promptText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '800',
    color: '#101e0f',
  },
  instructionsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef3c7',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  instructionsText: {
    flex: 1,
    fontSize: 11,
    color: '#92400e',
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#101e0f',
    textTransform: 'uppercase',
  },
  otpInput: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#d97834',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 4,
    color: '#101e0f',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fee2e2',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  errorText: {
    flex: 1,
    fontSize: 11,
    color: '#b91c1c',
    fontWeight: '700',
  },
  securityNotice: {
    fontSize: 10,
    color: '#5a6258',
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  submitBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#d97834',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
});
