/** Série MODIS de végétation séparée, affichée sur ses dates composites natives avec QA. */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Leaf, RefreshCw } from 'lucide-react';
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchModisVegetationArchive } from '../lib/api';
import type { ModisVegetationObservation } from '../lib/api';
import { useTranslation } from '../lib/i18n';

/** Observation MODIS et position numérique réservée au tracé temporel. */
interface VegetationPoint extends ModisVegetationObservation {
  timestamp: number;
}

/** Forme d’une entrée Recharts reçue par l’infobulle personnalisée. */
interface VegetationTooltipEntry {
  payload?: VegetationPoint;
}

/** État actif et valeurs éventuelles fournis par Recharts au survol. */
interface VegetationTooltipProps {
  active?: boolean;
  payload?: VegetationTooltipEntry[];
}

/** Formate une date de composite sans conversion vers un jour local différent. */
function formatCompositeDate(date: string, locale: string): string {
  const timestamp = Date.parse(`${date}T12:00:00Z`);
  if (!Number.isFinite(timestamp)) return date;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(timestamp);
}

/** Formate l’axe temporel en ne marquant que les mois des composites présents. */
function formatAxisDate(value: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(value);
}

/** Infobulle qui rattache chaque valeur NDVI/EVI à sa date et aux QA d’origine. */
function VegetationTooltip({ active, payload }: VegetationTooltipProps) {
  const { t, intlLocale } = useTranslation();
  const formatNumber = new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 4 });
  const point = payload?.find((entry) => entry.payload)?.payload;
  if (!active || !point) return null;

  return (
    <div className="vegetation-tooltip">
      <strong>{formatCompositeDate(point.date, intlLocale)}</strong>
      <span>NDVI · {formatNumber.format(point.ndvi)}</span>
      <span>EVI · {formatNumber.format(point.evi)}</span>
      <span>{t('QA rang', 'QA rank')} {point.qa_rank} · {point.qa_label}</span>
      <small>{point.vi_quality}</small>
      <small>{t('Masque', 'Mask')} · {point.land_water_mask}</small>
    </div>
  );
}

