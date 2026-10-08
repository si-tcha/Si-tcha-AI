export type RecommendationLevel = 'INFO' | 'ATTENTION' | 'URGENT';

export interface Recommendation {
  code: string;
  level: RecommendationLevel;
  title: string;
  message: string;
  messageEn?: string;
  reason: string;
  actions: string[];
  observedAt: string | null;
  requiresAgronomist: boolean;
  smsFr?: string;
  smsEn?: string;
}

interface WeatherSignal {
  temperatureC?: number | null;
  description?: string | null;
  measuredAt?: Date | string | null;
}

interface SoilSignal {
  moisture?: number | null;
  measuredAt?: Date | string | null;
}

interface ForecastSignal {
  timestamp: Date | string;
  windSpeedMs?: number | null;
  rainMm3h?: number | null;
  rainProbability?: number | null;
  description?: string | null;
}

interface SatelliteSignal {
  date: Date | string;
  ndviMean?: number | null;
  cloudCoveragePct?: number | null;
}

export interface RecommendationInput {
  parcelName: string;
  language: 'FR' | 'EN';
  weather?: WeatherSignal | null;
  soil?: SoilSignal | null;
  forecasts?: ForecastSignal[];
  observations?: SatelliteSignal[];
  crop?: string | null;
  cropPhase?: string | null;
  now?: Date;
}

const SEVERE_WIND_MS = 17.2;
const URGENT_WEATHER_HOURS = 24;
const MAX_FORECAST_HOURS = 72;
const DRY_SOIL_FRACTION = 0.12;
const NDVI_MIN_CLOUD_COVERAGE = 30;
const NDVI_MIN_ABSOLUTE_DROP = 0.08;
const NDVI_MIN_RELATIVE_DROP = 0.25;

function messageFor(
  language: 'FR' | 'EN',
  french: string,
  english: string,
): string {
  return language === 'EN' ? english : french;
}

