import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { PaymentOperator } from '@/services/payment';

export type PaymentMode = 'cash' | 'mobile_money';

export interface PaymentMethodSelectorProps {
  selectedMode: PaymentMode;
  onSelectMode: (mode: PaymentMode) => void;
  operators: PaymentOperator[];
  selectedOperator: string;
  onSelectOperator: (code: string) => void;
  phoneNumber: string;
  onChangePhoneNumber: (phone: string) => void;
  loadingMethods?: boolean;
  disabled?: boolean;
}

export function PaymentMethodSelector({
  selectedMode,
  onSelectMode,
  operators,
  selectedOperator,
  onSelectOperator,
  phoneNumber,
  onChangePhoneNumber,
  loadingMethods = false,
  disabled = false,
}: PaymentMethodSelectorProps) {
  const currentOperator = operators.find((op) => op.code.toLowerCase() === selectedOperator.toLowerCase());

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Modalité de règlement</Text>

      {/* Choix Espèces vs Mobile Money */}
      <View style={styles.modeTabsRow}>
        <TouchableOpacity
          style={[
            styles.modeTab,
            selectedMode === 'cash' && styles.modeTabActiveCash,
          ]}
          onPress={() => onSelectMode('cash')}
          disabled={disabled}
          activeOpacity={0.8}
          accessibilityRole="radio"
          accessibilityState={{ selected: selectedMode === 'cash' }}
          accessibilityLabel="Règlement en espèces à la livraison"
        >
          <Feather
            name="dollar-sign"
            size={18}
            color={selectedMode === 'cash' ? '#ffffff' : '#15803d'}
          />
          <Text
            style={[
              styles.modeTabText,
              selectedMode === 'cash' && styles.modeTabTextActive,
            ]}
          >
            Espèces
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeTab,
            selectedMode === 'mobile_money' && styles.modeTabActiveMoMo,
          ]}
          onPress={() => onSelectMode('mobile_money')}
          disabled={disabled}
          activeOpacity={0.8}
          accessibilityRole="radio"
          accessibilityState={{ selected: selectedMode === 'mobile_money' }}
          accessibilityLabel="Paiement Mobile Money AfribaPay"
        >
          <Feather
            name="smartphone"
            size={18}
            color={selectedMode === 'mobile_money' ? '#ffffff' : '#d97834'}
          />
          <Text
            style={[
              styles.modeTabText,
              selectedMode === 'mobile_money' && styles.modeTabTextActive,
            ]}
          >
            Mobile Money
          </Text>
        </TouchableOpacity>
      </View>

      {/* Contenu spécifique : Espèces */}
      {selectedMode === 'cash' && (
        <View style={styles.cashNoticeCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconCircleGreen}>
              <Feather name="check-circle" size={16} color="#15803d" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cashTitle}>Règlement en espèces à la livraison</Text>
              <Text style={styles.cashSubtitle}>Aucun paiement en ligne immédiat</Text>
            </View>
          </View>
          <Text style={styles.cashBody}>
            Le règlement de cette commande s'effectue intégralement en espèces lors de la remise physique
            des produits par le transporteur ou auprès du magasinier du GIC. Vous recevrez un bordereau
            de commande QR pour vérifier vos récoltes à la livraison.
          </Text>
        </View>
      )}

      {/* Contenu spécifique : Mobile Money */}
      {selectedMode === 'mobile_money' && (
        <View style={styles.momoCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconCircleOrange}>
              <Feather name="shield" size={16} color="#d97834" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.momoTitle}>Paiement Mobile Money sécurisé</Text>
              <Text style={styles.momoSubtitle}>Passerelle officielle AfribaPay (Cameroun)</Text>
            </View>
          </View>

          {loadingMethods ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#d97834" />
              <Text style={styles.loadingText}>Chargement des opérateurs…</Text>
            </View>
          ) : (
            <>
              {/* Sélection de l'opérateur */}
              <Text style={styles.fieldLabel}>Opérateur réseau</Text>
              <View style={styles.operatorsGrid}>
                {operators.map((op) => {
                  const isSelected = op.code.toLowerCase() === selectedOperator.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={op.code}
                      style={[
                        styles.operatorChip,
                        isSelected && styles.operatorChipSelected,
                      ]}
                      onPress={() => onSelectOperator(op.code)}
                      disabled={disabled}
                      activeOpacity={0.8}
                    >
                      <View style={styles.operatorTop}>
                        <Feather
                          name={isSelected ? 'check-circle' : 'circle'}
                          size={14}
                          color={isSelected ? '#d97834' : '#889e87'}
                        />
                        <Text
                          style={[
                            styles.operatorName,
                            isSelected && styles.operatorNameSelected,
                          ]}
                        >
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

              {/* Champ numéro de téléphone */}
              <Text style={styles.fieldLabel}>Numéro Mobile Money (Cameroun)</Text>
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
                  editable={!disabled}
                />
              </View>

              {/* Instructions pour opérateurs OTP */}
              {currentOperator?.requiresOtp && (
                <View style={styles.otpNotice}>
                  <Feather name="info" size={14} color="#b45309" />
                  <Text style={styles.otpNoticeText}>
                    {currentOperator.instructions
                      ? currentOperator.instructions
                      : "Cet opérateur requiert un code d'autorisation temporaire (OTP). Vous serez invité à le saisir à l'étape suivante."}
                  </Text>
                </View>
              )}

              <Text style={styles.securityHint}>
                🔒 Le code PIN de votre compte Mobile Money ne vous sera jamais demandé par Si-Tcha.
              </Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#101e0f',
  },
  modeTabsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e6dfcc',
  },
  modeTabActiveCash: {
    backgroundColor: '#15803d',
    borderColor: '#15803d',
  },
  modeTabActiveMoMo: {
    backgroundColor: '#d97834',
    borderColor: '#d97834',
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#101e0f',
  },
  modeTabTextActive: {
    color: '#ffffff',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cashNoticeCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#bbf7d0',
    padding: 14,
    gap: 8,
  },
  iconCircleGreen: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803d',
  },
  cashSubtitle: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '600',
  },
  cashBody: {
    fontSize: 11,
    color: '#166534',
    lineHeight: 16,
  },
  momoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    padding: 14,
    gap: 10,
  },
  iconCircleOrange: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  momoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#c2410c',
  },
  momoSubtitle: {
    fontSize: 11,
    color: '#7c2d12',
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 12,
    color: '#5a6258',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#101e0f',
    marginTop: 2,
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
    backgroundColor: '#f8fafc',
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
  securityHint: {
    fontSize: 10,
    color: '#5a6258',
    lineHeight: 14,
    marginTop: 2,
  },
});
