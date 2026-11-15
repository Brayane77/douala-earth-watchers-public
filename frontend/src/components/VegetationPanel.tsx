/** Série MODIS de végétation séparée, affichée sur ses dates composites natives avec QA. */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Info, Leaf, RefreshCw } from 'lucide-react';
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchModisVegetationArchive } from '../lib/api';
import type { ModisVegetationObservation } from '../lib/api';

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

const formatNumber = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 });

/** Formate une date de composite sans conversion vers un jour local différent. */
function formatCompositeDate(date: string): string {
  const timestamp = Date.parse(`${date}T12:00:00Z`);
  if (!Number.isFinite(timestamp)) return date;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' }).format(timestamp);
}

/** Formate l’axe temporel en ne marquant que les mois des composites présents. */
function formatAxisDate(value: number): string {
  return new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(value);
}

/** Infobulle qui rattache chaque valeur NDVI/EVI à sa date et aux QA d’origine. */
function VegetationTooltip({ active, payload }: VegetationTooltipProps) {
  const point = payload?.find((entry) => entry.payload)?.payload;
  if (!active || !point) return null;

  return (
    <div className="vegetation-tooltip">
      <strong>{formatCompositeDate(point.date)}</strong>
      <span>NDVI · {formatNumber.format(point.ndvi)}</span>
      <span>EVI · {formatNumber.format(point.evi)}</span>
      <span>QA rang {point.qa_rank} · {point.qa_label}</span>
      <small>{point.vi_quality}</small>
      <small>Masque · {point.land_water_mask}</small>
    </div>
  );
}

/** Charge l’archive locale DV et n’ajoute aucun point entre les composites. */
export function VegetationPanel() {
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
          <div className="section-title"><Leaf size={19} aria-hidden="true" /><h2 id="vegetation-title">Végétation observée · MODIS DV</h2></div>
          <p>NDVI et EVI ponctuels, distincts des séries climatiques mensuelles.</p>
        </div>
        <span className="source-tag">MOD13Q1.061</span>
      </div>

      {archive.isPending ? (
        <p className="vegetation-state" role="status">Chargement des composites MODIS locaux…</p>
      ) : archive.isError || !archive.data ? (
        <div className="vegetation-error" role="alert">
          <p>{archive.error instanceof Error ? archive.error.message : 'L’archive MODIS est indisponible; aucune valeur de remplacement n’est affichée.'}</p>
          <button type="button" className="vegetation-retry" onClick={() => { void archive.refetch(); }}>
            <RefreshCw size={14} aria-hidden="true" /> Réessayer
          </button>
        </div>
      ) : (
        <>
          <div className="vegetation-summary">
            <div><span>Point de référence</span><strong>{archive.data.metadata.latitude.toFixed(2)}°N · {archive.data.metadata.longitude.toFixed(2)}°E</strong></div>
            <div><span>Composites reçus</span><strong>{archive.data.metadata.record_count}</strong></div>
            <div><span>Fréquence native</span><strong>{archive.data.metadata.temporal_resolution_days} jours · {archive.data.metadata.spatial_resolution_m} m</strong></div>
            <div><span>Couverture effective</span><strong>{archive.data.metadata.start} — {archive.data.metadata.end}</strong></div>
          </div>

          <div className="vegetation-chart" role="region" aria-label="Nuage de points des valeurs NDVI et EVI des composites MODIS">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 12, right: 18, left: 4, bottom: 6 }}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false} />
                <XAxis
                  type="number"
                  dataKey="timestamp"
                  name="Date du composite"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={formatAxisDate}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={30}
                />
                <YAxis
                  type="number"
                  name="Indice sans unité"
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

          <div className="vegetation-legend" aria-label="Légende des indices">
            <span><i className="vegetation-swatch vegetation-swatch-ndvi" />NDVI</span>
            <span><i className="vegetation-swatch vegetation-swatch-evi" />EVI</span>
            <small>Chaque point correspond à une date composite présente dans le CSV.</small>
          </div>

          <div className="vegetation-qa-grid" aria-label="Comptes des classes de qualité MODIS">
            <div className="qa-good"><span>QA bonne · rang 0</span><strong>{archive.data.metadata.quality_counts.good}</strong></div>
            <div className="qa-marginal"><span>QA marginale · rang 1</span><strong>{archive.data.metadata.quality_counts.marginal}</strong></div>
            <div className="qa-snow"><span>Neige/glace · rang 2</span><strong>{archive.data.metadata.quality_counts.snow_ice}</strong></div>
            <div className="qa-cloudy"><span>QA nuageuse · rang 3</span><strong>{archive.data.metadata.quality_counts.cloudy}</strong></div>
            <div className="qa-nodata"><span>Sans données · rang −1</span><strong>{archive.data.metadata.quality_counts.no_data}</strong></div>
          </div>

          <p className="validation-note vegetation-warning"><AlertTriangle size={15} aria-hidden="true" />Tous les composites sont affichés, y compris ceux classés nuageux. Les QA sont visibles au survol; le graphique n’ajoute aucun jour entre les dates du produit.</p>
          <p className="source-note vegetation-source-note"><Info size={15} aria-hidden="true" />Masque côtier : {archive.data.metadata.land_water_mask_counts['Ocean coastlines and lake shorelines'] ?? 0} composites classés « Ocean coastlines and lake shorelines ». {archive.data.metadata.status_warning} Les indices restent hors des statistiques T2M et des prévisions.</p>
        </>
      )}
    </section>
  );
}
