import axios from 'axios';
import type { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import prisma from '../../lib/prisma.js';
import {
  AgroMonitoringPolygonGeoJson,
  createAgroMonitoringPolygon,
  deleteAgroMonitoringPolygon,
  getAgroMonitoringApiKey,
  isValidGeoPoint,
  withAgroMonitoringApiKey,
} from '../../services/agroMonitoring.service.js';
import { buildAgronomicRecommendations } from '../../services/agronomicRecommendation.service.js';

const weatherDescriptions: Record<string, { fr: string; en: string }> = {
  'clear sky': { fr: 'ciel dégagé', en: 'clear sky' },
  'few clouds': { fr: 'quelques nuages', en: 'few clouds' },
  'scattered clouds': { fr: 'nuages épars', en: 'scattered clouds' },
  'broken clouds': { fr: 'nuages fragmentés', en: 'broken clouds' },
  'overcast clouds': { fr: 'couvert', en: 'overcast clouds' },
  'light rain': { fr: 'pluie légère', en: 'light rain' },
  'moderate rain': { fr: 'pluie modérée', en: 'moderate rain' },
  'heavy intensity rain': { fr: 'forte pluie', en: 'heavy rain' },
  'very heavy rain': { fr: 'très forte pluie', en: 'very heavy rain' },
  'shower rain': { fr: 'averses', en: 'rain showers' },
  thunderstorm: { fr: 'orage', en: 'thunderstorm' },
  snow: { fr: 'neige', en: 'snow' },
  mist: { fr: 'brume', en: 'mist' },
  fog: { fr: 'brouillard', en: 'fog' },
};

function numberOrNull(value: { toString(): string } | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function localizedWeather(description: string | null | undefined, language: string): string | null {
  if (!description) return null;
  const values = weatherDescriptions[description.toLowerCase()];
  return values ? (language === 'EN' ? values.en : values.fr) : description;
}

function ensureFarmer(req: Request, res: Response): string | null {
  if (req.user?.role !== 'AGRICULTEUR') {
    res.status(403).json({ message: 'Accès réservé aux agriculteurs.' });
    return null;
  }
  return req.user.id;
}

interface GpsPoint {
  latitude: number;
  longitude: number;
}

function buildParcelGeoJson(value: unknown): { geoJson?: AgroMonitoringPolygonGeoJson; error?: string } {
  if (!Array.isArray(value) || value.length < 3 || value.length > 500) {
    return { error: 'Fournissez entre 3 et 500 points GPS pour délimiter la parcelle.' };
  }

  const points: GpsPoint[] = [];
  for (const point of value) {
    if (!point || typeof point !== 'object') return { error: 'Chaque point doit contenir latitude et longitude.' };
    const { latitude, longitude } = point as Record<string, unknown>;
    if (typeof latitude !== 'number' || typeof longitude !== 'number'
      || !isValidGeoPoint(latitude, longitude)) {
      return { error: 'Coordonnées GPS invalides. Latitude: -90 à 90, longitude: -180 à 180.' };
    }

    const current = { latitude, longitude };
    const previous = points[points.length - 1];
    if (!previous || previous.latitude !== latitude || previous.longitude !== longitude) {
      points.push(current);
    }
  }

  // Accepter un anneau déjà fermé depuis le mobile, puis le reconstruire une seule fois.
  if (points.length > 1
    && points[0].latitude === points[points.length - 1].latitude
    && points[0].longitude === points[points.length - 1].longitude) {
    points.pop();
  }
  if (points.length < 3) return { error: 'Le contour doit contenir au moins trois sommets distincts.' };

  const ring = points.map(({ latitude, longitude }) => [longitude, latitude]);
  ring.push([...ring[0]]);

  return {
    geoJson: {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [ring] },
    },
  };
}

export const createAssignedParcel = async (req: Request, res: Response) => {
  const farmerId = ensureFarmer(req, res);
  if (!farmerId) return;

  const farmer = await prisma.agriculteur.findUnique({
    where: { id: farmerId },
    select: { id: true, gicId: true, statut: true },
  });
  if (!farmer || farmer.statut !== 'APPROUVE') {
    return res.status(403).json({ message: 'Seuls les agriculteurs approuvés peuvent créer une parcelle.' });
  }

  const { name, zone, points } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
    return res.status(400).json({ message: 'Le nom de la parcelle est requis (120 caractères maximum).' });
  }
  if (zone !== undefined && (typeof zone !== 'string' || zone.trim().length > 120)) {
    return res.status(400).json({ message: 'La zone doit être un texte de 120 caractères maximum.' });
  }

  const polygon = buildParcelGeoJson(points);
  if (!polygon.geoJson) return res.status(400).json({ message: polygon.error });

  let providerPolygon;
  try {
    providerPolygon = await createAgroMonitoringPolygon(name.trim(), polygon.geoJson);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 422) {
      return res.status(422).json({
        message: 'AgroMonitoring refuse ce contour. Vérifiez les croisements et une surface entre 1 et 3000 hectares.',
      });
    }
    console.error('Création du polygone AgroMonitoring impossible:', axios.isAxiosError(error)
      ? `HTTP ${error.response?.status ?? 'injoignable'}`
      : 'erreur inattendue');
    return res.status(502).json({ message: 'Le service AgroMonitoring n’a pas pu créer la parcelle.' });
  }

  if (!providerPolygon.id) {
    return res.status(502).json({ message: 'AgroMonitoring n’a pas retourné d’identifiant pour le polygone.' });
  }

  const [longitude, latitude] = providerPolygon.center ?? [];
  if (!isValidGeoPoint(latitude, longitude)) {
    try {
      await deleteAgroMonitoringPolygon(providerPolygon.id);
    } catch {
      console.error(`Polygone AgroMonitoring ${providerPolygon.id} à supprimer manuellement: centre invalide.`);
    }
    return res.status(502).json({ message: 'AgroMonitoring a retourné un centre GPS invalide.' });
  }

  try {
    const parcel = await prisma.$transaction(async (transaction) => {
      const createdParcel = await transaction.parcelle.create({
        data: {
          nom: name.trim(),
          zone: typeof zone === 'string' && zone.trim() ? zone.trim() : null,
          localisation: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
          surfaceHa: typeof providerPolygon.area === 'number' ? providerPolygon.area : null,
          latitude,
          longitude,
          geoJson: (providerPolygon.geo_json ?? polygon.geoJson) as unknown as Prisma.InputJsonValue,
          agroMonitoringPolygonId: providerPolygon.id,
          gicId: farmer.gicId,
        },
      });

      await transaction.agriculteurParcelle.create({
        data: {
          agriculteurId: farmer.id,
          parcelleId: createdParcel.id,
          gicId: farmer.gicId,
          fonction: 'Créateur',
        },
      });
      return createdParcel;
    });

    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(201).json({
      message: 'Parcelle créée et enregistrée auprès d’AgroMonitoring.',
      parcel: {
        id: parcel.id,
        name: parcel.nom,
        zone: parcel.zone,
        areaHa: numberOrNull(parcel.surfaceHa),
        coordinates: { latitude: numberOrNull(parcel.latitude), longitude: numberOrNull(parcel.longitude) },
        agroMonitoringPolygonId: parcel.agroMonitoringPolygonId,
        status: parcel.statut,
      },
    });
  } catch (error) {
    try {
      await deleteAgroMonitoringPolygon(providerPolygon.id);
    } catch {
      console.error(`Polygone AgroMonitoring ${providerPolygon.id} à supprimer manuellement après échec BD.`);
    }
    throw error;
  }
};

