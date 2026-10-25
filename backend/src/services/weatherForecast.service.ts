export interface NormalizedWeatherCard {
  id: string;
  bassin: string;
  temperature: number;
  temperatureMin: number;
  temperatureMax: number;
  pluviometrie: number;
  rainProbability: number;
  humidity?: number;
  windSpeedKmh: number;
  description: string;
  date: string;
}

export interface NormalizedForecastSignal {
  timestamp: string;
  windSpeedMs: number;
  rainMm3h: number;
  rainProbability: number;
  description: string;
}

export interface NormalizedDailySignal {
  date: string;
  rainMm: number;
  rainProbability: number;
  temperatureMaxC: number;
}

export interface NormalizedWeatherForecast {
  cards: NormalizedWeatherCard[];
  forecasts: NormalizedForecastSignal[];
  daily: NormalizedDailySignal[];
  fetchedAt: string;
  source: 'open-meteo';
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const forecastCache = new Map<string, { value: NormalizedWeatherForecast; expiresAt: number }>();
const inFlightForecasts = new Map<string, Promise<NormalizedWeatherForecast>>();

export function resetWeatherForecastCacheForTesting(): void {
  forecastCache.clear();
  inFlightForecasts.clear();
}

const weatherDescriptions: Record<number, string> = {
  0: 'Ciel dégagé', 1: 'Globalement dégagé', 2: 'Partiellement nuageux', 3: 'Couvert',
  45: 'Brouillard', 48: 'Brouillard givrant', 51: 'Bruine légère', 53: 'Bruine',
  55: 'Forte bruine', 61: 'Pluie légère', 63: 'Pluie modérée', 65: 'Forte pluie',
  80: 'Averses légères', 81: 'Averses', 82: 'Fortes averses', 95: 'Orage',
  96: 'Orage avec grêle', 99: 'Orage violent avec grêle',
};

export function weatherCodeToFrench(code: unknown): string {
  const numeric = Number(code);
  return weatherDescriptions[numeric] ?? 'Conditions variables';
}

function finiteArray(value: unknown): number[] {
  return Array.isArray(value) ? value.map(Number).map((item) => Number.isFinite(item) ? item : 0) : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function normalizeOpenMeteoResponse(payload: any, bassin: string, fetchedAt = new Date()): NormalizedWeatherForecast {
  const daily = payload?.daily ?? {};
  const dates = stringArray(daily.time);
  const maxTemps = finiteArray(daily.temperature_2m_max);
  const minTemps = finiteArray(daily.temperature_2m_min);
  const rainSums = finiteArray(daily.precipitation_sum);
  const rainProbabilities = finiteArray(daily.precipitation_probability_max);
  const windMax = finiteArray(daily.wind_speed_10m_max);
  const codes = finiteArray(daily.weather_code);

  if (dates.length === 0) throw new Error('Prévisions météo vides ou invalides.');

  const cards = dates.slice(0, 7).map((date, index) => ({
    id: `forecast-${date}`,
    bassin,
    temperature: Math.round(((maxTemps[index] ?? 0) + (minTemps[index] ?? 0)) / 2),
    temperatureMin: minTemps[index] ?? 0,
    temperatureMax: maxTemps[index] ?? 0,
    pluviometrie: rainSums[index] ?? 0,
    rainProbability: rainProbabilities[index] ?? 0,
    windSpeedKmh: windMax[index] ?? 0,
    description: weatherCodeToFrench(codes[index]),
    date,
  }));

  const hourly = payload?.hourly ?? {};
  const times = stringArray(hourly.time);
  const rain = finiteArray(hourly.precipitation);
  const probability = finiteArray(hourly.precipitation_probability);
  const wind = finiteArray(hourly.wind_speed_10m);
  const hourlyCodes = finiteArray(hourly.weather_code);
  const forecasts = times.map((timestamp, index) => ({
    timestamp,
    windSpeedMs: (wind[index] ?? 0) / 3.6,
    rainMm3h: (rain[index] ?? 0) + (rain[index + 1] ?? 0) + (rain[index + 2] ?? 0),
    rainProbability: Math.max(probability[index] ?? 0, probability[index + 1] ?? 0, probability[index + 2] ?? 0) / 100,
    description: weatherCodeToFrench(hourlyCodes[index]),
  }));

  return {
    cards,
    forecasts,
    daily: cards.map((card) => ({
      date: card.date,
      rainMm: card.pluviometrie,
      rainProbability: card.rainProbability / 100,
      temperatureMaxC: card.temperatureMax,
    })),
    fetchedAt: fetchedAt.toISOString(),
    source: 'open-meteo',
  };
}

export async function fetchWeatherForecast(
  latitude: number,
  longitude: number,
  bassin: string,
  fetchImpl: typeof fetch = fetch,
): Promise<NormalizedWeatherForecast> {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('Coordonnées météo invalides.');
  }
  const query = new URLSearchParams({
    latitude: String(latitude), longitude: String(longitude), timezone: 'Africa/Douala', forecast_days: '7',
    hourly: 'precipitation_probability,precipitation,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max',
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetchImpl(`https://api.open-meteo.com/v1/forecast?${query}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`Fournisseur météo indisponible (${response.status}).`);
    return normalizeOpenMeteoResponse(await response.json(), bassin);
  } finally {
    clearTimeout(timeout);
  }
}

export async function getWeatherForecast(
  latitude: number,
  longitude: number,
  bassin: string,
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
): Promise<NormalizedWeatherForecast> {
  const key = `${latitude.toFixed(4)}:${longitude.toFixed(4)}`;
  const cached = forecastCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;
  const pending = inFlightForecasts.get(key);
  if (pending) return pending;

  const task = fetchWeatherForecast(latitude, longitude, bassin, fetchImpl)
    .then((value) => {
      forecastCache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
      return value;
    })
    .finally(() => {
      if (inFlightForecasts.get(key) === task) inFlightForecasts.delete(key);
    });
  inFlightForecasts.set(key, task);
  return task;
}
