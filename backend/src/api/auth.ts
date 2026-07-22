import { NextFunction, Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { UserAccount, UserRole } from '../domain/types';
import { createId, normalizePhone, readStore, updateStore } from '../lib/store';

export interface AuthRequest extends Request {
  user?: UserAccount;
}

function issueToken() {
  return randomBytes(24).toString('hex');
}

function publicUser(user: UserAccount) {
  const { token, ...safe } = user;
  return safe;
}

export async function registerBuyer(req: Request, res: Response) {
  const { companyName, phone, regNumber, address } = req.body as {
    companyName?: string;
    phone?: string;
    regNumber?: string;
    address?: string;
  };

  if (!companyName?.trim() || !phone?.trim() || !regNumber?.trim()) {
    return res.status(400).json({ message: 'companyName, phone et regNumber sont requis.' });
  }

  const normalizedPhone = normalizePhone(phone);
  const data = await updateStore((draft) => {
    const existing = draft.users.find((user) => user.phone === normalizedPhone);
    if (existing) return draft;

    const buyerId = createId('buyer');
    draft.buyers.push({
      id: buyerId,
      companyName: companyName.trim(),
      phone: normalizedPhone,
      regNumber: regNumber.trim(),
      address,
      alertPreferences: { productNames: [], bassins: [] },
      createdAt: new Date().toISOString(),
    });
    draft.users.push({
      id: createId('user'),
      role: 'buyer',
      name: companyName.trim(),
      phone: normalizedPhone,
      token: issueToken(),
      createdAt: new Date().toISOString(),
      buyerId,
      status: 'active',
    });
    return draft;
  });

  const user = data.users.find((item) => item.phone === normalizedPhone && item.role === 'buyer');
  return res.status(201).json({ token: user?.token, user: user ? publicUser(user) : null });
}

export async function registerSeller(req: Request, res: Response) {
  const { fullName, phone, gicName } = req.body as {
    fullName?: string;
    phone?: string;
    gicName?: string;
  };

  if (!fullName?.trim() || !phone?.trim() || !gicName?.trim()) {
    return res.status(400).json({ message: 'fullName, phone et gicName sont requis.' });
  }

  const normalizedPhone = normalizePhone(phone);
  const data = await updateStore((draft) => {
    const existing = draft.users.find((user) => user.phone === normalizedPhone);
    if (existing) return draft;

    let gic = draft.gics.find((item) => item.name.toLowerCase() === gicName.trim().toLowerCase());
    if (!gic) {
      gic = {
        id: createId('gic'),
        name: gicName.trim(),
        identifiantREF: `GIC-NEW-${Date.now().toString().slice(-6)}`,
        bassin: 'À compléter',
        statutLegalisation: 'En cours',
        activitesPrincipales: 'À compléter',
        leaderName: fullName.trim(),
        reglementInterieur: 'À compléter',
        surfaceHa: 0,
        updatedAt: new Date().toISOString(),
      };
      draft.gics.push(gic);
    }

    const isFirstMember = !draft.members.some((member) => member.gicId === gic.id);
    draft.members.push({
      id: createId('member'),
      gicId: gic.id,
      name: fullName.trim(),
      phone: normalizedPhone,
      isLeader: isFirstMember,
      updatedAt: new Date().toISOString(),
    });
    draft.users.push({
      id: createId('user'),
      role: 'seller',
      name: fullName.trim(),
      phone: normalizedPhone,
      token: issueToken(),
      createdAt: new Date().toISOString(),
      gicId: gic.id,
      gicRole: isFirstMember ? 'leader' : 'member',
      status: isFirstMember ? 'active' : 'pending',
    });
    return draft;
  });

  const user = data.users.find((item) => item.phone === normalizedPhone && item.role === 'seller');
  return res.status(201).json({ token: user?.token, user: user ? publicUser(user) : null });
}

export async function login(req: Request, res: Response) {
  const { phone, role } = req.body as { phone?: string; role?: UserRole };
  if (!phone?.trim()) {
    return res.status(400).json({ message: 'phone est requis.' });
  }

  const data = await readStore();
  const normalizedPhone = normalizePhone(phone);
  const user = data.users.find((item) => item.phone === normalizedPhone && (!role || item.role === role));

  if (!user) {
    return res.status(404).json({ message: 'Compte introuvable.' });
  }

  return res.json({ token: user.token, user: publicUser(user) });
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

  if (!token) {
    return res.status(401).json({ message: 'Token manquant.' });
  }

  const data = await readStore();
  const user = data.users.find((item) => item.token === token);
  if (!user) {
    return res.status(401).json({ message: 'Token invalide.' });
  }

  req.user = user;
  next();
}

export function me(req: AuthRequest, res: Response) {
  return res.json({ user: req.user ? publicUser(req.user) : null });
}
