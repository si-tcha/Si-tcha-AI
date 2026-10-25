import { describe, expect, it, vi } from 'vitest';
import { fetchWeatherForecast, getWeatherForecast, normalizeOpenMeteoResponse, resetWeatherForecastCacheForTesting } from '../src/services/weatherForecast.service.js';

const payload = {
  daily: {
    time: ['2026-10-25', '2026-10-26'],
    weather_code: [63, 2],
    temperature_2m_max: [28, 30],
    temperature_2m_min: [20, 21],
    precipitation_sum: [12, 1],
    precipitation_probability_max: [90, 20],
    wind_speed_10m_max: [18, 12],
  },
  hourly: {
    time: ['2026-10-25T10:00', '2026-10-25T11:00', '2026-10-25T12:00'],
    precipitation: [4, 5, 6],
    precipitation_probability: [60, 80, 90],
    wind_speed_10m: [36, 18, 9],
    weather_code: [61, 63, 65],
  },
};

describe('weather forecast normalization', () => {
  it('normalizes provider units and produces readable daily cards', () => {
    const result = normalizeOpenMeteoResponse(payload, 'Ouest', new Date('2026-10-25T09:00:00Z'));
    expect(result.cards[0]).toMatchObject({ bassin: 'Ouest', temperature: 24, pluviometrie: 12, rainProbability: 90, description: 'Pluie modérée' });
    expect(result.forecasts[0]).toMatchObject({ windSpeedMs: 10, rainMm3h: 15, rainProbability: 0.9 });
  });

  it('requests forecasts by coordinates without requiring a polygon id or API key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    await fetchWeatherForecast(5.48, 10.42, 'Ouest', fetchMock as any);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('latitude=5.48');
    expect(url).toContain('longitude=10.42');
    expect(url).not.toContain('polyid');
    expect(url).not.toContain('appid');
  });

  it('rejects invalid coordinates before any network request', async () => {
    const fetchMock = vi.fn();
    await expect(fetchWeatherForecast(200, 10, 'Test', fetchMock as any)).rejects.toThrow('Coordonnées');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deduplicates concurrent calls and caches the provider response', async () => {
    resetWeatherForecastCacheForTesting();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const fetchMock = vi.fn().mockImplementation(async () => {
      await gate;
      return { ok: true, json: async () => payload };
    });
    const first = getWeatherForecast(5.48, 10.42, 'Ouest', fetchMock as any, 1000);
    const concurrent = getWeatherForecast(5.48, 10.42, 'Ouest', fetchMock as any, 1000);
    release();
    await Promise.all([first, concurrent]);
    await getWeatherForecast(5.48, 10.42, 'Ouest', fetchMock as any, 2000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
