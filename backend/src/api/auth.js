import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
// ─── Config ─────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-me';
const JWT_EXPIRES_IN = '30d'; // 30 jours — les fermiers ne se connectent pas tous les jours
const SALT_ROUNDS = 10;
// ─── Helpers ────────────────────────────────────────────────────────────────
/** Normalise un numéro camerounais vers le format +237XXXXXXXXX */
function normalizePhone(raw) {
    const digits = raw.replace(/\D/g, '');
    // Accepter : 6XXXXXXXX (9 digits), 237XXXXXXXXX (12 digits), ou avec +
    if (digits.length === 9 && /^[62]/.test(digits)) {
        return `+237${digits}`;
    }
    if (digits.length === 12 && digits.startsWith('237')) {
        return `+${digits}`;
    }
    return null;
}
/** Valide un code PIN (4 à 6 chiffres) */
function isValidPin(pin) {
    return /^\d{4,6}$/.test(pin);
}
/** Génère un JWT pour un utilisateur */
function signToken(user) {
    return jwt.sign({ id: user.id, role: user.role, phone: user.phone }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
// ─── Register Buyer ─────────────────────────────────────────────────────────
export async function registerBuyer(req, res) {
    const { companyName, phone, pin, address } = req.body;
    // Validation
    if (!companyName?.trim() || !phone?.trim() || !pin) {
        return res.status(400).json({
            message: 'Nom d\'entreprise, téléphone et code PIN sont requis.',
        });
    }
    if (!isValidPin(pin)) {
        return res.status(400).json({
            message: 'Le code PIN doit contenir entre 4 et 6 chiffres.',
        });
    }
    const normalizedPhone = normalizePhone(phone.trim());
    if (!normalizedPhone) {
        return res.status(400).json({
            message: 'Numéro de téléphone camerounais invalide.',
        });
    }
    // Vérifier si le numéro est déjà pris
    const existing = await prisma.acheteur.findUnique({
        where: { contact: normalizedPhone },
    });
    if (existing) {
        return res.status(409).json({
            message: 'Ce numéro de téléphone est déjà associé à un compte acheteur.',
        });
    }
    // Hash du PIN et création du compte
    const pinHash = await bcrypt.hash(pin, SALT_ROUNDS);
    const acheteur = await prisma.acheteur.create({
        data: {
            nomEntreprise: companyName.trim(),
            contact: normalizedPhone,
            adresse: address?.trim() || '',
            preferencesAlertes: JSON.stringify({ productNames: [], bassins: [] }),
            pinHash,
            phoneVerified: false, // Sera true après vérification OTP (AfroSMS)
        },
    });
    const user = {
        id: acheteur.id.toString(),
        role: 'buyer',
        name: acheteur.nomEntreprise,
        phone: acheteur.contact,
        buyerId: acheteur.id.toString(),
        status: 'active',
    };
    const token = signToken(user);
    return res.status(201).json({ token, user });
}
// ─── Register Seller ────────────────────────────────────────────────────────
export async function registerSeller(req, res) {
    const { fullName, phone, pin, gicName } = req.body;
    // Validation
    if (!fullName?.trim() || !phone?.trim() || !pin || !gicName?.trim()) {
        return res.status(400).json({
            message: 'Nom complet, téléphone, code PIN et nom du GIC sont requis.',
        });
    }
    if (!isValidPin(pin)) {
        return res.status(400).json({
            message: 'Le code PIN doit contenir entre 4 et 6 chiffres.',
        });
    }
    const normalizedPhone = normalizePhone(phone.trim());
    if (!normalizedPhone) {
        return res.status(400).json({
            message: 'Numéro de téléphone camerounais invalide.',
        });
    }
    // Vérifier si le numéro est déjà pris
    const existingAgri = await prisma.agriculteur.findUnique({
        where: { contact: normalizedPhone },
    });
    if (existingAgri) {
        return res.status(409).json({
            message: 'Ce numéro de téléphone est déjà associé à un compte producteur.',
        });
    }
    // Trouver ou créer le GIC
    let gic = await prisma.gIC.findFirst({
        where: { nom: gicName.trim() },
    });
    if (!gic) {
        const defaultBassin = await prisma.bassinProduction.findFirst();
        if (!defaultBassin) {
            return res.status(500).json({
                message: 'Aucun bassin de production configuré dans la base.',
            });
        }
        gic = await prisma.gIC.create({
            data: {
                nom: gicName.trim(),
                identifiantREF: `GIC-${Date.now().toString(36).toUpperCase()}`,
                logoURL: '',
                reglementInterieur: '',
                activitesPrincipales: '',
                statutLegalisation: 'En cours',
                timestampMaj: new Date(),
                bassinProductionId: defaultBassin.id,
            },
        });
    }
    // Hash du PIN et création du compte
    const pinHash = await bcrypt.hash(pin, SALT_ROUNDS);
    const isFirstMember = (await prisma.agriculteur.count({ where: { gicId: gic.id } })) === 0;
    const agriculteur = await prisma.agriculteur.create({
        data: {
            nom: fullName.trim(),
            prenom: '',
            contact: normalizedPhone,
            estLeader: isFirstMember,
            pinHash,
            phoneVerified: false,
            timestampMaj: new Date(),
            gicId: gic.id,
        },
    });
    const user = {
        id: agriculteur.id.toString(),
        role: 'seller',
        name: agriculteur.nom,
        phone: agriculteur.contact,
        gicId: gic.id.toString(),
        gicRole: agriculteur.estLeader ? 'leader' : 'member',
        status: 'active',
    };
    const token = signToken(user);
    return res.status(201).json({ token, user });
}
// ─── Login ──────────────────────────────────────────────────────────────────
// Auto-détecte le rôle : cherche d'abord dans Acheteur, puis Agriculteur.
// Plus besoin de passer "role" depuis le frontend.
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Connecte un utilisateur
 *     description: Authentifie un utilisateur avec son numéro de téléphone et son code PIN. Le rôle est détecté automatiquement.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - pin
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "+237699112233"
 *               pin:
 *                 type: string
 *                 example: "1234"
 *     responses:
 *       200:
 *         description: Connexion réussie
 *       400:
 *         description: Requête invalide (numéro ou PIN manquant)
 *       401:
 *         description: Numéro ou PIN incorrect
 */
export async function login(req, res) {
    const { phone, pin } = req.body;
    if (!phone?.trim() || !pin) {
        return res.status(400).json({
            message: 'Numéro de téléphone et code PIN sont requis.',
        });
    }
    const normalizedPhone = normalizePhone(phone.trim());
    if (!normalizedPhone) {
        return res.status(400).json({
            message: 'Numéro de téléphone camerounais invalide.',
        });
    }
    // 1. Chercher dans Acheteur
    const acheteur = await prisma.acheteur.findUnique({
        where: { contact: normalizedPhone },
    });
    if (acheteur && acheteur.pinHash) {
        const pinValid = await bcrypt.compare(pin, acheteur.pinHash);
        if (!pinValid) {
            return res.status(401).json({ message: 'Numéro ou code PIN incorrect.' });
        }
        const user = {
            id: acheteur.id.toString(),
            role: 'buyer',
            name: acheteur.nomEntreprise,
            phone: acheteur.contact,
            buyerId: acheteur.id.toString(),
            status: 'active',
        };
        const token = signToken(user);
        return res.json({ token, user });
    }
    // 2. Chercher dans Agriculteur
    const agriculteur = await prisma.agriculteur.findUnique({
        where: { contact: normalizedPhone },
        include: { gic: true },
    });
    if (agriculteur && agriculteur.pinHash) {
        const pinValid = await bcrypt.compare(pin, agriculteur.pinHash);
        if (!pinValid) {
            return res.status(401).json({ message: 'Numéro ou code PIN incorrect.' });
        }
        const user = {
            id: agriculteur.id.toString(),
            role: 'seller',
            name: agriculteur.nom,
            phone: agriculteur.contact,
            gicId: agriculteur.gicId.toString(),
            gicRole: agriculteur.estLeader ? 'leader' : 'member',
            status: 'active',
        };
        const token = signToken(user);
        return res.json({ token, user });
    }
    // 3. Aucun compte trouvé
    return res.status(401).json({
        message: 'Aucun compte trouvé avec ce numéro. Veuillez vous inscrire.',
    });
}
// ─── Middleware Auth (JWT) ──────────────────────────────────────────────────
export async function requireAuth(req, res, next) {
    const header = req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    if (!token) {
        return res.status(401).json({ message: 'Token manquant.' });
    }
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        // Reconstruire le user depuis la base pour avoir les données à jour
        if (payload.role === 'buyer') {
            const acheteur = await prisma.acheteur.findUnique({
                where: { contact: payload.phone },
            });
            if (!acheteur) {
                return res.status(401).json({ message: 'Compte introuvable.' });
            }
            req.user = {
                id: acheteur.id.toString(),
                role: 'buyer',
                name: acheteur.nomEntreprise,
                phone: acheteur.contact,
                buyerId: acheteur.id.toString(),
                status: 'active',
            };
        }
        else {
            const agriculteur = await prisma.agriculteur.findUnique({
                where: { contact: payload.phone },
                include: { gic: true },
            });
            if (!agriculteur) {
                return res.status(401).json({ message: 'Compte introuvable.' });
            }
            req.user = {
                id: agriculteur.id.toString(),
                role: 'seller',
                name: agriculteur.nom,
                phone: agriculteur.contact,
                gicId: agriculteur.gicId.toString(),
                gicRole: agriculteur.estLeader ? 'leader' : 'member',
                status: 'active',
            };
        }
        next();
    }
    catch {
        return res.status(401).json({ message: 'Token invalide ou expiré.' });
    }
}
// ─── Me ─────────────────────────────────────────────────────────────────────
export function me(req, res) {
    return res.json({ user: req.user ?? null });
}
