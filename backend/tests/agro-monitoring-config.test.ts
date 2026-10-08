import { describe, expect, it } from 'vitest';
import { getAgroMonitoringApiKey } from '../src/jobs/agroMonitoring.cron.js';

describe('AgroMonitoring cron configuration', () => {
  it('disables provider calls when the API key is absent or whitespace', () => {
    expect(getAgroMonitoringApiKey(undefined)).toBeNull();
    expect(getAgroMonitoringApiKey('   ')).toBeNull();
  });

  it('returns a trimmed configured API key', () => {
    expect(getAgroMonitoringApiKey('  agro-key  ')).toBe('agro-key');
  });
});