const parcelDashboardInclude = {
  gic: {
    select: {
      nom: true,
      agronomeInterne: { select: { nom: true, specialite: true } },
    },
  },
  cyclesCulture: {
    where: { statut: 'EN_COURS' as const },
    orderBy: { dateCreation: 'desc' as const },
    take: 1,
    include: { etapes: { orderBy: { ordre: 'asc' as const } } },
  },
  donneesMeteo: { orderBy: { timestampMesure: 'desc' as const }, take: 1 },
  donneesSol: { orderBy: { timestampMesure: 'desc' as const }, take: 1 },
  previsionsMeteo: { where: { timestampPrevision: { gte: new Date() } }, orderBy: { timestampPrevision: 'asc' as const }, take: 24 },
  observationsSatellite: { orderBy: { dateObservation: 'desc' as const }, take: 5 },
  alertesMeteo: { orderBy: { timestampCreation: 'desc' as const }, take: 10 },
};

// Ne renvoyer que les derniers relevés utiles au tableau mobile, pas les historiques complets.
function serializeParcel(parcel: any, language: string) {
  const weather = parcel.donneesMeteo[0] ?? null;
  const soil = parcel.donneesSol[0] ?? null;
  const observations = parcel.observationsSatellite;
  const observation = observations[0] ?? null;
  const cycle = parcel.cyclesCulture[0] ?? null;
  const activeStage = cycle?.etapes.find((stage: any) => stage.statut === 'EN_COURS');
  const recommendations = buildAgronomicRecommendations({
    parcelName: parcel.nom,
    language: language === 'EN' ? 'EN' : 'FR',
    weather: weather ? {
      temperatureC: numberOrNull(weather.temperature),
      description: weather.description,
      measuredAt: weather.timestampMesure,
    } : null,
    soil: soil ? {
      moisture: numberOrNull(soil.humidite),
      measuredAt: soil.timestampMesure,
    } : null,
    forecasts: parcel.previsionsMeteo.map((forecast: any) => ({
      timestamp: forecast.timestampPrevision,
      windSpeedMs: numberOrNull(forecast.vitesseVent),
      rainMm3h: numberOrNull(forecast.pluviometrie),
      rainProbability: numberOrNull(forecast.probabilitePluie),
      description: forecast.description,
    })),
    observations: observations.map((item: any) => ({
      date: item.dateObservation,
      ndviMean: numberOrNull(item.ndviMoyen),
      cloudCoveragePct: numberOrNull(item.couvertureNuageuse),
    })),
    crop: cycle?.culture,
    cropPhase: activeStage?.phase,
  });

  return {
    id: parcel.id,
    name: parcel.nom,
    zone: parcel.zone,
    location: parcel.localisation,
    coordinates: {
      latitude: numberOrNull(parcel.latitude),
      longitude: numberOrNull(parcel.longitude),
    },
    areaHa: numberOrNull(parcel.surfaceHa),
    status: parcel.statut,
    updatedAt: parcel.dateMaj,
    gic: { name: parcel.gic.nom },
    agronomist: parcel.gic.agronomeInterne,
    weather: weather ? {
      temperatureC: numberOrNull(weather.temperature),
      humidityPct: numberOrNull(weather.humidite),
      rainMm3h: numberOrNull(weather.pluviometrie),
      rainProbability: numberOrNull(weather.probabilitePluie),
      windSpeedMs: numberOrNull(weather.vitesseVent),
      description: localizedWeather(weather.description, language),
      measuredAt: weather.timestampMesure,
    } : null,
    soil: soil ? {
      surfaceTemperatureC: numberOrNull(soil.temperatureSurface),
      temperature10cmC: numberOrNull(soil.temperature10cm),
      moisture: numberOrNull(soil.humidite),
      measuredAt: soil.timestampMesure,
    } : null,
    forecasts: parcel.previsionsMeteo.map((forecast: any) => ({
      temperatureC: numberOrNull(forecast.temperature),
      humidityPct: numberOrNull(forecast.humidite),
      rainMm3h: numberOrNull(forecast.pluviometrie),
      rainProbability: numberOrNull(forecast.probabilitePluie),
      windSpeedMs: numberOrNull(forecast.vitesseVent),
      description: localizedWeather(forecast.description, language),
      timestamp: forecast.timestampPrevision,
    })),
    satellite: observation ? {
      id: observation.id,
      date: observation.dateObservation,
      source: observation.satellite,
      cloudCoveragePct: numberOrNull(observation.couvertureNuageuse),
      ndviMean: numberOrNull(observation.ndviMoyen),
      statistics: observation.statistiques,
      imageNDVIUrl: `/api/parcels/${encodeURIComponent(parcel.id)}/satellite/${encodeURIComponent(observation.id)}/image?product=ndvi`,
      imageTrueColorUrl: `/api/parcels/${encodeURIComponent(parcel.id)}/satellite/${encodeURIComponent(observation.id)}/image?product=truecolor`,
      updatedAt: observation.dateReception,
    } : null,
    cropCycle: cycle ? {
      id: cycle.id,
      crop: cycle.culture,
      variety: cycle.variete,
      areaHa: numberOrNull(cycle.surfaceHa),
      sowingDate: cycle.dateSemis,
      startDate: cycle.dateDebut,
      endDate: cycle.dateFin,
      stages: cycle.etapes,
    } : null,
    recommendations,
    alerts: parcel.alertesMeteo.map((alert: any) => ({
      id: alert.id,
      type: alert.type,
      level: alert.niveau,
      message: language === 'EN' ? alert.messageCourtEn ?? alert.messageCourt : alert.messageCourt,
      createdAt: alert.timestampCreation,
    })),
  };
}

