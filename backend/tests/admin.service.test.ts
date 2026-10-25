import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../src/lib/prisma.js';
import { createGicAndLeader, getAdminBootstrap, updatePendingMemberStatusByAdmin } from '../src/services/admin.service.js';

vi.mock('../src/lib/prisma', () => ({
  default: {
    $transaction: vi.fn(),
    bassinProduction: { findMany: vi.fn() },
    agriculteur: { updateMany: vi.fn(), findUnique: vi.fn() },
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

  it('lets an admin atomically approve only a pending account', async () => {
    vi.mocked(prisma.agriculteur.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.agriculteur.findUnique).mockResolvedValue({
      id: 41n, nom: 'Nouveau membre', contact: '+237670000041', statut: 'APPROUVE',
      gicId: 3n, timestampMaj: new Date('2026-10-25T10:00:00Z'),
    } as any);

    await expect(updatePendingMemberStatusByAdmin('41', 'APPROUVE')).resolves.toEqual(expect.objectContaining({
      id: '41', gicId: '3', statut: 'APPROUVE',
    }));
    expect(prisma.agriculteur.updateMany).toHaveBeenCalledWith({
      where: { id: 41n, statut: 'EN_ATTENTE' },
      data: { statut: 'APPROUVE', timestampMaj: expect.any(Date) },
    });
  });

  it('refuses a stale approval when the account is no longer pending', async () => {
    vi.mocked(prisma.agriculteur.updateMany).mockResolvedValue({ count: 0 });
    await expect(updatePendingMemberStatusByAdmin('41', 'REJETE')).rejects.toMatchObject({ statusCode: 409 });
    expect(prisma.agriculteur.findUnique).not.toHaveBeenCalled();
  });
});
