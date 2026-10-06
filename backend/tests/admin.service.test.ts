import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../src/lib/prisma.js';
import { createGicAndLeader, getAdminBootstrap } from '../src/services/admin.service.js';

vi.mock('../src/lib/prisma', () => ({
  default: {
    $transaction: vi.fn(),
    bassinProduction: { findMany: vi.fn() },
  },
}));

vi.mock('bcrypt', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed-pin') },
}));

describe('admin service safety', () => {
  beforeEach(() => vi.clearAllMocks());

  it('never returns a leader PIN or hash after creation', async () => {
    const tx = {
      gIC: { create: vi.fn().mockResolvedValue({ id: BigInt(9), nom: 'GIC Test', identifiantREF: 'GIC-TEST-009' }) },
      agriculteur: {
        create: vi.fn().mockResolvedValue({
          id: BigInt(11), nom: 'Leader Test', contact: '+237695715021', estLeader: true,
          phoneVerified: true, statut: 'APPROUVE', gicId: BigInt(9), pin: 'hashed-pin', pinHash: 'hashed-pin',
        }),
      },
    };
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx));

    const result = await createGicAndLeader(
      { nom: 'GIC Test', identifiantREF: 'GIC-TEST-009', bassinProductionId: '2', activitesPrincipales: 'Maraîchage', statutLegalisation: 'Légalisé', logoURL: '' },
      { nom: 'Leader Test', contact: '+237695715021', pin: '1234' }
    );

    expect(result.leader).toEqual(expect.objectContaining({ nom: 'Leader Test', statut: 'APPROUVE' }));
    expect(result.leader).not.toHaveProperty('pin');
    expect(result.leader).not.toHaveProperty('pinHash');
    expect(tx.agriculteur.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ pin: 'hashed-pin', pinHash: 'hashed-pin', phoneVerified: true }),
    }));
  });

  it('exposes only the basin fields needed by the dashboard', async () => {
    vi.mocked(prisma.bassinProduction.findMany).mockResolvedValue([
      { id: BigInt(2), nom: 'Centre', region: 'Centre' },
    ] as any);

    await expect(getAdminBootstrap()).resolves.toEqual({ bassins: [{ id: '2', nom: 'Centre', region: 'Centre' }] });
    expect(prisma.bassinProduction.findMany).toHaveBeenCalledWith({
      select: { id: true, nom: true, region: true },
      orderBy: { nom: 'asc' },
    });
  });
});
