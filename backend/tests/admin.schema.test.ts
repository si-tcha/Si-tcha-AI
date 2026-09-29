import { describe, expect, it } from 'vitest';
import { createGicSchema } from '../src/schemas/admin.schema.js';

describe('admin GIC creation schema', () => {
  const validPayload = {
    body: {
      gicData: {
        nom: 'GIC Test',
        identifiantREF: 'GIC-TEST-001',
        bassinProductionId: '12',
        activitesPrincipales: 'Maraîchage',
        statutLegalisation: 'Légalisé',
      },
      leaderData: {
        nom: 'Responsable Test',
        contact: '695 715 021',
        pin: '1234',
      },
    },
    query: {},
    params: {},
  };

  it('normalizes a Cameroon leader phone and fills the optional logo safely', async () => {
    const parsed = await createGicSchema.parseAsync(validPayload);
    expect(parsed.body.leaderData.contact).toBe('+237695715021');
    expect(parsed.body.gicData.logoURL).toBe('');
  });

  it('rejects invalid IDs, PINs, phones, and unknown privilege-shaped fields', async () => {
    await expect(createGicSchema.parseAsync({
      ...validPayload,
      body: {
        ...validPayload.body,
        gicData: { ...validPayload.body.gicData, bassinProductionId: '0' },
      },
      query: {},
      params: {},
    })).rejects.toThrow(/Identifiant de bassin invalide/);

    await expect(createGicSchema.parseAsync({
      ...validPayload,
      body: {
        ...validPayload.body,
        leaderData: { ...validPayload.body.leaderData, pin: '12', estLeader: false },
      },
      query: {},
      params: {},
    })).rejects.toThrow();
  });
});
