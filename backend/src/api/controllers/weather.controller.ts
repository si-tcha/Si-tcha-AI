import { Request, Response } from 'express';
import prisma from '../../lib/prisma';

export const getWeatherDashboard = async (req: Request, res: Response) => {
    try {
        // Le middleware 'protect' a déjà injecté 'user' dans la requête
        const user = (req as any).user;

        if (user.role !== 'AGRICULTEUR') {
            return res.status(403).json({ message: "Accès réservé aux agriculteurs." });
        }

        const gicId = user.gicId;

        // 1. Récupérer la dernière mesure météo
        const latestWeather = await prisma.donneesMeteo.findFirst({
            where: { gicId },
            orderBy: { timestampMesure: 'desc' }
        });

        // 2. Récupérer la dernière mesure du sol
        const latestSoil = await prisma.donneesSol.findFirst({
            where: { gicId },
            orderBy: { timestampMesure: 'desc' }
        });

        // 3. Récupérer les alertes des dernières 24 heures
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentAlerts = await prisma.alerteMeteo.findMany({
            where: {
                gicId,
                timestampCreation: { gte: twentyFourHoursAgo }
            },
            orderBy: { timestampCreation: 'desc' }
        });

        // Formatage de la réponse pour l'application mobile
        res.status(200).json({
            message: "Données du tableau de bord météo récupérées avec succès.",
            data: {
                meteo: latestWeather,
                sol: latestSoil,
                alertes: recentAlerts
            }
        });

    } catch (error: any) {
        res.status(500).json({ 
            message: "Erreur lors de la récupération des données météo.", 
            error: error.message 
        });
    }
};