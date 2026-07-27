import { Request, Response } from 'express';
import * as authService from '../../services/auth.service.js';
import jwt from 'jsonwebtoken';
import { AcheteurRegisterData, AgriculteurRegisterData, LoginData, VerifyAccountData } from '../../types/user.types.js';


// Contrôleur pour l'authentification et l'enregistrement des utilisateurs
//enregistrement d'un acheteur
export const registerAcheteur = async (req: Request, res: Response) => {
    const acheteurData: AcheteurRegisterData = req.body;
    await authService.registerAcheteur(acheteurData);
    res.status(201).json({ message: 'Compte créé. Veuillez vérifier votre téléphone pour le code de validation.' });
};

//enregistrement d'un agriculteur
export const registerAgriculteur = async (req: Request, res: Response) => {
    const agriculteurData: AgriculteurRegisterData = req.body;
    await authService.registerAgriculteur(agriculteurData);
    res.status(201).json({ message: 'Compte créé. Veuillez vérifier votre téléphone pour le code de validation.' });
};

//vérification d'un compte avec un code SMS
export const verifyAccount = async (req: Request, res: Response) => {
    const { contact, code }: VerifyAccountData = req.body;
    const result = await authService.verifyAccount(contact, code);
    res.status(200).json(result);
};

//connexion d'un utilisateur (acheteur ou agriculteur)
export const login = async (req: Request, res: Response) => {
    const { nom, contact }: LoginData = req.body;

    const { user, role } = await authService.login(nom, contact);

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        // Cette erreur est critique et doit être lancée pour être interceptée par le errorHandler
        throw new Error("JWT_SECRET n'est pas défini. Erreur de configuration du serveur.");
    }

    const token = jwt.sign({ id: user.id, role }, jwtSecret, { expiresIn: '7d' });

    res.status(200).json({
        message: 'Connexion réussie.',
        token,
        user: { ...user, role }
    });
};

//connexion d'un admin
export const adminLogin = async (req: Request, res: Response) => {
    const { nom, motDePasse } = req.body;

    const { user, role } = await authService.adminLogin(nom, motDePasse);

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        throw new Error("JWT_SECRET n'est pas défini. Erreur de configuration du serveur.");
    }

    const token = jwt.sign({ id: user.id, role }, jwtSecret, { expiresIn: '1d' });

    res.status(200).json({
        message: 'Connexion admin réussie.',
        token,
        user: { ...user, role }
    });
};


//déconnexion d'un utilisateur
export const logout = (req: Request, res: Response) => {
    // Pour une authentification JWT stateless, la déconnexion est gérée côté client
    // en supprimant le token.
    // On peut ajouter une logique de blacklist de token ici pour plus de sécurité.
    res.status(200).json({ message: 'Déconnexion réussie.' });
};