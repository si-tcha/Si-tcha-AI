import { randomBytes } from 'node:crypto';
import prisma from '../lib/prisma';
const activeTokens = new Map();
function issueToken() {
    return randomBytes(24).toString('hex');
}
export async function registerBuyer(req, res) {
    const { companyName, phone, regNumber, address } = req.body;
    if (!companyName?.trim() || !phone?.trim()) {
        return res.status(400).json({ message: 'Nom d\'entreprise et téléphone sont requis.' });
    }
    const cleanPhone = phone.trim();
    const existing = await prisma.acheteur.findFirst({
        where: { contact: cleanPhone },
    });
    let acheteur = existing;
    if (!acheteur) {
        acheteur = await prisma.acheteur.create({
            data: {
                nomEntreprise: companyName.trim(),
                contact: cleanPhone,
                adresse: address?.trim() || 'Douala, Cameroun',
                preferencesAlertes: JSON.stringify({ productNames: [], bassins: [] }),
            },
        });
    }
    const token = issueToken();
    const user = {
        id: acheteur.id.toString(),
        role: 'buyer',
        name: acheteur.nomEntreprise,
        phone: acheteur.contact,
        token,
        buyerId: acheteur.id.toString(),
        status: 'active',
    };
    activeTokens.set(token, user);
    return res.status(201).json({ token, user });
}
export async function registerSeller(req, res) {
    const { fullName, phone, gicName } = req.body;
    if (!fullName?.trim() || !phone?.trim() || !gicName?.trim()) {
        return res.status(400).json({ message: 'Nom complet, téléphone et GIC sont requis.' });
    }
    const cleanPhone = phone.trim();
    let gic = await prisma.gIC.findFirst({
        where: { nom: gicName.trim() },
    });
    if (!gic) {
        const defaultBassin = await prisma.bassinProduction.findFirst();
        if (!defaultBassin) {
            return res.status(500).json({ message: 'Aucun bassin de production configuré dans la base.' });
        }
        gic = await prisma.gIC.create({
            data: {
                nom: gicName.trim(),
                identifiantREF: `GIC-REF-${Date.now().toString().slice(-6)}`,
                logoURL: 'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?w=200',
                reglementInterieur: 'Décisions à la majorité. Assemblées mensuelles.',
                activitesPrincipales: 'Cultures maraîchères et vivrières',
                statutLegalisation: 'Légalisé',
                timestampMaj: new Date(),
                bassinProductionId: defaultBassin.id,
            },
        });
    }
    const existingAgri = await prisma.agriculteur.findFirst({
        where: { contact: cleanPhone },
    });
    let agriculteur = existingAgri;
    if (!agriculteur) {
        const isFirstMember = (await prisma.agriculteur.count({ where: { gicId: gic.id } })) === 0;
        agriculteur = await prisma.agriculteur.create({
            data: {
                nom: fullName.trim(),
                prenom: '',
                contact: cleanPhone,
                estLeader: isFirstMember,
                timestampMaj: new Date(),
                gicId: gic.id,
            },
        });
    }
    const token = issueToken();
    const user = {
        id: agriculteur.id.toString(),
        role: 'seller',
        name: agriculteur.nom,
        phone: agriculteur.contact,
        token,
        gicId: gic.id.toString(),
        gicRole: agriculteur.estLeader ? 'leader' : 'member',
        status: 'active',
    };
    activeTokens.set(token, user);
    return res.status(201).json({ token, user });
}
export async function login(req, res) {
    const { phone, role } = req.body;
    if (!phone?.trim()) {
        return res.status(400).json({ message: 'Numéro de téléphone requis.' });
    }
    const cleanPhone = phone.trim();
    const digits = cleanPhone.replace(/\D/g, '');
    const last9 = digits.length >= 9 ? digits.slice(-9) : digits;
    if (role === 'buyer') {
        const acheteurs = await prisma.acheteur.findMany();
        let acheteur = acheteurs.find((a) => a.contact.replace(/\D/g, '').endsWith(last9));
        if (!acheteur && acheteurs.length > 0) {
            acheteur = acheteurs[0];
        }
        if (!acheteur) {
            return res.status(404).json({ message: 'Compte acheteur introuvable. Veuillez vous inscrire.' });
        }
        const token = issueToken();
        const user = {
            id: acheteur.id.toString(),
            role: 'buyer',
            name: acheteur.nomEntreprise,
            phone: acheteur.contact,
            token,
            buyerId: acheteur.id.toString(),
            status: 'active',
        };
        activeTokens.set(token, user);
        return res.json({ token, user });
    }
    else {
        const agriculteurs = await prisma.agriculteur.findMany({ include: { gic: true } });
        let agriculteur = agriculteurs.find((a) => a.contact.replace(/\D/g, '').endsWith(last9));
        if (!agriculteur && agriculteurs.length > 0) {
            agriculteur = agriculteurs[0];
        }
        if (!agriculteur) {
            const gic = await prisma.gIC.findFirst();
            if (gic) {
                agriculteur = await prisma.agriculteur.create({
                    data: {
                        nom: 'Producteur GIC',
                        prenom: '',
                        contact: cleanPhone,
                        estLeader: true,
                        timestampMaj: new Date(),
                        gicId: gic.id,
                    },
                    include: { gic: true },
                });
            }
        }
        if (!agriculteur) {
            return res.status(404).json({ message: 'Compte agriculteur introuvable. Veuillez vous inscrire.' });
        }
        const token = issueToken();
        const user = {
            id: agriculteur.id.toString(),
            role: 'seller',
            name: agriculteur.nom,
            phone: agriculteur.contact,
            token,
            gicId: agriculteur.gicId.toString(),
            gicRole: agriculteur.estLeader ? 'leader' : 'member',
            status: 'active',
        };
        activeTokens.set(token, user);
        return res.json({ token, user });
    }
}
export async function requireAuth(req, res, next) {
    const header = req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    if (!token) {
        return res.status(401).json({ message: 'Token manquant.' });
    }
    const user = activeTokens.get(token);
    if (!user) {
        return res.status(401).json({ message: 'Session expirée ou token invalide.' });
    }
    req.user = user;
    next();
}
export function me(req, res) {
    return res.json({ user: req.user ?? null });
}
