import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../src/lib/prisma.js';
import { findAllGics, findJoinableGicById } from '../src/services/gic.service.js';

vi.mock('../src/lib/prisma', () => ({
  default: {
    gIC: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}));

describe('GIC registration directory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists only GICs having an approved, verified leader', async () => {
    vi.mocked(prisma.gIC.findMany).mockResolvedValue([
      { id: BigInt(8), nom: 'GIC Disponible' },
    ] as any);

    await expect(findAllGics()).resolves.toEqual([{ id: '8', nom: 'GIC Disponible' }]);
    expect(prisma.gIC.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        agriculteurs: expect.objectContaining({
          some: expect.objectContaining({ estLeader: true, statut: 'APPROUVE' }),
        }),
      }),
      orderBy: { nom: 'asc' },
    }));
  });

  it('never resolves an arbitrary ID when no joinable GIC exists', async () => {
    vi.mocked(prisma.gIC.findFirst).mockResolvedValue(null);
    await expect(findJoinableGicById('999')).resolves.toBeNull();
    expect(prisma.gIC.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: BigInt(999) }),
    }));
  });

  it('rejects a non-decimal GIC identifier before querying the database', async () => {
    await expect(findJoinableGicById('1e3')).resolves.toBeNull();
    expect(prisma.gIC.findFirst).not.toHaveBeenCalled();
  });
});
