/** Vérifie l’ajustement linéaire descriptif, la pente par décennie et les garde-fous. */
import { describe, expect, it } from 'vitest';
import { fittedValue, linearTrend, monthlyPoints } from './trend';
import type { Observation } from './api';

/** Construit une observation mensuelle minimale pour le calcul. */
function monthly(date: string, value: number): Observation {
  return { date: `${date}-01`, sector: 'Douala', value };
}

describe('analyse de tendance', () => {
  it('regroupe une valeur par mois et ignore les lignes invalides', () => {
    const points = monthlyPoints([
      monthly('2020-01', 10),
      monthly('2020-01', 14),
      { date: 'sans-date', sector: 'Douala', value: 3 },
      { date: '2020-02-01', sector: 'Douala', value: Number.NaN },
      monthly('2020-02', 20),
    ]);

    expect(points.map((point) => point.month)).toEqual(['2020-01', '2020-02']);
    expect(points[0].value).toBe(12);
    expect(points[1].value).toBe(20);
  });

  it('retrouve une pente exacte sur une série strictement linéaire', () => {
    const rows = Array.from({ length: 24 }, (_, index) => monthly(
      `${2020 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`,
      20 + index * 0.02,
    ));

    const trend = linearTrend(rows);

    expect(trend.months).toBe(24);
    expect(trend.slopePerMonth).toBeCloseTo(0.02, 10);
    // 0,02 par mois équivaut à 2,4 par décennie.
    expect(trend.slopePerDecade).toBeCloseTo(2.4, 10);
    expect(trend.residualStdDev).toBeCloseTo(0, 10);
    expect(trend.isSignal).toBe(true);
    expect(fittedValue(trend, trend.points[5].index)).toBeCloseTo(20 + 5 * 0.02, 10);
  });

  it('ne calcule aucune pente sous trois mois', () => {
    const trend = linearTrend([monthly('2021-01', 5), monthly('2021-02', 7)]);

    expect(trend.months).toBe(2);
    expect(trend.slopePerMonth).toBeNull();
    expect(trend.slopePerDecade).toBeNull();
    expect(trend.isSignal).toBe(false);
    expect(fittedValue(trend, 0)).toBeNull();
  });

  it('signale l’absence de signal sur une série purement alternée', () => {
    const rows = Array.from({ length: 12 }, (_, index) => monthly(
      `2022-${String(index + 1).padStart(2, '0')}`,
      index % 2 === 0 ? 10 : 12,
    ));

    const trend = linearTrend(rows);

    expect(trend.slopePerMonth).not.toBeNull();
    expect(trend.isSignal).toBe(false);
  });
});
