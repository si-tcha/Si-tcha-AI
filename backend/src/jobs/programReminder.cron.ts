import cron from 'node-cron';
import prisma from '../lib/prisma.js';
import { sendSms } from '../services/notification.service.js';
import { findApplicationsNeedingDeadlineReminder, shouldSendDeadlineReminder } from '../services/program.service.js';

export async function runProgramDeadlineReminders(referenceDate = new Date()) {
  const applications = await findApplicationsNeedingDeadlineReminder(referenceDate);
  for (const application of applications) {
    if (!shouldSendDeadlineReminder(application.programmeAgricole.dateLimite, application.lastReminderAt, referenceDate)) continue;
    const deadline = application.programmeAgricole.dateLimite.toISOString().slice(0, 10);
    const message = `SI-TCHA: ${application.programmeAgricole.nom}. Votre dossier est ${application.statut.toLowerCase().replaceAll('_', ' ')}. Date limite: ${deadline}. Connectez-vous ou contactez l’agent.`;
    const sent = await sendSms({ to: application.agriculteur.contact, message });
    if (sent) {
      await prisma.candidatureProgramme.update({ where: { id: application.id }, data: { lastReminderAt: referenceDate } });
    }
  }
}

export function startProgramReminderCronJob() {
  cron.schedule('15 8 * * *', async () => {
    try {
      await runProgramDeadlineReminders();
    } catch (error) {
      console.error('[CRON] Rappels programmes agricoles indisponibles:', error);
    }
  }, { timezone: 'Africa/Douala' });
}
