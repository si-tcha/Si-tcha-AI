import { describe, expect, it } from 'vitest';
import { normalizeAdminPhone, validateAdminGicForm } from '../src/admin/validation';

const valid = {
  gicName: 'GIC Montagne',
  reference: 'GIC-OUEST-001',
  bassinProductionId: '3',
  activities: 'Maraîchage',
  legalStatus: 'Légalisé',
  logoUrl: '',
  leaderName: 'Aminata Test',
  leaderPhone: '695 715 021',
  leaderPin: '1234',
  confirmPin: '1234',
};

describe('admin dashboard form validation', () => {
  it('normalizes valid Cameroon numbers before API submission', () => {
    expect(normalizeAdminPhone('695 715 021')).toBe('+237695715021');
    expect(normalizeAdminPhone('+237 695 715 021')).toBe('+237695715021');
  });

  it('rejects invalid PIN confirmation and malformed phones', () => {
    expect(validateAdminGicForm(valid)).toBeNull();
    expect(validateAdminGicForm({ ...valid, confirmPin: '5678' })).toMatch(/PIN/);
    expect(validateAdminGicForm({ ...valid, leaderPhone: '123' })).toMatch(/téléphone/i);
  });

  it('rejects malformed optional logo URLs and invalid basin identifiers', () => {
    expect(validateAdminGicForm({ ...valid, logoUrl: 'pas-une-url' })).toMatch(/URL du logo/i);
    expect(validateAdminGicForm({ ...valid, bassinProductionId: '0' })).toMatch(/bassin/i);
    expect(validateAdminGicForm({ ...valid, bassinProductionId: '2.5' })).toMatch(/bassin/i);
  });
});
