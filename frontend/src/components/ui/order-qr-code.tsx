import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import qrcode from 'qrcode-generator';

const QUIET_ZONE_MODULES = 4;

export function createQrMatrix(value: string): boolean[][] {
  if (!value.trim()) {
    throw new Error('Le contenu du QR code ne peut pas être vide.');
  }

  const qr = qrcode(0, 'M');
  qr.addData(value, 'Byte');
  qr.make();

  return Array.from({ length: qr.getModuleCount() }, (_, row) =>
    Array.from({ length: qr.getModuleCount() }, (_, column) => qr.isDark(row, column))
  );
}

interface OrderQrCodeProps {
  orderId: string;
  size?: number;
}

export function OrderQrCode({ orderId, size = 132 }: OrderQrCodeProps) {
  const matrix = useMemo(() => createQrMatrix(orderId), [orderId]);
  const cellSize = Math.max(
    2,
    Math.floor(size / (matrix.length + QUIET_ZONE_MODULES * 2))
  );
  const quietZone = QUIET_ZONE_MODULES * cellSize;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Code QR de la commande ${orderId}`}
      testID="order-qr-code"
      style={[styles.container, { padding: quietZone }]}
    >
      {matrix.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {row.map((dark, columnIndex) => (
            <View
              key={`cell-${rowIndex}-${columnIndex}`}
              style={{
                width: cellSize,
                height: cellSize,
                backgroundColor: dark ? '#000000' : '#ffffff',
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    backgroundColor: '#ffffff',
  },
  row: {
    flexDirection: 'row',
  },
});
