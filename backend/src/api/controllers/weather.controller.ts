import { Request, Response } from 'express';
import prisma from '../../lib/prisma.js';
import { buildAgronomicRecommendations } from '../../services/agronomicRecommendation.service.js';

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

function finiteNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value && typeof value === 'object' && 'toString' in value) {
        const parsed = Number((value as { toString(): string }).toString());
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

/**
 * AgroMonitoring stores forecast payloads as JSON on the GIC. Keep this
 * adapter deliberately defensive: an unknown provider field simply produces
 * no recommendation instead of an invented weather warning.
 */
function normaliseForecasts(value: unknown) {
    if (!Array.isArray(value)) return [];

    return value.flatMap((day) => {
        if (!day || typeof day !== 'object') return [];
        const payload = day as Record<string, unknown>;
        const unixSeconds = finiteNumber(payload.dt);
        const timestamp = typeof payload.timestamp === 'string'
            ? payload.timestamp
            : typeof payload.dt_txt === 'string'
                ? payload.dt_txt
                : unixSeconds === null
                    ? null
                    : new Date(unixSeconds * 1000).toISOString();
        if (!timestamp || Number.isNaN(new Date(timestamp).getTime())) return [];

        const wind = payload.wind && typeof payload.wind === 'object'
            ? payload.wind as Record<string, unknown>
            : {};
        const rain = payload.rain && typeof payload.rain === 'object'
            ? payload.rain as Record<string, unknown>
            : {};
        const weather = Array.isArray(payload.weather) && payload.weather[0] && typeof payload.weather[0] === 'object'
            ? payload.weather[0] as Record<string, unknown>
            : {};

        return [{
            timestamp,
            windSpeedMs: finiteNumber(wind.speed),
            rainMm3h: finiteNumber(rain['3h'] ?? rain['1h']),
            rainProbability: finiteNumber(payload.pop),
            description: typeof weather.description === 'string' ? weather.description : null,
        }];
    });
}

export const getWeatherDashboard = async (req: Request, res: Response) => {
    try {
        const user = req.user;
        if (!user || user.role !== 'seller') {
            return res.status(403).json({ message: "Accès réservé aux producteurs." });
        }

        if (!user.gicId) {
            return res.status(400).json({ message: "Impossible de déterminer le GIC de l'utilisateur." });
        }

        const gicId = BigInt(user.gicId);

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
            select: { nom: true, previsionsMeteo: true }
        });

        // --- TRAITEMENT & TRADUCTION ---
        const meteoActuelle = latestWeather ? {
            ...latestWeather,
            description: latestWeather.description ? translateWeatherDescription(latestWeather.description) : null
        } : null;

        let previsions8Jours = [];
        if (gicData?.previsionsMeteo && Array.isArray(gicData.previsionsMeteo)) {
            previsions8Jours = gicData.previsionsMeteo.map((day: any) => {
                if (day.weather && day.weather[0] && day.weather[0].description) {
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

        const recommendations = buildAgronomicRecommendations({
            // The current mobile product is GIC-scoped, not GPS-parcel scoped.
            // Naming the GIC makes that scope explicit until a separate,
            // validated parcel/GPS product contract is adopted.
            parcelName: gicData?.nom ?? 'votre zone de production',
            language: 'FR',
            weather: latestWeather ? {
                temperatureC: finiteNumber(latestWeather.temperature),
                description: latestWeather.description,
                measuredAt: latestWeather.timestampMesure,
            } : null,
            soil: latestSoil ? {
                moisture: finiteNumber(latestSoil.humidite),
                measuredAt: latestSoil.timestampMesure,
            } : null,
            forecasts: normaliseForecasts(gicData?.previsionsMeteo),
        });

        res.status(200).json({
            message: "Données du tableau de bord météo récupérées avec succès.",
            data: {
                meteo: meteoActuelle,
                sol: latestSoil,
                alertes: recentAlerts,
                previsions: previsions8Jours,
                recommandations: recommendations,
            }
        });

    } catch (error: any) {
        res.status(500).json({
            message: "Erreur lors de la récupération des données météo.",
            error: error.message
        });
    }
};
