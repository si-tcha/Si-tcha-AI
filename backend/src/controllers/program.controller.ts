import { Request, Response } from 'express';
import * as programService from '../services/program.service.js';

function validProgramInput(body: any) {
  const required = ['nom', 'description', 'criteresEligibilite', 'dateLimite'];
  if (!body || required.some((key) => typeof body[key] !== 'string' || !body[key].trim())) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(body.dateLimite) && !Number.isNaN(Date.parse(`${body.dateLimite}T00:00:00.000Z`));
}

export async function listPublicPrograms(_req: Request, res: Response) {
  res.json(await programService.listPublishedPrograms());
}

export async function listMyProgramApplications(req: Request, res: Response) {
  res.json(await programService.listApplicationsForFarmer(req.user!.id));
}

export async function requestAssistance(req: Request, res: Response) {
  const message = typeof req.body?.message === 'string' ? req.body.message : '';
  if (message.length > 1000) return res.status(400).json({ message: 'La demande d’assistance ne doit pas dépasser 1000 caractères.' });
  const application = await programService.requestProgramAssistance(req.user!.id, req.params.programId, message);
  res.status(201).json({ message: 'Votre demande a été transmise à l’agent SI-TCHA.', application });
}

export async function listAdminPrograms(_req: Request, res: Response) {
  res.json(await programService.listProgramsForAdmin());
}

export async function createAdminProgram(req: Request, res: Response) {
  if (!validProgramInput(req.body)) return res.status(400).json({ message: 'Nom, description, critères et date limite valide sont requis.' });
  if (new Date(`${req.body.dateLimite}T23:59:59.999Z`) < new Date()) return res.status(400).json({ message: 'La date limite doit être aujourd’hui ou ultérieure.' });
  if (req.body.statut && !programService.PROGRAM_STATUSES.includes(req.body.statut)) return res.status(400).json({ message: 'Statut de programme invalide.' });
  const program = await programService.createProgram(req.body);
  res.status(201).json({ message: 'Programme créé.', program });
}

export async function setAdminProgramStatus(req: Request, res: Response) {
  const statut = req.body?.statut;
  if (!programService.PROGRAM_STATUSES.includes(statut)) return res.status(400).json({ message: 'Statut de programme invalide.' });
  const program = await programService.updateProgramStatus(req.params.programId, statut);
  res.json({ message: 'Programme mis à jour.', program });
}

export async function listAdminApplications(_req: Request, res: Response) {
  res.json(await programService.listApplicationsForAdmin());
}

export async function updateAdminApplication(req: Request, res: Response) {
  const statut = req.body?.statut;
  if (!programService.APPLICATION_STATUSES.includes(statut)) return res.status(400).json({ message: 'Statut de dossier invalide.' });
  const noteAgent = typeof req.body?.noteAgent === 'string' ? req.body.noteAgent : undefined;
  if (noteAgent !== undefined && noteAgent.length > 1000) return res.status(400).json({ message: 'La note ne doit pas dépasser 1000 caractères.' });
  const application = await programService.updateApplicationByAdmin(req.params.applicationId, statut, noteAgent);
  res.json({ message: 'Dossier mis à jour.', application });
}
