import prisma from '../lib/prisma.js';

export const PROGRAM_STATUSES = ['BROUILLON', 'PUBLIE', 'CLOTURE'] as const;
export const APPLICATION_STATUSES = ['ASSISTANCE_DEMANDEE', 'DOSSIER_EN_COURS', 'DOSSIER_DEPOSE', 'ACCEPTE', 'REFUSE'] as const;

export type ProgramStatus = typeof PROGRAM_STATUSES[number];
export type ApplicationStatus = typeof APPLICATION_STATUSES[number];

const serializeProgram = (program: any) => ({
  id: program.id.toString(),
  nom: program.nom,
  description: program.description,
  criteresEligibilite: program.criteresEligibilite,
  dateLimite: program.dateLimite.toISOString().slice(0, 10),
  urlLien: program.urlLien,
  statut: program.statut,
  estDemo: program.estDemo,
  createdAt: program.createdAt.toISOString(),
  updatedAt: program.updatedAt.toISOString(),
});

export async function listPublishedPrograms() {
  const now = new Date();
  const programs = await prisma.programmeAgricole.findMany({
    where: { statut: 'PUBLIE', dateLimite: { gte: now } },
    orderBy: [{ dateLimite: 'asc' }, { id: 'asc' }],
  });
  return programs.map(serializeProgram);
}

export async function listProgramsForAdmin() {
  const programs = await prisma.programmeAgricole.findMany({
    include: { _count: { select: { candidatures: true } } },
    orderBy: [{ statut: 'asc' }, { dateLimite: 'asc' }],
  });
  return programs.map((program) => ({ ...serializeProgram(program), candidatureCount: program._count.candidatures }));
}

export async function createProgram(input: { nom: string; description: string; criteresEligibilite: string; dateLimite: string; urlLien?: string; statut?: ProgramStatus }) {
  const program = await prisma.programmeAgricole.create({
    data: {
      nom: input.nom.trim(),
      description: input.description.trim(),
      criteresEligibilite: input.criteresEligibilite.trim(),
      dateLimite: new Date(`${input.dateLimite}T00:00:00.000Z`),
      urlLien: input.urlLien?.trim() ?? '',
      statut: input.statut ?? 'PUBLIE',
      estDemo: false,
    },
  });
  return serializeProgram(program);
}

export async function updateProgramStatus(programId: string, statut: ProgramStatus) {
  const id = parsePositiveId(programId, 'Programme introuvable.');
  const program = await prisma.programmeAgricole.update({ where: { id }, data: { statut } });
  return serializeProgram(program);
}

export async function requestProgramAssistance(farmerId: string, programId: string, message: string) {
  const agriculteurId = parsePositiveId(farmerId, 'Compte agriculteur invalide.');
  const programmeAgricoleId = parsePositiveId(programId, 'Programme introuvable.');
  const program = await prisma.programmeAgricole.findFirst({
    where: { id: programmeAgricoleId, statut: 'PUBLIE', dateLimite: { gte: new Date() } },
    select: { id: true },
  });
  if (!program) throw Object.assign(new Error('Ce programme n’est plus disponible.'), { statusCode: 409 });

  const existing = await prisma.candidatureProgramme.findUnique({
    where: { programmeAgricoleId_agriculteurId: { programmeAgricoleId, agriculteurId } },
  });
  if (existing) throw Object.assign(new Error('Vous suivez déjà ce programme.'), { statusCode: 409 });

  const now = new Date();
  const application = await prisma.candidatureProgramme.create({
    data: {
      programmeAgricoleId,
      agriculteurId,
      demandeAssistance: message.trim() || null,
      assistanceRequestedAt: now,
      statut: 'ASSISTANCE_DEMANDEE',
    },
    include: { programmeAgricole: true },
  });
  return serializeApplication(application);
}

export async function listApplicationsForFarmer(farmerId: string) {
  const agriculteurId = parsePositiveId(farmerId, 'Compte agriculteur invalide.');
  const applications = await prisma.candidatureProgramme.findMany({
    where: { agriculteurId }, include: { programmeAgricole: true }, orderBy: { updatedAt: 'desc' },
  });
  return applications.map(serializeApplication);
}

export async function listApplicationsForAdmin() {
  const applications = await prisma.candidatureProgramme.findMany({
    include: { programmeAgricole: true, agriculteur: { select: { id: true, nom: true, contact: true, gic: { select: { nom: true } } } } },
    orderBy: { updatedAt: 'desc' },
  });
  return applications.map((application) => ({
    ...serializeApplication(application),
    agriculteur: {
      id: application.agriculteur.id.toString(),
      nom: application.agriculteur.nom,
      contact: application.agriculteur.contact,
      gicNom: application.agriculteur.gic.nom,
    },
  }));
}

export async function updateApplicationByAdmin(applicationId: string, statut: ApplicationStatus, noteAgent?: string) {
  const id = parsePositiveId(applicationId, 'Dossier introuvable.');
  const application = await prisma.candidatureProgramme.update({
    where: { id },
    data: {
      statut,
      ...(noteAgent !== undefined ? { noteAgent: noteAgent.trim() || null } : {}),
      ...(statut === 'DOSSIER_DEPOSE' ? { submittedAt: new Date() } : {}),
    },
    include: { programmeAgricole: true },
  });
  return serializeApplication(application);
}

export async function findApplicationsNeedingDeadlineReminder(referenceDate = new Date()) {
  const start = new Date(referenceDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 14);
  return prisma.candidatureProgramme.findMany({
    where: {
      statut: { in: ['ASSISTANCE_DEMANDEE', 'DOSSIER_EN_COURS', 'DOSSIER_DEPOSE'] },
      programmeAgricole: { statut: 'PUBLIE', dateLimite: { gte: start, lte: end } },
    },
    include: { programmeAgricole: true, agriculteur: { select: { contact: true, nom: true } } },
  });
}

export function shouldSendDeadlineReminder(dateLimite: Date, lastReminderAt: Date | null, referenceDate = new Date()) {
  const today = new Date(referenceDate); today.setUTCHours(0, 0, 0, 0);
  if (lastReminderAt && lastReminderAt >= today) return false;
  const deadline = new Date(dateLimite); deadline.setUTCHours(0, 0, 0, 0);
  const days = Math.round((deadline.getTime() - today.getTime()) / 86_400_000);
  return days === 14 || days === 7 || days === 2 || days === 0;
}

const serializeApplication = (application: any) => ({
  id: application.id.toString(),
  statut: application.statut,
  demandeAssistance: application.demandeAssistance,
  noteAgent: application.noteAgent,
  submittedAt: application.submittedAt?.toISOString() ?? null,
  assistanceRequestedAt: application.assistanceRequestedAt?.toISOString() ?? null,
  updatedAt: application.updatedAt.toISOString(),
  programme: serializeProgram(application.programmeAgricole),
});

function parsePositiveId(value: string, message: string): bigint {
  try {
    const id = BigInt(value);
    if (id > 0n) return id;
  } catch { /* normalized below */ }
  throw Object.assign(new Error(message), { statusCode: 404 });
}
