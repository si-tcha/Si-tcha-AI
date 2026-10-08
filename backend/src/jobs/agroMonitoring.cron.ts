import cron from 'node-cron';
import axios from 'axios';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { sendSms } from '../services/notification.service.js';
import {
  AGRO_API_BASE_URL,
  getAgroMonitoringApiKey,
  isValidGeoPoint,
  withoutAgroMonitoringApiKey,
  withAgroMonitoringApiKey,
} from '../services/agroMonitoring.service.js';
import { buildAgronomicRecommendations } from '../services/agronomicRecommendation.service.js';

// Au premier passage, couvrir les dernières semaines; les passages suivants reprennent avec un léger chevauchement.
const SATELLITE_LOOKBACK_SECONDS = 45 * 24 * 60 * 60;

interface AgroWeatherEntry {
  dt?: number;
  pop?: number;
  main?: { temp?: number; humidity?: number };
  rain?: Record<string, number>;
  wind?: { speed?: number };
  weather?: Array<{ description?: string }>;
}

interface AgroSoilResponse {
  t0?: number;
  t10?: number;
  moisture?: number;
}

interface AgroPolygonResponse {
  name?: string;
  area?: number;
  center?: number[];
  geo_json?: Prisma.InputJsonValue;
}

interface AgroImageEntry {
  dt?: number;
  type?: string;
  cl?: number;
  dc?: number;
  image?: { ndvi?: string; truecolor?: string };
  tile?: { ndvi?: string };
  stats?: { ndvi?: string };
  data?: { ndvi?: string };
}

interface AgroPolygon {
  id: string;
  nom: string;
  gicId: string;
  agroMonitoringPolygonId: string;
  latitude: number | null;
  longitude: number | null;
}

function requiredNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Donnée AgroMonitoring invalide: ${field}`);
  }
  return value;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function epochDate(value: unknown): Date | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const date = new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return `HTTP ${error.response?.status ?? 'injoignable'} AgroMonitoring`;
  }
  return error instanceof Error ? error.message : 'Erreur inconnue';
}

async function getPolygonCoordinates(parcel: AgroPolygon, apiKey: string): Promise<{ latitude: number; longitude: number }> {
  if (parcel.latitude !== null && parcel.longitude !== null
    && isValidGeoPoint(parcel.latitude, parcel.longitude)) {
    return { latitude: parcel.latitude, longitude: parcel.longitude };
  }

  // Météo et prévisions exigent lat/lon; les données du sol et l'imagerie restent indexées par polyid.
  const response = await axios.get<AgroPolygonResponse>(
    `${AGRO_API_BASE_URL}/polygons/${encodeURIComponent(parcel.agroMonitoringPolygonId)}`,
    { params: { appid: apiKey }, timeout: 15000 },
  );
  const [longitude, latitude] = response.data.center ?? [];
  if (!isValidGeoPoint(latitude, longitude)) {
    throw new Error('Le polygone AgroMonitoring ne fournit pas un centre géographique valide.');
  }

  await prisma.parcelle.update({
    where: { id: parcel.id },
    data: {
      latitude,
      longitude,
      surfaceHa: optionalNumber(response.data.area),
      geoJson: response.data.geo_json,
      localisation: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    },
  });
  return { latitude, longitude };
}

async function sendAlertToAssignedFarmers(
  alertId: string,
  parcel: Pick<AgroPolygon, 'id' | 'nom'>,
  messageFr: string,
  messageEn: string,
): Promise<void> {
  const assignments = await prisma.agriculteurParcelle.findMany({
    where: { parcelleId: parcel.id, agriculteur: { statut: 'APPROUVE' } },
    include: { agriculteur: { select: { id: true, contact: true, langue: true } } },
  });

  for (const { agriculteur } of assignments) {
    const content = agriculteur.langue === 'EN' ? messageEn : messageFr;
    // La contrainte alerte/agriculteur rend l'envoi idempotent; seuls les échecs sont retentés.
    const notification = await prisma.notificationSMS.upsert({
      where: {
        alerteMeteoId_agriculteurId: {
          alerteMeteoId: alertId,
          agriculteurId: agriculteur.id,
        },
      },
      create: {
        alerteMeteoId: alertId,
        agriculteurId: agriculteur.id,
        contenu: content,
        langue: agriculteur.langue,
      },
      update: {},
    });
    if (notification.statut === 'ENVOYE') continue;

    const sent = await sendSms({ to: agriculteur.contact, message: content });
    await prisma.notificationSMS.update({
      where: { id: notification.id },
      data: {
        statut: sent ? 'ENVOYE' : 'ECHEC',
        dateEnvoi: sent ? new Date() : null,
        erreur: sent ? null : 'Échec de transmission via le fournisseur SMS.',
      },
    });
  }
}

async function synchronizeWeather(parcel: AgroPolygon, apiKey: string): Promise<void> {
  const { latitude, longitude } = await getPolygonCoordinates(parcel, apiKey);
  // Les routes météo documentées prennent des coordonnées, contrairement à /soil qui prend polyid.
  const params = { lat: latitude, lon: longitude, appid: apiKey, units: 'metric' };
  const [weatherResponse, forecastResponse] = await Promise.all([
    axios.get<AgroWeatherEntry>(`${AGRO_API_BASE_URL}/weather`, { params, timeout: 15000 }),
    axios.get<AgroWeatherEntry[]>(`${AGRO_API_BASE_URL}/weather/forecast`, { params, timeout: 15000 }),
  ]);

  const weather = weatherResponse.data;
  const forecasts = Array.isArray(forecastResponse.data) ? forecastResponse.data : [];
  await prisma.donneesMeteo.create({
    data: {
      temperature: requiredNumber(weather.main?.temp, 'température actuelle'),
      humidite: requiredNumber(weather.main?.humidity, 'humidité actuelle'),
      // L'API fournit la pluie récente sur trois heures; le champ historique reste exprimé en mm.
      pluviometrie: optionalNumber(weather.rain?.['3h']) ?? 0,
      probabilitePluie: optionalNumber(forecasts[0]?.pop) ?? 0,
      vitesseVent: requiredNumber(weather.wind?.speed, 'vitesse du vent'),
      description: weather.weather?.[0]?.description ?? 'Indisponible',
      timestampMesure: epochDate(weather.dt) ?? new Date(),
      gicId: parcel.gicId,
      parcelleId: parcel.id,
    },
  });

  for (const forecast of forecasts) {
    const timestampPrevision = epochDate(forecast.dt);
    if (!timestampPrevision) continue;
    const values = {
      temperature: optionalNumber(forecast.main?.temp),
      humidite: optionalNumber(forecast.main?.humidity),
      pluviometrie: optionalNumber(forecast.rain?.['3h']) ?? 0,
      probabilitePluie: optionalNumber(forecast.pop),
      vitesseVent: optionalNumber(forecast.wind?.speed),
      description: forecast.weather?.[0]?.description ?? null,
      donneesBrutes: forecast as Prisma.InputJsonValue,
    };
    // Une synchronisation répétée met à jour le même créneau plutôt que d'empiler des doublons.
    await prisma.previsionMeteo.upsert({
      where: {
        parcelleId_timestampPrevision: { parcelleId: parcel.id, timestampPrevision },
      },
      create: { parcelleId: parcel.id, timestampPrevision, ...values },
      update: values,
    });
  }

}

async function synchronizeSoil(parcel: AgroPolygon, apiKey: string): Promise<void> {
  const response = await axios.get<AgroSoilResponse>(`${AGRO_API_BASE_URL}/soil`, {
    params: { polyid: parcel.agroMonitoringPolygonId, appid: apiKey },
    timeout: 15000,
  });
  const soil = response.data;
  await prisma.donneesSol.create({
    data: {
      // t0 et t10 sont en Kelvin dans l'API; l'application stocke et affiche des degrés Celsius.
      temperatureSurface: requiredNumber(soil.t0, 'température de surface') - 273.15,
      temperature10cm: requiredNumber(soil.t10, 'température à 10 cm') - 273.15,
      humidite: requiredNumber(soil.moisture, 'humidité du sol'),
      timestampMesure: new Date(),
      gicId: parcel.gicId,
      parcelleId: parcel.id,
    },
  });
}

function readNdviMean(stats: unknown): number | null {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return null;
  return optionalNumber((stats as Record<string, unknown>).mean);
}

async function synchronizeSatellite(parcel: AgroPolygon, apiKey: string): Promise<void> {
  const latest = await prisma.observationSatellite.findFirst({
    where: { parcelleId: parcel.id },
    orderBy: { dateObservation: 'desc' },
    select: { dateObservation: true },
  });
  const end = Math.floor(Date.now() / 1000);
  const start = latest
    ? Math.max(0, Math.floor(latest.dateObservation.getTime() / 1000) - 3600)
    : end - SATELLITE_LOOKBACK_SECONDS;

  // Le chevauchement d'une heure récupère les scènes publiées en retard; l'upsert élimine les répétitions.
  const response = await axios.get<AgroImageEntry[]>(`${AGRO_API_BASE_URL}/image/search`, {
    params: { start, end, polyid: parcel.agroMonitoringPolygonId, appid: apiKey },
    timeout: 20000,
  });
  const images = Array.isArray(response.data) ? response.data : [];
  images.sort((left, right) => (right.dt ?? 0) - (left.dt ?? 0));

  // Limiter chaque passage protège le cron d'une réponse historique trop volumineuse.
  for (const image of images.slice(0, 12)) {
    const dateObservation = epochDate(image.dt);
    const satellite = image.type?.trim();
    if (!dateObservation || !satellite || !image.image?.ndvi) continue;

    let statistics: unknown = null;
    if (image.stats?.ndvi) {
      try {
        // La recherche donne une URL distincte pour les statistiques zonales de l'indice NDVI.
        const statsUrl = withAgroMonitoringApiKey(image.stats.ndvi, apiKey);
        statistics = (await axios.get(statsUrl, { timeout: 15000 })).data;
      } catch (error) {
        console.warn(`Statistiques NDVI indisponibles pour ${parcel.nom}: ${errorMessage(error)}`);
      }
    }

    await prisma.observationSatellite.upsert({
      where: {
        parcelleId_dateObservation_satellite: {
          parcelleId: parcel.id,
          dateObservation,
          satellite,
        },
      },
      create: {
        parcelleId: parcel.id,
        dateObservation,
        satellite,
        couvertureNuageuse: optionalNumber(image.cl),
        ndviMoyen: readNdviMean(statistics),
        statistiques: statistics === null ? undefined : statistics as Prisma.InputJsonValue,
        imageNDVIUrl: withoutAgroMonitoringApiKey(image.image.ndvi),
        imageCouleurUrl: withoutAgroMonitoringApiKey(image.image.truecolor),
        tuileNDVIUrl: withoutAgroMonitoringApiKey(image.tile?.ndvi),
        geoTiffNDVIUrl: withoutAgroMonitoringApiKey(image.data?.ndvi),
      },
      update: {
        couvertureNuageuse: optionalNumber(image.cl),
        ndviMoyen: readNdviMean(statistics),
        statistiques: statistics === null ? undefined : statistics as Prisma.InputJsonValue,
        imageNDVIUrl: withoutAgroMonitoringApiKey(image.image.ndvi),
        imageCouleurUrl: withoutAgroMonitoringApiKey(image.image.truecolor),
        tuileNDVIUrl: withoutAgroMonitoringApiKey(image.tile?.ndvi),
        geoTiffNDVIUrl: withoutAgroMonitoringApiKey(image.data?.ndvi),
      },
    });
  }

  console.log(`Satellite: ${images.length} scène(s) trouvée(s) pour ${parcel.nom}.`);
}

async function getActiveParcels() {
  return prisma.parcelle.findMany({
    // Une parcelle sans polygonId ne peut pas être interrogée chez AgroMonitoring.
    where: { statut: 'ACTIVE', agroMonitoringPolygonId: { not: null } },
    select: {
      id: true,
      nom: true,
      gicId: true,
      agroMonitoringPolygonId: true,
      latitude: true,
      longitude: true,
    },
    orderBy: { dateCreation: 'asc' },
  });
}

async function generateRecommendationsAndSendUrgentAlerts(parcel: AgroPolygon): Promise<void> {
  const now = new Date();
  const [weather, soil, forecasts, observations, cycles] = await Promise.all([
    prisma.donneesMeteo.findFirst({ where: { parcelleId: parcel.id }, orderBy: { timestampMesure: 'desc' } }),
    prisma.donneesSol.findFirst({ where: { parcelleId: parcel.id }, orderBy: { timestampMesure: 'desc' } }),
    prisma.previsionMeteo.findMany({
      where: { parcelleId: parcel.id, timestampPrevision: { gte: now } },
      orderBy: { timestampPrevision: 'asc' },
      take: 24,
    }),
    prisma.observationSatellite.findMany({
      where: { parcelleId: parcel.id },
      orderBy: { dateObservation: 'desc' },
      take: 5,
    }),
    prisma.cycleCulture.findMany({
      where: { parcelleId: parcel.id, statut: 'EN_COURS' },
      orderBy: { dateCreation: 'desc' },
      take: 1,
      include: { etapes: { where: { statut: 'EN_COURS' }, orderBy: { ordre: 'asc' }, take: 1 } },
    }),
  ]);

  const activeCycle = cycles[0];
  const activeStage = activeCycle?.etapes[0];
  const recommendations = buildAgronomicRecommendations({
    parcelName: parcel.nom,
    language: 'FR',
    weather: weather ? {
      temperatureC: Number(weather.temperature),
      description: weather.description,
      measuredAt: weather.timestampMesure,
    } : null,
    soil: soil ? { moisture: Number(soil.humidite), measuredAt: soil.timestampMesure } : null,
    forecasts: forecasts.map((forecast) => ({
      timestamp: forecast.timestampPrevision,
      windSpeedMs: forecast.vitesseVent === null ? null : Number(forecast.vitesseVent),
      rainMm3h: forecast.pluviometrie === null ? null : Number(forecast.pluviometrie),
      rainProbability: forecast.probabilitePluie === null ? null : Number(forecast.probabilitePluie),
      description: forecast.description,
    })),
    observations: observations.map((observation) => ({
      date: observation.dateObservation,
      ndviMean: observation.ndviMoyen === null ? null : Number(observation.ndviMoyen),
      cloudCoveragePct: observation.couvertureNuageuse === null ? null : Number(observation.couvertureNuageuse),
    })),
    crop: activeCycle?.culture,
    cropPhase: activeStage?.phase,
    now,
  });

  for (const recommendation of recommendations) {
    if (recommendation.level !== 'URGENT' || !recommendation.observedAt
      || !recommendation.smsFr || !recommendation.smsEn) continue;

    const deduplicationKey = `${parcel.id}:${recommendation.code}:${recommendation.observedAt}`;
    const alert = await prisma.alerteMeteo.upsert({
      where: { cleDeduplication: deduplicationKey },
      create: {
        cleDeduplication: deduplicationKey,
        messageCourt: recommendation.message,
        messageCourtEn: recommendation.messageEn ?? recommendation.message,
        detailsTechniques: recommendation as unknown as Prisma.InputJsonValue,
        type: recommendation.code,
        niveau: 'URGENT',
        gicId: parcel.gicId,
        parcelleId: parcel.id,
      },
      update: {},
      select: { id: true },
    });

    await sendAlertToAssignedFarmers(alert.id, parcel, recommendation.smsFr, recommendation.smsEn);
  }
}

async function synchronizeParcels(options: { weather: boolean; satellite: boolean }): Promise<void> {
  const apiKey = getAgroMonitoringApiKey();
  const parcels = await getActiveParcels();

  for (const parcel of parcels) {
    if (!parcel.agroMonitoringPolygonId) continue;
    const target: AgroPolygon = {
      ...parcel,
      agroMonitoringPolygonId: parcel.agroMonitoringPolygonId,
      latitude: parcel.latitude === null ? null : Number(parcel.latitude),
      longitude: parcel.longitude === null ? null : Number(parcel.longitude),
    };

    if (options.weather) {
      // Isoler météo et sol permet de poursuivre l'un si l'autre endpoint est temporairement indisponible.
      try {
        await synchronizeWeather(target, apiKey);
      } catch (error) {
        console.error(`Météo non synchronisée pour ${parcel.nom}: ${errorMessage(error)}`);
      }
      try {
        await synchronizeSoil(target, apiKey);
      } catch (error) {
        console.error(`Sol non synchronisé pour ${parcel.nom}: ${errorMessage(error)}`);
      }
    }

    if (options.satellite) {
      try {
        await synchronizeSatellite(target, apiKey);
      } catch (error) {
        console.error(`Satellite non synchronisé pour ${parcel.nom}: ${errorMessage(error)}`);
      }
    }

    if (options.weather || options.satellite) {
      try {
        await generateRecommendationsAndSendUrgentAlerts(target);
      } catch (error) {
        console.error(`Conseils non générés pour ${parcel.nom}: ${errorMessage(error)}`);
      }
    }
  }

  console.log(`Synchronisation terminée: ${parcels.length} parcelle(s) active(s).`);
}

export const runAgroMonitoringSync = () => synchronizeParcels({ weather: true, satellite: true });

export const startAgroCronJobs = () => {
  let weatherRunning = false;
  let satelliteRunning = false;

  // Les deux verrous sont séparés: un passage météo ne bloque pas le passage satellite et inversement.
  const run = async (type: 'weather' | 'satellite' | 'initial') => {
    const isSatellite = type === 'satellite';
    if (isSatellite ? satelliteRunning : weatherRunning) return;
    if (type === 'initial' && (weatherRunning || satelliteRunning)) return;
    if (type !== 'satellite') weatherRunning = true;
    if (type !== 'weather') satelliteRunning = true;
    try {
      await synchronizeParcels({ weather: type !== 'satellite', satellite: type !== 'weather' });
    } catch (error) {
      console.error(`Erreur de synchronisation AgroMonitoring: ${errorMessage(error)}`);
    } finally {
      if (type !== 'satellite') weatherRunning = false;
      if (type !== 'weather') satelliteRunning = false;
    }
  };

  // Météo/sol toutes les 4 h; scènes satellite une fois par jour, les acquisitions n'étant pas temps réel.
  const weatherTask = cron.schedule('0 */4 * * *', () => run('weather'));
  const satelliteTask = cron.schedule('30 2 * * *', () => run('satellite'));
  // Ne pas attendre le prochain créneau pour alimenter une installation ou un redémarrage.
  void run('initial');

  return {
    stop: () => {
      weatherTask.stop();
      satelliteTask.stop();
    },
  };
};