export const listAssignedParcels = async (req: Request, res: Response) => {
  const farmerId = ensureFarmer(req, res);
  if (!farmerId) return;

  const farmer = await prisma.agriculteur.findUnique({
    where: { id: farmerId },
    select: { langue: true },
  });
  if (!farmer) return res.status(404).json({ message: 'Profil agriculteur introuvable.' });

  const assignments = await prisma.agriculteurParcelle.findMany({
    // L'affectation est le périmètre d'accès; deux membres du même GIC peuvent voir la même parcelle.
    where: { agriculteurId: farmerId, parcelle: { statut: 'ACTIVE' } },
    include: { parcelle: { include: parcelDashboardInclude } },
    orderBy: { parcelle: { nom: 'asc' } },
  });

  res.setHeader('Cache-Control', 'private, no-store');
  return res.json({ parcels: assignments.map(({ parcelle }) => serializeParcel(parcelle, farmer.langue)) });
};

async function findAssignedParcel(parcelId: string, farmerId: string) {
  return prisma.parcelle.findFirst({
    where: {
      id: parcelId,
      statut: 'ACTIVE',
      agriculteurs: { some: { agriculteurId: farmerId } },
    },
    include: parcelDashboardInclude,
  });
}

export const getAssignedParcel = async (req: Request, res: Response) => {
  const farmerId = ensureFarmer(req, res);
  if (!farmerId) return;
  const parcel = await findAssignedParcel(req.params.parcelId, farmerId);
  if (!parcel) return res.status(404).json({ message: 'Parcelle introuvable ou non affectée à votre compte.' });

  const farmer = await prisma.agriculteur.findUnique({ where: { id: farmerId }, select: { langue: true } });
  if (!farmer) return res.status(404).json({ message: 'Profil agriculteur introuvable.' });
  res.setHeader('Cache-Control', 'private, no-store');
  return res.json({ parcel: serializeParcel(parcel, farmer.langue) });
};

