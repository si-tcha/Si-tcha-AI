import axios from 'axios';

export const AGRO_API_BASE_URL = 'https://api.agromonitoring.com/agro/1.0';
const AGRO_API_HOST = 'api.agromonitoring.com';

export interface AgroMonitoringPolygonGeoJson {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
}

export interface AgroMonitoringPolygon {
  id: string;
  area?: number;
  center?: number[];
  geo_json?: AgroMonitoringPolygonGeoJson;
}

// Lire la clé au moment de l'appel permet à dotenv de charger la configuration avant le cron.
export function getAgroMonitoringApiKey(): string {
  const apiKey = process.env.AGROMONITORING_API_KEY;
  if (!apiKey) throw new Error('AGROMONITORING_API_KEY manquante.');
  return apiKey;
}

function parseAgroMonitoringUrl(value: string): URL {
  const url = new URL(value);
  // Les URLs d'images viennent de l'API; n'autoriser que son hôte évite un proxy vers un hôte arbitraire.
  if (url.hostname !== AGRO_API_HOST || !['http:', 'https:'].includes(url.protocol)) {
    throw new Error('URL AgroMonitoring non autorisée.');
  }
  url.protocol = 'https:';
  return url;
}

export function withAgroMonitoringApiKey(value: string, apiKey = getAgroMonitoringApiKey()): string {
  const url = parseAgroMonitoringUrl(value);
  url.searchParams.set('appid', apiKey);
  return url.toString();
}

export function withoutAgroMonitoringApiKey(value: string | undefined): string | null {
  if (!value) return null;
  const url = parseAgroMonitoringUrl(value);
  // Ne jamais enregistrer ni renvoyer au mobile une URL contenant la clé fournisseur.
  url.searchParams.delete('appid');
  return url.toString();
}

export function isValidGeoPoint(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

export async function createAgroMonitoringPolygon(
  name: string,
  geoJson: AgroMonitoringPolygonGeoJson,
): Promise<AgroMonitoringPolygon> {
  const response = await axios.post<AgroMonitoringPolygon>(
    `${AGRO_API_BASE_URL}/polygons`,
    { name, geo_json: geoJson },
    {
      params: { appid: getAgroMonitoringApiKey() },
      headers: { 'Content-Type': 'application/json' },
      timeout: 20000,
    },
  );
  return response.data;
}

export async function deleteAgroMonitoringPolygon(polygonId: string): Promise<void> {
  await axios.delete(`${AGRO_API_BASE_URL}/polygons/${encodeURIComponent(polygonId)}`, {
    params: { appid: getAgroMonitoringApiKey() },
    timeout: 15000,
  });
}