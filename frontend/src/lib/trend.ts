/**
 * Ajustement linéaire descriptif d’une série mensuelle.
 *
 * Le calcul ne prévoit rien : il résume la pente observée sur les mois réellement
 * présents et renvoie la dispersion autour de l’ajustement, afin que l’interface
 * puisse afficher une tendance avec sa marge, sans extrapolation.
 */
import type { Observation } from './api';
import { monthIndex } from './climate';

/** Point mensuel agrégé, une seule valeur par mois. */
export interface MonthlyPoint {
  /** Clé YYYY-MM. */
  month: string;
  /** Index calendaire entier, base du calcul de pente. */
  index: number;
  /** Valeur observée du mois. */
  value: number;
}

/** Résultat de l’ajustement linéaire sur les mois présents. */
export interface LinearTrend {
  /** Points mensuels réellement observés, triés. */
  points: MonthlyPoint[];
  /** Pente en unité par mois, ou null si le calcul n’est pas possible. */
  slopePerMonth: number | null;
  /** Pente ramenée à une décennie, plus lisible pour une série climatique. */
  slopePerDecade: number | null;
  /** Ordonnée à l’origine de la droite au mois index 0. */
  intercept: number | null;
  /** Nombre de mois distincts utilisés. */
  months: number;
  /** Dispersion des résidus autour de la droite, même unité que la série. */
  residualStdDev: number | null;
  /** Indique si la pente dépasse le double de son erreur-type (signal descriptif). */
  isSignal: boolean;
}

/** Regroupe les observations par mois en moyennant les doublons éventuels. */
export function monthlyPoints(rows: Observation[]): MonthlyPoint[] {
  const buckets = new Map<string, number[]>();
  for (const row of rows) {
    const month = row.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    if (!Number.isFinite(Number(row.value))) continue;
    const values = buckets.get(month);
    if (values) values.push(Number(row.value));
    else buckets.set(month, [Number(row.value)]);
  }

  return [...buckets.entries()]
    .map(([month, values]) => ({
      month,
      index: monthIndex(month),
      value: values.reduce((total, value) => total + value, 0) / values.length,
    }))
    .sort((left, right) => left.index - right.index);
}

/**
 * Ajuste une droite par moindres carrés sur les mois présents.
 * Une série de moins de trois mois ou sans variation renvoie une pente nulle
 * plutôt qu’une extrapolation.
 */
export function linearTrend(rows: Observation[]): LinearTrend {
  const points = monthlyPoints(rows);
  const empty: LinearTrend = {
    points,
    slopePerMonth: null,
    slopePerDecade: null,
    intercept: null,
    months: points.length,
    residualStdDev: null,
    isSignal: false,
  };
  if (points.length < 3) return empty;

  const count = points.length;
  const meanIndex = points.reduce((total, point) => total + point.index, 0) / count;
  const meanValue = points.reduce((total, point) => total + point.value, 0) / count;

  let covariance = 0;
  let variance = 0;
  for (const point of points) {
    const offset = point.index - meanIndex;
    covariance += offset * (point.value - meanValue);
    variance += offset * offset;
  }
  if (variance === 0) return empty;

  const slope = covariance / variance;
  const intercept = meanValue - slope * meanIndex;

  let squaredResiduals = 0;
  for (const point of points) {
    const residual = point.value - (intercept + slope * point.index);
    squaredResiduals += residual * residual;
  }
  // Deux paramètres estimés : les degrés de liberté restants valent n - 2.
  const residualVariance = count > 2 ? squaredResiduals / (count - 2) : 0;
  const residualStdDev = Math.sqrt(residualVariance);
  const slopeStandardError = variance > 0 ? Math.sqrt(residualVariance / variance) : Number.POSITIVE_INFINITY;

  return {
    points,
    slopePerMonth: slope,
    slopePerDecade: slope * 120,
    intercept,
    months: count,
    residualStdDev,
    isSignal: Number.isFinite(slopeStandardError) && Math.abs(slope) > 2 * slopeStandardError,
  };
}

/** Valeur ajustée d’un mois donné, utilisée pour tracer la droite sur le graphique. */
export function fittedValue(trend: LinearTrend, index: number): number | null {
  if (trend.slopePerMonth === null || trend.intercept === null) return null;
  return trend.intercept + trend.slopePerMonth * index;
}