/** Charge l’archive locale DV et n’ajoute aucun point entre les composites. */
export function VegetationPanel() {
  const { t, intlLocale } = useTranslation();
  const archive = useQuery({
    queryKey: ['modis-vegetation-dv'],
    queryFn: ({ signal }) => fetchModisVegetationArchive(signal),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const observations = archive.data?.observations ?? [];
  const points = useMemo(() => observations.map((observation) => ({
    ...observation,
    timestamp: Date.parse(`${observation.date}T12:00:00Z`),
  })), [observations]);
  const valueDomain = useMemo<[number, number]>(() => {
    const values = points.flatMap((point) => [point.ndvi, point.evi]);
    if (values.length === 0) return [0, 1];
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const padding = Math.max((maximum - minimum) * 0.04, 0.0001);
    return [minimum - padding, maximum + padding];
  }, [points]);

  return (
    <section className="panel vegetation-panel" id="vegetation" aria-labelledby="vegetation-title">
      <div className="panel-heading">
        <div>
          <div className="section-title"><Leaf size={19} aria-hidden="true" /><h2 id="vegetation-title">{t('Végétation observée · MODIS DV', 'Observed vegetation · MODIS DV')}</h2></div>
          <p>{t('NDVI et EVI ponctuels, distincts des séries climatiques mensuelles.', 'Point NDVI and EVI, kept separate from the monthly climate series.')}</p>
        </div>
        <span className="source-tag">MOD13Q1.061</span>
      </div>

      {archive.isPending ? (
        <p className="vegetation-state" role="status">{t('Chargement des composites MODIS locaux…', 'Loading local MODIS composites…')}</p>
      ) : archive.isError || !archive.data ? (
        <div className="vegetation-error" role="alert">
          <p>{archive.error instanceof Error ? archive.error.message : t('L’archive MODIS est indisponible; aucune valeur de remplacement n’est affichée.', 'The MODIS archive is unavailable; no replacement value is displayed.')}</p>
          <button type="button" className="vegetation-retry" onClick={() => { void archive.refetch(); }}>
            <RefreshCw size={14} aria-hidden="true" /> {t('Réessayer', 'Retry')}
          </button>
        </div>
      ) : (
        <>
          <div className="vegetation-summary">
            <div><span>{t('Point de référence', 'Reference point')}</span><strong>{archive.data.metadata.latitude.toFixed(2)}°N · {archive.data.metadata.longitude.toFixed(2)}°E</strong></div>
            <div><span>{t('Composites reçus', 'Composites received')}</span><strong>{archive.data.metadata.record_count}</strong></div>
            <div><span>{t('Fréquence native', 'Native frequency')}</span><strong>{archive.data.metadata.temporal_resolution_days} {t('jours', 'days')} · {archive.data.metadata.spatial_resolution_m} m</strong></div>
            <div><span>{t('Couverture effective', 'Effective coverage')}</span><strong>{archive.data.metadata.start} — {archive.data.metadata.end}</strong></div>
          </div>

          <div className="vegetation-chart" role="region" aria-label={t('Nuage de points des valeurs NDVI et EVI des composites MODIS', 'Scatter plot of NDVI and EVI values from the MODIS composites')}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 12, right: 18, left: 4, bottom: 6 }}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false} />
                <XAxis
                  type="number"
                  dataKey="timestamp"
                  name={t('Date du composite', 'Composite date')}
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(value: number) => formatAxisDate(value, intlLocale)}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={30}
                />
                <YAxis
                  type="number"
                  name={t('Indice sans unité', 'Unitless index')}
                  domain={valueDomain}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={48}
                />
                <Tooltip
                  content={<VegetationTooltip />}
                  cursor={{ stroke: 'var(--border)', strokeDasharray: '4 4' }}
                />
                <Scatter name="NDVI" data={points} dataKey="ndvi" fill="#38b99a" shape="circle" />
                <Scatter name="EVI" data={points} dataKey="evi" fill="#8175ed" shape="circle" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div className="vegetation-legend" aria-label={t('Légende des indices', 'Index legend')}>
            <span><i className="vegetation-swatch vegetation-swatch-ndvi" />NDVI</span>
            <span><i className="vegetation-swatch vegetation-swatch-evi" />EVI</span>
            <small>{t('Chaque point correspond à une date composite présente dans le CSV.', 'Each point matches a composite date present in the CSV.')}</small>
          </div>

          <div className="vegetation-qa-grid" aria-label={t('Comptes des classes de qualité MODIS', 'MODIS quality class counts')}>
            <div className="qa-good"><span>{t('QA bonne', 'Good QA')} · {t('rang', 'rank')} 0</span><strong>{archive.data.metadata.quality_counts.good}</strong></div>
            <div className="qa-marginal"><span>{t('QA marginale', 'Marginal QA')} · {t('rang', 'rank')} 1</span><strong>{archive.data.metadata.quality_counts.marginal}</strong></div>
            <div className="qa-snow"><span>{t('Neige/glace', 'Snow/ice')} · {t('rang', 'rank')} 2</span><strong>{archive.data.metadata.quality_counts.snow_ice}</strong></div>
            <div className="qa-cloudy"><span>{t('QA nuageuse', 'Cloudy QA')} · {t('rang', 'rank')} 3</span><strong>{archive.data.metadata.quality_counts.cloudy}</strong></div>
            <div className="qa-nodata"><span>{t('Sans données', 'No data')} · {t('rang', 'rank')} −1</span><strong>{archive.data.metadata.quality_counts.no_data}</strong></div>
          </div>

          <p className="validation-note vegetation-warning"><AlertTriangle size={15} aria-hidden="true" />{t(`${archive.data.metadata.land_water_mask_counts['Ocean coastlines and lake shorelines'] ?? 0} composites sur ${archive.data.metadata.record_count} portent le masque « Ocean coastlines and lake shorelines ». Tous les composites sont affichés, y compris ceux classés nuageux; les QA sont visibles au survol et aucun jour n’est ajouté entre les dates du produit.`, `${archive.data.metadata.land_water_mask_counts['Ocean coastlines and lake shorelines'] ?? 0} of ${archive.data.metadata.record_count} composites carry the “Ocean coastlines and lake shorelines” mask. Every composite is displayed, including cloudy ones; QA is visible on hover and no day is added between product dates.`)} {archive.data.metadata.status_warning}</p>
        </>
      )}
    </section>
  );
}
