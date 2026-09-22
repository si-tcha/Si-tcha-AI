import { describe, expect, it } from 'vitest';
import { createQrMatrix } from '@/components/ui/order-qr-code';

describe('QR de bordereau hors ligne', () => {
  it('génère une matrice QR déterministe sans requête réseau', () => {
    const first = createQrMatrix('4');
    const second = createQrMatrix('4');

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThanOrEqual(21);
    expect(first.every((row) => row.length === first.length)).toBe(true);
    expect(first.flat().some(Boolean)).toBe(true);
    expect(first.flat().some((cell) => !cell)).toBe(true);
  });

  it('produit des QR différents pour deux commandes différentes', () => {
    expect(createQrMatrix('REF-3')).not.toEqual(createQrMatrix('REF-4'));
  });

  it('refuse un identifiant vide', () => {
    expect(() => createQrMatrix('   ')).toThrow('ne peut pas être vide');
  });
});
