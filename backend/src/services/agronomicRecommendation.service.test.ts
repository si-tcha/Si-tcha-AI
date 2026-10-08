import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAgronomicRecommendations } from './agronomicRecommendation.service.js';

const now = new Date('2026-10-06T12:00:00.000Z');
const parcelName = 'Parcelle de test';

test('severe wind within 24 hours creates an urgent bilingual SMS recommendation', () => {
  const recommendations = buildAgronomicRecommendations({
    parcelName,
    language: 'FR',
    now,
    forecasts: [{
      timestamp: '2026-10-06T20:00:00.000Z',
      windSpeedMs: 19,
      description: 'heavy rain',
    }],
  });

  const urgent = recommendations.find((item) => item.code === 'SEVERE_WEATHER');
  assert.equal(urgent?.level, 'URGENT');
  assert.equal(urgent?.requiresAgronomist, true);
  assert.ok(urgent?.smsFr);
  assert.ok(urgent?.smsEn);
  assert.ok(urgent?.messageEn);
});

test('severe weather outside 24 hours is advisory and does not request SMS', () => {
  const recommendations = buildAgronomicRecommendations({
    parcelName,
    language: 'FR',
    now,
    forecasts: [{
      timestamp: '2026-10-08T00:00:00.000Z',
      windSpeedMs: 18,
      description: 'windy',
    }],
  });

  const weather = recommendations.find((item) => item.code === 'SEVERE_WEATHER');
  assert.equal(weather?.level, 'ATTENTION');
  assert.equal(weather?.requiresAgronomist, false);
  assert.equal(weather?.smsFr, undefined);
});

test('heavy rain gives practical steps without urgent SMS', () => {
  const recommendations = buildAgronomicRecommendations({
    parcelName,
    language: 'FR',
    now,
    forecasts: [{
      timestamp: '2026-10-06T18:00:00.000Z',
      rainMm3h: 24,
      rainProbability: 0.9,
    }],
  });

  const rain = recommendations.find((item) => item.code === 'HEAVY_RAIN');
  assert.equal(rain?.level, 'ATTENTION');
  assert.ok(rain?.actions.some((action) => action.includes('Reporte')));
  assert.equal(rain?.smsFr, undefined);
});

test('a large NDVI drop on clear images prompts a field inspection, not a diagnosis', () => {
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
  assert.equal(vegetation?.level, 'ATTENTION');
  assert.equal(vegetation?.requiresAgronomist, false);
  assert.ok(vegetation?.actions.some((action) => action.includes('Parcours')));
  assert.ok(vegetation?.message.includes('ne permet pas de savoir'));
  assert.equal(vegetation?.smsFr, undefined);
});

test('dry soil advice asks the farmer to check near the roots first', () => {
  const recommendations = buildAgronomicRecommendations({
    parcelName,
    language: 'FR',
    now,
    soil: { moisture: 0.08, measuredAt: now },
  });

  const soil = recommendations.find((item) => item.code === 'LOW_SOIL_MOISTURE');
  assert.equal(soil?.level, 'ATTENTION');
  assert.ok(soil?.actions.some((action) => action.includes('racines')));
});

test('no significant signals returns a plain-language reassurance', () => {
  const recommendations = buildAgronomicRecommendations({ parcelName, language: 'FR', now });

  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0].code, 'NO_MAJOR_SIGNAL');
  assert.equal(recommendations[0].level, 'INFO');
});