export const streamAssignedSatelliteImage = async (req: Request, res: Response) => {
  const farmerId = ensureFarmer(req, res);
  if (!farmerId) return;
  const product = req.query.product;
  if (product !== 'ndvi' && product !== 'truecolor') {
    return res.status(400).json({ message: 'Produit satellite non pris en charge.' });
  }

  const parcel = await prisma.parcelle.findFirst({
    where: {
      id: req.params.parcelId,
      statut: 'ACTIVE',
      agriculteurs: { some: { agriculteurId: farmerId } },
    },
    select: { id: true },
  });
  if (!parcel) return res.status(404).json({ message: 'Parcelle introuvable ou non affectée à votre compte.' });

  const observation = await prisma.observationSatellite.findFirst({
    // Vérifier aussi que l'observation appartient à cette parcelle évite l'accès à une image d'un tiers.
    where: { id: req.params.observationId, parcelleId: parcel.id },
    select: { imageNDVIUrl: true, imageCouleurUrl: true },
  });
  if (!observation) return res.status(404).json({ message: 'Image satellite introuvable.' });

  const imageUrl = product === 'ndvi' ? observation.imageNDVIUrl : observation.imageCouleurUrl;
  if (!imageUrl) return res.status(404).json({ message: 'Cette image n’est pas disponible.' });

  const apiKey = getAgroMonitoringApiKey();
  // Le proxy ajoute la clé côté serveur; le mobile ne la reçoit jamais, même dans l'URL image.
  const imageResponse = await axios.get(withAgroMonitoringApiKey(imageUrl, apiKey), {
    responseType: 'stream',
    timeout: 20000,
  });
  const contentType = imageResponse.headers['content-type'];
  if (typeof contentType !== 'string' || !contentType.startsWith('image/')) {
    imageResponse.data.destroy();
    return res.status(502).json({ message: 'Le fournisseur n’a pas renvoyé une image valide.' });
  }

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  imageResponse.data.on('error', () => res.destroy());
  return imageResponse.data.pipe(res);
};