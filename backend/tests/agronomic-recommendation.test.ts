import { describe, expect, it } from 'vitest';
import { buildAgronomicRecommendations } from '../src/services/agronomicRecommendation.service.js';

const now = new Date('2026-10-06T12:00:00.000Z');
const parcelName = 'Zone de test';

describe('agronomic recommendations', () => {
  it('creates an urgent bilingual SMS recommendation for severe wind within 24 hours', () => {
    const recommendations = buildAgronomicRecommendations({
      parcelName,
      language: 'FR',
      now,
      forecasts: [{ timestamp: '2026-10-06T20:00:00.000Z', windSpeedMs: 19, description: 'heavy rain' }],
    });

    const urgent = recommendations.find((item) => item.code === 'SEVERE_WEATHER');
    expect(urgent).toMatchObject({ level: 'URGENT', requiresAgronomist: true });
    expect(urgent?.smsFr).toBeTruthy();
    expect(urgent?.smsEn).toBeTruthy();
    expect(urgent?.messageEn).toBeTruthy();
  });

  it('keeps severe weather outside 24 hours as advice without SMS', () => {
    const recommendations = buildAgronomicRecommendations({
      parcelName,
      language: 'FR',
      now,
      forecasts: [{ timestamp: '2026-10-08T00:00:00.000Z', windSpeedMs: 18, description: 'windy' }],
    });

    const weather = recommendations.find((item) => item.code === 'SEVERE_WEATHER');
    expect(weather).toMatchObject({ level: 'ATTENTION', requiresAgronomist: false });
    expect(weather?.smsFr).toBeUndefined();
  });

  it('gives practical advice for heavy rain without sending an SMS', () => {
    const recommendations = buildAgronomicRecommendations({
      parcelName,
      language: 'FR',
      now,
      forecasts: [{ timestamp: '2026-10-06T18:00:00.000Z', rainMm3h: 24, rainProbability: 0.9 }],
    });

    const rain = recommendations.find((item) => item.code === 'HEAVY_RAIN');
    expect(rain?.level).toBe('ATTENTION');
    expect(rain?.actions.some((action) => action.includes('Reporte'))).toBe(true);
    expect(rain?.smsFr).toBeUndefined();
  });

  it('flags a substantial NDVI drop for field inspection without diagnosing it', () => {
    const recommendations = buildAgronomicRecommendations({
      parcelName,
      language: 'FR',
      now,
      observations: [
        { date: '2026-10-05T10:00:00.000Z', ndviMean: 0.3, cloudCoveragePct: 8 },
        { date: '2026-10-02T10:00:00.000Z', ndviMean: 0.46, cloudCoveragePct: 10 },
      ],
    });

    const vegetation = recommendations.find((item) => item.code === 'VEGETATION_CHANGE');
    expect(vegetation?.level).toBe('ATTENTION');
    expect(vegetation?.requiresAgronomist).toBe(false);
    expect(vegetation?.actions.some((action) => action.includes('Parcours'))).toBe(true);
    expect(vegetation?.message).toContain('ne permet pas de savoir');
  });

  it('asks for a root-zone check when soil moisture is low', () => {
    const recommendations = buildAgronomicRecommendations({
      parcelName,
      language: 'FR',
      now,
      soil: { moisture: 0.08, measuredAt: now },
    });

    const soil = recommendations.find((item) => item.code === 'LOW_SOIL_MOISTURE');
    expect(soil?.level).toBe('ATTENTION');
    expect(soil?.actions.some((action) => action.includes('racines'))).toBe(true);
  });

  it('returns a plain-language reassurance when no threshold is crossed', () => {
    const recommendations = buildAgronomicRecommendations({ parcelName, language: 'FR', now });

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]).toMatchObject({ code: 'NO_MAJOR_SIGNAL', level: 'INFO' });
  });
});
