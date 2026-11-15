/** Tests unitaires des filtres, résumés, formats et exports; les fixtures sont synthétiques. */
import { describe, expect, it } from 'vitest';
import type { DatasetMetadata, Observation } from './api';
import { csvContentForRows, formatValue, maximumPeriodNote, minimumPeriodNote, monthFromIndex, monthIndex, periodForPreset, rowsForPeriod, summarizeRows } from './climate';

const metadata: DatasetMetadata = {
  kind: 'temperature',
  filename: 'temperature_Douala.csv',
  label: 'Température de l’air à 2 m',
  source: 'NASA MERRA-2',
  variable: 'T2M',
  unit: '°C',
  aggregation: 'Moyenne mensuelle',
  spatial_resolution: 'Grille régionale',
  provenance_note: 'Série agrégée de réanalyse.',
  latitude: 4.05,
  longitude: 9.75,
  color: '#e48a21',
  precision: 1,
  sectors: ['Douala'],
  start: '2015-01',
  end: '2025-12',
  record_count: 132,
};

const observations: Observation[] = [
  { date: '2020-01-01', sector: 'Douala', value: 10 },
  { date: '2020-02-01', sector: 'Douala', value: 20 },
  { date: '2020-03-01', sector: 'Douala', value: 30 },
  { date: '2020-04-01', sector: 'Douala', value: 20 },
  { date: '2020-05-01', sector: 'Douala', value: 40 },
  { date: '2020-06-01', sector: 'Douala', value: 50 },
];

describe('helpers climatiques', () => {
  it('convertit les mois en index continu, y compris au changement d’année', () => {
    expect(monthFromIndex(monthIndex('2020-01'))).toBe('2020-01');
    expect(monthFromIndex(monthIndex('2020-01') - 1)).toBe('2019-12');
  });

  it('borne le raccourci 12 mois à la période réellement fournie', () => {
    expect(periodForPreset(metadata, '12m')).toEqual({ start: '2025-01', end: '2025-12' });
  });

  it('filtre de manière inclusive et calcule les statistiques depuis les observations', () => {
    const period = { start: '2020-04', end: '2020-06' };
    const current = rowsForPeriod(observations, period);
    const summary = summarizeRows(current, period);

    expect(current).toHaveLength(3);
    expect(summary.average).toBeCloseTo(110 / 3, 8);
    expect(summary.minimum).toBe(20);
    expect(summary.minimumMonths).toEqual(['2020-04']);
    expect(summary.maximum).toBe(50);
    expect(summary.maximumMonths).toEqual(['2020-06']);
    expect(summary.observedMonths).toBe(3);
    expect(summary.expectedMonths).toBe(3);
  });

  it('indique tous les mois ex æquo du maximum, sans compter deux fois un mois', () => {
    const tiedRows: Observation[] = [
      { date: '2020-02-01', sector: 'Douala', value: 50 },
      { date: '2020-02-01', sector: 'Autre secteur', value: 50 },
      { date: '2020-03-01', sector: 'Douala', value: 50 },
      { date: '2020-04-01', sector: 'Douala', value: 45 },
    ];
    const summary = summarizeRows(tiedRows, { start: '2020-02', end: '2020-04' });

    expect(summary.maximum).toBe(50);
    expect(summary.maximumMonths).toEqual(['2020-02', '2020-03']);
    expect(maximumPeriodNote(summary.maximumMonths)).toContain('ex æquo');
    expect(maximumPeriodNote([])).toBe('Aucun maximum observé dans cette sélection');
  });

  it('indique tous les mois ex æquo du minimum, sans compter deux fois un mois', () => {
    const tiedRows: Observation[] = [
      { date: '2020-02-01', sector: 'Douala', value: 10 },
      { date: '2020-02-01', sector: 'Autre secteur', value: 10 },
      { date: '2020-03-01', sector: 'Douala', value: 10 },
      { date: '2020-04-01', sector: 'Douala', value: 20 },
    ];
    const summary = summarizeRows(tiedRows, { start: '2020-02', end: '2020-04' });

    expect(summary.minimum).toBe(10);
    expect(summary.minimumMonths).toEqual(['2020-02', '2020-03']);
    expect(minimumPeriodNote(summary.minimumMonths)).toContain('ex æquo');
    expect(minimumPeriodNote(summary.minimumMonths)).toContain('minimum');
  });

  it('signale clairement l’absence de minimum lorsqu’aucune valeur n’est disponible', () => {
    const summary = summarizeRows([], { start: '2020-02', end: '2020-04' });

    expect(summary.minimum).toBeNull();
    expect(summary.minimumMonths).toEqual([]);
    expect(minimumPeriodNote(summary.minimumMonths)).toBe('Aucun minimum observé dans cette sélection');
  });

  it('compte les mois présents sans remplir les mois absents par zéro', () => {
    const sparseRows = [observations[0], observations[2]];
    const period = { start: '2020-01', end: '2020-03' };
    const summary = summarizeRows(sparseRows, period);

    expect(summary.average).toBe(20);
    expect(summary.observedMonths).toBe(2);
    expect(summary.expectedMonths).toBe(3);
  });

  it('exporte seulement les lignes sélectionnées avec leurs métadonnées de source', () => {
    const selectedRows = rowsForPeriod(observations, { start: '2020-02', end: '2020-03' });
    const csv = csvContentForRows(selectedRows, metadata);

    expect(csv).toContain('"2020-02-01"');
    expect(csv).toContain('"2020-03-01"');
    expect(csv).not.toContain('"2020-01-01"');
    expect(csv).toContain('"NASA MERRA-2"');
    expect(csv).toContain('"°C"');
  });

  it('formate la mesure avec l’unité et la précision du catalogue', () => {
    expect(formatValue(28.46, metadata)).toBe('28,5 °C');
    expect(formatValue(null, metadata)).toBe('—');
  });
});
