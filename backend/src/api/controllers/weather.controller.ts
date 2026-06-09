import { Request, Response } from 'express';
import prisma from '../../lib/prisma';

// Dictionnaire de traduction pour les descriptions météo d'AgroMonitoring
const translateWeatherDescription = (desc: string): string => {
    const dictionary: Record<string, string> = {
        'clear sky': 'ciel dégagé',
        'few clouds': 'quelques nuages',
        'scattered clouds': 'nuages épars',
        'broken clouds': 'nuages fragmentés',
        'overcast clouds': 'couvert',
        'light rain': 'pluie légère',
        'moderate rain': 'pluie modérée',
        'heavy intensity rain': 'forte pluie',
        'very heavy rain': 'très forte pluie',
        'extreme rain': 'pluie extrême',
        'shower rain': 'averses de pluie',
        'thunderstorm': 'orage',
        'snow': 'neige',
        'mist': 'brume',
        'fog': 'brouillard'
    };
    return dictionary[desc.toLowerCase()] || desc;
};

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

        // 4. Récupérer les prévisions 8 jours stockées sur le GIC
        const gicData = await prisma.gIC.findUnique({
            where: { id: gicId },
            select: { previsionsMeteo: true }
        });

        // --- TRAITEMENT & TRADUCTION ---
        
        // Traduction de la météo actuelle
        const meteoActuelle = latestWeather ? {
            ...latestWeather,
            description: translateWeatherDescription(latestWeather.description)
        } : null;

        // Traduction du tableau des prévisions (8 jours)
        let previsions8Jours = [];
        if (gicData?.previsionsMeteo && Array.isArray(gicData.previsionsMeteo)) {
            previsions8Jours = gicData.previsionsMeteo.map((day: any) => {
                // AgroMonitoring structure souvent la météo dans un sous-tableau 'weather'
                if (day.weather && day.weather[0]) {
                    return {
                        ...day,
                        weather: [{
                            ...day.weather[0],
                            description: translateWeatherDescription(day.weather[0].description)
                        }]
                    };
                }
                return day;
            });
        }

        // Formatage de la réponse pour l'application mobile
       res.status(200).json({
          message: "Données du tableau de bord météo récupérées avec succès.",
          data: {
              meteo: meteoActuelle,
              sol: latestSoil,
              alertes: recentAlerts,
              previsions: previsions8Jours // Ton tableau de 8 jours traduits en français !
          }
        });

    } catch (error: any) {
        res.status(500).json({ 
            message: "Erreur lors de la récupération des données météo.", 
            error: error.message 
        });
    }
};