function validDate(value: Date | string | undefined | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isThunderstorm(description: string | null | undefined): boolean {
  return Boolean(description && /thunderstorm|orage/i.test(description));
}

function hoursUntil(value: Date, now: Date): number {
  return (value.getTime() - now.getTime()) / (60 * 60 * 1000);
}

function addStormRecommendation(
  input: RecommendationInput,
  now: Date,
  recommendations: Recommendation[],
): void {
  const forecast = (input.forecasts ?? [])
    .map((item) => ({ item, at: validDate(item.timestamp) }))
    .filter((entry): entry is { item: ForecastSignal; at: Date } => entry.at !== null)
    .filter(({ item }) => (finiteNumber(item.windSpeedMs) ?? 0) >= SEVERE_WIND_MS
      || isThunderstorm(item.description))
    .map((entry) => ({ ...entry, hours: hoursUntil(entry.at, now) }))
    .filter(({ hours }) => hours >= 0 && hours <= MAX_FORECAST_HOURS)
    .sort((left, right) => left.hours - right.hours)[0];

  if (!forecast) return;
  const urgent = forecast.hours <= URGENT_WEATHER_HOURS;
  const wind = finiteNumber(forecast.item.windSpeedMs);
  const detailFr = wind === null ? 'un orage' : `des vents d’environ ${Math.round(wind)} m/s`;
  const detailEn = wind === null ? 'a thunderstorm' : `winds of about ${Math.round(wind)} m/s`;
  const hours = Math.max(0, Math.round(forecast.hours));
  const messageFr = `${detailFr} est prévu${wind === null ? '' : 's'} sur ${input.parcelName} dans environ ${hours} h. Évite les travaux au champ pendant l’épisode.`;
  const messageEn = `${detailEn} is forecast over ${input.parcelName} in about ${hours} h. Avoid field work during the event.`;

  recommendations.push({
    code: 'SEVERE_WEATHER',
    level: urgent ? 'URGENT' : 'ATTENTION',
    title: messageFor(input.language, urgent ? 'Orage ou vent dangereux' : 'Mauvais temps à surveiller', urgent ? 'Storm or dangerous wind' : 'Severe weather to watch'),
    message: messageFor(input.language, messageFr, messageEn),
    messageEn,
    reason: messageFor(
      input.language,
      'Un vent fort ou un orage peut blesser une personne et coucher les plants.',
      'Strong wind or a storm can injure people and flatten crops.',
    ),
    actions: input.language === 'EN'
      ? ['Stay away from the field during the storm.', 'Secure tools and light equipment if it is safe.', 'After the event, check for flattened plants or damage; contact the agronomist if damage is significant.']
      : ['Reste à l’écart du champ pendant l’orage.', 'Mets les outils et le petit matériel à l’abri si tu peux le faire sans danger.', 'Après l’épisode, vérifie les plants couchés ou cassés; appelle l’agronome si les dégâts sont importants.'],
    observedAt: forecast.at.toISOString(),
    requiresAgronomist: urgent,
    ...(urgent ? {
      smsFr: `Alerte champ ${input.parcelName}: orage ou vent dangereux prevu dans ${Math.max(0, Math.round(forecast.hours))} h. Reste a l'abri; verifie les degats apres l'episode. SI-TCHA AI`,
      smsEn: `Field alert ${input.parcelName}: storm or dangerous wind expected in ${Math.max(0, Math.round(forecast.hours))} h. Stay safe; check damage after the event. SI-TCHA AI`,
    } : {}),
  });
}

function addHeavyRainRecommendation(
  input: RecommendationInput,
  now: Date,
  recommendations: Recommendation[],
): void {
  const forecast = (input.forecasts ?? [])
    .map((item) => ({ item, at: validDate(item.timestamp) }))
    .filter((entry): entry is { item: ForecastSignal; at: Date } => entry.at !== null)
    .map((entry) => ({ ...entry, hours: hoursUntil(entry.at, now) }))
    .filter(({ item, hours }) => hours >= 0 && hours <= MAX_FORECAST_HOURS
      && ((finiteNumber(item.rainMm3h) ?? 0) >= 20
        || ((finiteNumber(item.rainProbability) ?? 0) >= 0.85
          && (finiteNumber(item.rainMm3h) ?? 0) >= 10)))
    .sort((left, right) => left.hours - right.hours)[0];

  if (!forecast) return;
  const rain = finiteNumber(forecast.item.rainMm3h) ?? 0;
  recommendations.push({
    code: 'HEAVY_RAIN',
    level: 'ATTENTION',
    title: messageFor(input.language, 'Forte pluie possible', 'Heavy rain possible'),
    message: messageFor(
      input.language,
      `Une forte pluie est prévue sur ${input.parcelName} dans environ ${Math.max(0, Math.round(forecast.hours))} h.`,
      `Heavy rain is forecast over ${input.parcelName} in about ${Math.max(0, Math.round(forecast.hours))} h.`,
    ),
    reason: messageFor(
      input.language,
      `La prévision indique environ ${Math.round(rain)} mm de pluie en trois heures.`,
      `The forecast indicates about ${Math.round(rain)} mm of rain in three hours.`,
    ),
    actions: input.language === 'EN'
      ? ['Postpone spraying and fertilizer spreading until the rain has passed.', 'Check field drains and avoid walking on waterlogged soil.']
      : ['Reporte les traitements et l’épandage d’engrais après la pluie.', 'Vérifie les écoulements d’eau et évite de marcher sur un sol détrempé.'],
    observedAt: forecast.at.toISOString(),
    requiresAgronomist: false,
  });
}

function addDrySoilRecommendation(
  input: RecommendationInput,
  recommendations: Recommendation[],
): void {
  const moisture = finiteNumber(input.soil?.moisture);
  if (moisture === null || moisture >= DRY_SOIL_FRACTION) return;

  recommendations.push({
    code: 'LOW_SOIL_MOISTURE',
    level: 'ATTENTION',
    title: messageFor(input.language, 'Sol probablement sec', 'Soil may be dry'),
    message: messageFor(
      input.language,
      `La mesure d’humidité du sol est basse (${Math.round(moisture * 100)} %). Vérifie la terre près des racines avant de décider d’arroser.`,
      `The soil moisture reading is low (${Math.round(moisture * 100)}%). Check the soil near the roots before deciding to water.`,
    ),
    reason: messageFor(
      input.language,
      'Cette valeur est un repère général; le besoin en eau dépend du sol et de la culture.',
      'This is a general indicator; water needs depend on the soil and crop.',
    ),
    actions: input.language === 'EN'
      ? ['Check soil a few centimetres below the surface near the roots.', 'If it is dry and no rain is expected, water slowly in the cooler morning or evening.']
      : ['Touche la terre à quelques centimètres de profondeur, près des racines.', 'Si elle est sèche et qu’aucune pluie n’est prévue, arrose doucement le matin ou le soir.'],
    observedAt: validDate(input.soil?.measuredAt)?.toISOString() ?? null,
    requiresAgronomist: false,
  });
}

function addVegetationChangeRecommendation(
  input: RecommendationInput,
  now: Date,
  recommendations: Recommendation[],
): void {
  const observations = (input.observations ?? [])
    .map((item) => ({ item, at: validDate(item.date), ndvi: finiteNumber(item.ndviMean) }))
    .filter((entry): entry is { item: SatelliteSignal; at: Date; ndvi: number } => entry.at !== null && entry.ndvi !== null)
    .filter(({ item, at }) => (finiteNumber(item.cloudCoveragePct) ?? 100) <= NDVI_MIN_CLOUD_COVERAGE
      && hoursUntil(at, now) <= 0)
    .sort((left, right) => right.at.getTime() - left.at.getTime());

  if (observations.length < 2) return;
  const [latest, previous] = observations;
  const daysBetween = (latest.at.getTime() - previous.at.getTime()) / (24 * 60 * 60 * 1000);
  const absoluteDrop = previous.ndvi - latest.ndvi;
  const relativeDrop = previous.ndvi > 0 ? absoluteDrop / previous.ndvi : 0;
  if (daysBetween <= 0 || daysBetween > 30
    || absoluteDrop < NDVI_MIN_ABSOLUTE_DROP
    || relativeDrop < NDVI_MIN_RELATIVE_DROP) return;

  recommendations.push({
    code: 'VEGETATION_CHANGE',
    level: 'ATTENTION',
    title: messageFor(input.language, 'La végétation semble moins vigoureuse', 'Vegetation may be under stress'),
    message: messageFor(
      input.language,
      `L’image satellite montre une baisse de vigueur sur ${input.parcelName}. Cela ne permet pas de savoir si la cause est l’eau, une maladie ou des insectes.`,
      `The satellite image shows lower vegetation vigor on ${input.parcelName}. It cannot tell whether the cause is water, disease, or insects.`,
    ),
    reason: messageFor(
      input.language,
      `L’indice satellite de vigueur (NDVI), qui montre à quel point la végétation paraît active, est passé de ${previous.ndvi.toFixed(2)} à ${latest.ndvi.toFixed(2)} entre deux images peu nuageuses.`,
      `The satellite vegetation indicator (NDVI), which estimates how active vegetation appears, changed from ${previous.ndvi.toFixed(2)} to ${latest.ndvi.toFixed(2)} between two mostly clear images.`,
    ),
    actions: input.language === 'EN'
      ? ['Walk through several parts of the field and compare healthy and affected plants.', 'Check leaf color, spots, chewing damage, and soil moisture.', 'Take a photo and contact the agronomist if symptoms are widespread or getting worse; do not spray based on NDVI alone.']
      : ['Parcours plusieurs zones du champ et compare les plants sains et ceux qui semblent touchés.', 'Regarde la couleur des feuilles, les taches, les traces de morsure et l’humidité du sol.', 'Prends une photo et contacte l’agronome si les signes sont étendus ou s’aggravent; ne traite pas sur la seule base du NDVI.'],
    observedAt: latest.at.toISOString(),
    requiresAgronomist: false,
  });
}

function addCropStageGuidance(input: RecommendationInput, recommendations: Recommendation[]): void {
  if (!input.cropPhase) return;
  const phase = input.cropPhase.toUpperCase();
  const cropName = input.crop?.trim();
  let guidance: { fr: string; en: string } | null = null;

  if (phase === 'PREPARATION' || phase === 'IMPLANTATION') {
    guidance = {
      fr: 'Avant les semis ou la plantation, vérifie l’humidité de la terre et que l’eau peut s’écouler. Les besoins exacts dépendent de la culture.',
      en: 'Before sowing or planting, check soil moisture and make sure water can drain. Exact needs depend on the crop.',
    };
  } else if (phase === 'CROISSANCE' || phase === 'ENTRETIEN') {
    guidance = {
      fr: 'Pendant la croissance, observe chaque semaine plusieurs plants, surtout les nouvelles feuilles et le dessous des feuilles.',
      en: 'During growth, check several plants each week, especially new leaves and the undersides of leaves.',
    };
  } else if (phase === 'RECOLTE') {
    guidance = {
      fr: 'Avant la récolte, vérifie la maturité sur plusieurs plants et respecte les délais indiqués sur les produits déjà utilisés.',
      en: 'Before harvesting, check maturity on several plants and follow the label waiting periods for any products used.',
    };
  }
  if (!guidance) return;

  recommendations.push({
    code: 'CROP_STAGE_CHECK',
    level: 'INFO',
    title: messageFor(input.language, 'À faire pour cette étape', 'A useful check for this crop stage'),
    message: messageFor(input.language, guidance.fr, guidance.en),
    reason: messageFor(
      input.language,
      cropName ? `Conseil général pour ${cropName}; les pratiques précises varient selon la variété et le sol.` : 'Conseil général; les pratiques précises varient selon la culture et le sol.',
      cropName ? `General guidance for ${cropName}; exact practices vary by variety and soil.` : 'General guidance; exact practices vary by crop and soil.',
    ),
    actions: [],
    observedAt: null,
    requiresAgronomist: false,
  });
}

export function buildAgronomicRecommendations(input: RecommendationInput): Recommendation[] {
  const now = input.now ?? new Date();
  const recommendations: Recommendation[] = [];

  addStormRecommendation(input, now, recommendations);
  addHeavyRainRecommendation(input, now, recommendations);
  addDrySoilRecommendation(input, recommendations);
  addVegetationChangeRecommendation(input, now, recommendations);
  addCropStageGuidance(input, recommendations);

  recommendations.sort((left, right) => {
    const priority: Record<RecommendationLevel, number> = { URGENT: 0, ATTENTION: 1, INFO: 2 };
    return priority[left.level] - priority[right.level];
  });

  if (recommendations.length === 0) {
    recommendations.push({
      code: 'NO_MAJOR_SIGNAL',
      level: 'INFO',
      title: messageFor(input.language, 'Rien d’urgent détecté', 'No urgent signal detected'),
      message: messageFor(
        input.language,
        'Continue à observer les plants et le sol. Les données satellite et météo aident à repérer des changements, mais ne remplacent pas une vérification dans le champ.',
        'Keep checking the plants and soil. Satellite and weather data help spot changes, but do not replace a field check.',
      ),
      reason: messageFor(input.language, 'Aucun des seuils de surveillance utilisés n’est dépassé avec les dernières données.', 'The latest data did not cross the monitoring thresholds currently used.'),
      actions: [],
      observedAt: null,
      requiresAgronomist: false,
    });
  }

  return recommendations;
}