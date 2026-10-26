import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../src/lib/prisma.js';
import { requestProgramAssistance, shouldSendDeadlineReminder } from '../src/services/program.service.js';

vi.mock('../src/lib/prisma', () => ({
  default: {
    programmeAgricole: { findFirst: vi.fn() },
    candidatureProgramme: { findUnique: vi.fn(), create: vi.fn() },
  },
}));

describe('program assistance and reminders', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates one tracked assistance request for an active program', async () => {
    vi.mocked(prisma.programmeAgricole.findFirst).mockResolvedValue({ id: 12n } as any);
    vi.mocked(prisma.candidatureProgramme.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.candidatureProgramme.create).mockResolvedValue({
      id: 5n, statut: 'ASSISTANCE_DEMANDEE', demandeAssistance: 'Aide pour les pièces', noteAgent: null,
      submittedAt: null, assistanceRequestedAt: new Date('2026-10-26T10:00:00Z'), updatedAt: new Date('2026-10-26T10:00:00Z'),
      programmeAgricole: { id: 12n, nom: 'Programme test', description: 'Description', criteresEligibilite: 'Critères', dateLimite: new Date('2026-12-15T00:00:00Z'), urlLien: '', statut: 'PUBLIE', estDemo: false, createdAt: new Date(), updatedAt: new Date() },
    } as any);

    const result = await requestProgramAssistance('7', '12', ' Aide pour les pièces ');
    expect(result).toMatchObject({ id: '5', statut: 'ASSISTANCE_DEMANDEE', programme: { id: '12', nom: 'Programme test' } });
    expect(prisma.candidatureProgramme.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ agriculteurId: 7n, programmeAgricoleId: 12n, demandeAssistance: 'Aide pour les pièces' }) }));
  });

  it('does not create a duplicate dossier for the same farmer and program', async () => {
    vi.mocked(prisma.programmeAgricole.findFirst).mockResolvedValue({ id: 12n } as any);
    vi.mocked(prisma.candidatureProgramme.findUnique).mockResolvedValue({ id: 5n } as any);
    await expect(requestProgramAssistance('7', '12', '')).rejects.toMatchObject({ statusCode: 409 });
    expect(prisma.candidatureProgramme.create).not.toHaveBeenCalled();
  });

  it('sends a reminder only at the configured deadline milestones and at most once a day', () => {
    const today = new Date('2026-10-26T10:00:00Z');
    expect(shouldSendDeadlineReminder(new Date('2026-11-09T00:00:00Z'), null, today)).toBe(true);
    expect(shouldSendDeadlineReminder(new Date('2026-11-02T00:00:00Z'), null, today)).toBe(true);
    expect(shouldSendDeadlineReminder(new Date('2026-10-28T00:00:00Z'), null, today)).toBe(true);
    expect(shouldSendDeadlineReminder(new Date('2026-10-29T00:00:00Z'), null, today)).toBe(false);
    expect(shouldSendDeadlineReminder(new Date('2026-10-26T00:00:00Z'), new Date('2026-10-26T01:00:00Z'), today)).toBe(false);
  });
});
