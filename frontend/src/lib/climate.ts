/** Utilitaires purs de période, résumé descriptif, formatage et export CSV des observations affichées. */
import type { DatasetMetadata, Observation } from './api';

/** Bornes mensuelles inclusives appliquées aux séries du tableau de bord. */
export interface Period {
  start: string;
  end: string;
}

/** Statistiques descriptives et nombre de mois réellement présents sur la période. */
export interface SummaryStats {
  average: number | null;
  minimum: number | null;
  maximum: number | null;
  minimumMonths: string[];
  maximumMonths: string[];
  observedMonths: number;
  expectedMonths: number;
}

/** Raccourcis de période proposés par le filtre du dashboard. */
export type PeriodPreset = '12m' | '36m' | '60m' | 'all';

/** Convertit une clé YYYY-MM en index entier pour comparer les mois. */
export function monthIndex(value: string): number {
  const [year, month] = value.slice(0, 7).split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return 0;
  return year * 12 + month - 1;
}

/** Reconstruit une clé YYYY-MM à partir de l’index calendaire. */
export function monthFromIndex(index: number): string {
  const year = Math.floor(index / 12);
  const month = index - year * 12 + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Formate le mois en fixant UTC pour éviter un décalage local.
 * La locale est le français par défaut; une locale explicite suit la langue choisie.
 */
export function formatMonth(value: string, short = false, locale = 'fr-FR'): string {
  const month = value.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return '—';
  const date = new Date(`${month}-01T12:00:00Z`);
  return new Intl.DateTimeFormat(locale, {
    month: short ? 'short' : 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** Traduit les unités composées renvoyées par l’API (mm/mois, mm/jour). */
export function formatUnit(unit: string, language: 'fr' | 'en' = 'fr'): string {
  if (language === 'fr') return unit;
  return unit.replace(/\bmm\/mois\b/g, 'mm/month').replace(/\bmm\/jour\b/g, 'mm/day');
}

/** Applique l’unité et la précision déclarées dans les métadonnées du produit. */
export function formatValue(
  value: number | null | undefined,
  metadata: Pick<DatasetMetadata, 'precision' | 'unit'>,
  locale = 'fr-FR',
  language: 'fr' | 'en' = 'fr',
): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: metadata.precision,
    maximumFractionDigits: metadata.precision,
  }).format(value);
  return `${number} ${formatUnit(metadata.unit, language)}`;
}

/** Calcule la moyenne des valeurs finies ou renvoie null si aucune ne subsiste. */
export function average(values: number[]): number | null {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((total, value) => total + value, 0) / valid.length : null;
}

/** Filtre les observations aux bornes mensuelles inclusives, sans interpolation. */
export function rowsForPeriod(rows: Observation[], period: Period): Observation[] {
  return rows.filter((row) => {
    const month = row.date.slice(0, 7);
    return (!period.start || month >= period.start) && (!period.end || month <= period.end);
  });
}

/** Calcule des statistiques descriptives et distingue mois observés et attendus. */
export function summarizeRows(rows: Observation[], period: Period): SummaryStats {
  const expectedMonths = period.start && period.end
    ? Math.max(0, monthIndex(period.end) - monthIndex(period.start) + 1)
    : new Set(rows.map((row) => row.date.slice(0, 7))).size;
  const observedMonthKeys = new Set(rows.map((row) => row.date.slice(0, 7)));
  const numericRows = rows.filter((row) => Number.isFinite(Number(row.value)));
  const values = numericRows.map((row) => Number(row.value));
  const currentAverage = average(values);
  const currentMinimum = values.length ? Math.min(...values) : null;
  const currentMaximum = values.length ? Math.max(...values) : null;
  const minimumMonths = currentMinimum === null
    ? []
    : [...new Set(numericRows.filter((row) => Number(row.value) === currentMinimum).map((row) => row.date.slice(0, 7)))].sort();
  const maximumMonths = currentMaximum === null
    ? []
    : [...new Set(numericRows.filter((row) => Number(row.value) === currentMaximum).map((row) => row.date.slice(0, 7)))].sort();

  return {
    average: currentAverage,
    minimum: currentMinimum,
    maximum: currentMaximum,
    minimumMonths,
    maximumMonths,
    observedMonths: observedMonthKeys.size,
    expectedMonths,
  };
}

/** Formate le ou les mois où le maximum de la sélection a été observé. */
export function maximumPeriodNote(months: string[], locale = 'fr-FR', language: 'fr' | 'en' = 'fr'): string {
  const labels = months.map((month) => formatMonth(month, true, locale));
  if (labels.length === 0) return language === 'en' ? 'No maximum observed in this selection' : 'Aucun maximum observé dans cette sélection';
  if (labels.length === 1) return language === 'en' ? `Month of the observed maximum: ${labels[0]}` : `Mois du maximum observé : ${labels[0]}`;

  const visibleLabels = labels.slice(0, 3);
  const remaining = labels.length - visibleLabels.length;
  const suffix = remaining > 0
    ? language === 'en' ? `, and ${remaining} more` : `, et ${remaining} autre${remaining === 1 ? '' : 's'}`
    : '';
  return language === 'en'
    ? `Tied months: ${visibleLabels.join(', ')}${suffix}`
    : `Mois ex æquo : ${visibleLabels.join(', ')}${suffix}`;
}

/** Formate le ou les mois où le minimum de la sélection a été observé. */
export function minimumPeriodNote(months: string[], locale = 'fr-FR', language: 'fr' | 'en' = 'fr'): string {
  const labels = months.map((month) => formatMonth(month, true, locale));
  if (labels.length === 0) return language === 'en' ? 'No minimum observed in this selection' : 'Aucun minimum observé dans cette sélection';
  if (labels.length === 1) return language === 'en' ? `Month of the observed minimum: ${labels[0]}` : `Mois du minimum observé : ${labels[0]}`;

  const visibleLabels = labels.slice(0, 3);
  const remaining = labels.length - visibleLabels.length;
  const suffix = remaining > 0
    ? language === 'en' ? `, and ${remaining} more` : `, et ${remaining} autre${remaining === 1 ? '' : 's'}`
    : '';
  return language === 'en'
    ? `Tied months for the minimum: ${visibleLabels.join(', ')}${suffix}`
    : `Mois ex æquo pour le minimum : ${visibleLabels.join(', ')}${suffix}`;
}

/** Résout un raccourci de période dans la couverture réelle du dataset. */
export function periodForPreset(metadata: DatasetMetadata, preset: PeriodPreset): Period {
  const end = metadata.end;
  if (preset === 'all') return { start: metadata.start, end };
  const duration = Number.parseInt(preset, 10);
  const startIndex = Math.max(monthIndex(metadata.start), monthIndex(end) - duration + 1);
  return { start: monthFromIndex(startIndex), end };
}

/** Protège l’export CSV des cellules interprétées comme formules par un tableur. */
function safeCsvCell(value: unknown): string {
  const safe = String(value ?? '').replace(/^\s*([=+\-@])/, "'$1");
  return `"${safe.replaceAll('"', '""')}"`;
}

/** Sérialise les mêmes lignes affichées avec leurs unités et leur provenance. */
export function csvContentForRows(rows: Observation[], metadata: DatasetMetadata): string {
  const header = ['date', 'zone', 'indicateur', 'variable', 'valeur', 'unite', 'source'];
  const records = rows.map((row) => [
    row.date,
    row.sector,
    metadata.label,
    metadata.variable,
    row.value,
    metadata.unit,
    metadata.source,
  ]);
  return `\ufeff${[header, ...records].map((record) => record.map(safeCsvCell).join(';')).join('\r\n')}`;
}

/** Déclenche le téléchargement du CSV puis libère l’URL temporaire du blob. */
export function downloadCsv(rows: Observation[], metadata: DatasetMetadata): void {
  const csv = csvContentForRows(rows, metadata);
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const slug = metadata.kind.replace(/[^a-z0-9_-]/gi, '_');
  const link = document.createElement('a');
  link.href = url;
  link.download = `douala_${slug}_${rows[0]?.date?.slice(0, 7) ?? 'sans-donnee'}_${rows.at(-1)?.date?.slice(0, 7) ?? ''}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
