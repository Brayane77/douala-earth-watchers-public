/**
 * Analyse descriptive de la tendance mensuelle : pente ajustée sur les mois
 * réellement présents, dispersion autour de la droite et limites explicites.
 *
 * Le panneau ne projette aucune valeur future et n’ajoute aucun mois absent du CSV.
 */
import { useMemo } from 'react';
import { AlertTriangle, Info, TrendingUp } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DatasetMetadata, Observation } from '../lib/api';
import { formatMonth, formatUnit, formatValue } from '../lib/climate';
import { useTranslation } from '../lib/i18n';
import { fittedValue, linearTrend } from '../lib/trend';

interface TrendAnalysisPanelProps {
  observations: Observation[];
  metadata: DatasetMetadata;
  isVegetationProduct: boolean;
}

/** Formate une pente avec son unité d’origine pour rester comparable aux valeurs. */
function formatSlope(value: number | null, metadata: DatasetMetadata, locale: string, language: 'fr' | 'en'): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const digits = Math.max(metadata.precision, 2);
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: 'exceptZero',
  }).format(value);
  return `${formatted} ${formatUnit(metadata.unit, language)}`;
}

/** Présente la tendance calculée, son graphique et les limites d’interprétation. */
export function TrendAnalysisPanel({ observations, metadata, isVegetationProduct }: TrendAnalysisPanelProps) {
  const { t, intlLocale, language } = useTranslation();
  const trend = useMemo(() => linearTrend(observations), [observations]);

  const chartRows = useMemo(() => trend.points.map((point) => ({
    month: point.month,
    observed: point.value,
    fitted: fittedValue(trend, point.index),
  })), [trend]);

  const slopePerDecade = trend.slopePerDecade;
  const signalLabel = trend.isSignal
    ? t('Pente supérieure au double de son erreur-type', 'Slope exceeds twice its standard error')
    : t('Pente non distinguable du bruit sur ces mois', 'Slope not distinguishable from noise over these months');

  return (
    <section className="panel trend-analysis-panel" id="trends" aria-labelledby="trend-title">
      <div className="panel-heading">
        <div>
          <div className="section-title"><TrendingUp size={19} aria-hidden="true" /><h2 id="trend-title">{t('Tendance observée', 'Observed trend')}</h2></div>
          <p>{t(
            `Ajustement linéaire sur ${trend.months} mois réellement présents dans le CSV, sans interpolation ni projection.`,
            `Linear fit over the ${trend.months} months actually present in the CSV, without interpolation or projection.`,
          )}</p>
        </div>
        <span className="unit-chip">{formatUnit(metadata.unit, language)}</span>
      </div>

      {isVegetationProduct ? (
        <div className="trend-message" role="note">
          <Info size={15} aria-hidden="true" />
          <p>{t(
            'Aucune tendance n’est calculée pour l’archive MODIS : ses composites de 16 jours ne se comparent pas aux séries mensuelles.',
            'No trend is computed for the MODIS archive: its 16-day composites are not comparable with the monthly series.',
          )}</p>
        </div>
      ) : trend.months < 3 ? (
        <div className="trend-message" role="status">
          <Info size={15} aria-hidden="true" />
          <p>{t(
            'Au moins trois mois sont nécessaires pour ajuster une tendance; cette sélection en contient moins.',
            'At least three months are needed to fit a trend; this selection has fewer.',
          )}</p>
        </div>
      ) : (
        <>
          <div className="trend-summary-grid">
            <div className={`trend-stat ${trend.isSignal ? 'trend-stat-signal' : ''}`}>
              <span>{t('Pente par décennie', 'Slope per decade')}</span>
              <strong>{formatSlope(slopePerDecade, metadata, intlLocale, language)}</strong>
              <small>{signalLabel}</small>
            </div>
            <div className="trend-stat">
              <span>{t('Dispersion autour de la droite', 'Scatter around the fit')}</span>
              <strong>{formatValue(trend.residualStdDev, metadata, intlLocale, language)}</strong>
              <small>{t('Écart-type des résidus', 'Standard deviation of residuals')}</small>
            </div>
            <div className="trend-stat">
              <span>{t('Mois utilisés', 'Months used')}</span>
              <strong>{trend.months.toLocaleString(intlLocale)}</strong>
              <small>{t('Un point par mois observé', 'One point per observed month')}</small>
            </div>
          </div>

          <div className="trend-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartRows} margin={{ top: 12, right: 16, left: 2, bottom: 2 }}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickFormatter={(value: string) => formatMonth(value, true, intlLocale)}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={26}
                  tickMargin={10}
                />
                <YAxis
                  width={58}
                  tickFormatter={(value: number) => new Intl.NumberFormat(intlLocale, { maximumFractionDigits: metadata.precision }).format(value)}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  cursor={{ stroke: 'var(--border)', strokeDasharray: '4 4' }}
                  labelFormatter={(label) => formatMonth(String(label), false, intlLocale)}
                  formatter={(value, name) => [formatValue(Number(value), metadata, intlLocale, language), name]}
                  contentStyle={{ borderRadius: 12, borderColor: 'var(--border)', boxShadow: '0 12px 30px rgba(18, 47, 67, .12)' }}
                />
                <Line
                  type="monotone"
                  dataKey="observed"
                  name={t('Valeurs observées', 'Observed values')}
                  stroke="#6578d9"
                  strokeWidth={2.4}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="linear"
                  dataKey="fitted"
                  name={t('Droite ajustée', 'Fitted line')}
                  stroke="#d97706"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="trend-legend">
            <span><i className="trend-legend-observed" />{t('Valeurs observées', 'Observed values')}</span>
            <span><i className="trend-legend-fit" />{t('Droite ajustée', 'Fitted line')}</span>
          </div>

          <div className="trend-method-note">
            <Info size={15} aria-hidden="true" />
            <p>{t(
              'Moindres carrés ordinaires sur les seuls mois reçus; l’erreur-type de la pente indique si le signal se distingue du bruit.',
              'Ordinary least squares over the received months only; the slope standard error tells whether the signal stands out from noise.',
            )}</p>
          </div>

          {!trend.isSignal && (
            <div className="trend-message trend-warning" role="note">
              <AlertTriangle size={15} aria-hidden="true" />
              <p><strong>{t('Lecture prudente', 'Read with caution')}</strong> {language === 'en'
                ? 'Over this selection the estimated slope is within the range explainable by month-to-month variability. Treat it as descriptive, not as proof of a climate trend.'
                : 'Sur cette sélection, la pente estimée reste dans la variabilité expliquée par les écarts d’un mois à l’autre. Elle est descriptive et ne prouve pas une tendance climatique.'}</p>
            </div>
          )}

          <div className="trend-limits">
            <strong>{t('Limites de ce calcul', 'Limits of this calculation')}</strong>
            <ul>
              <li>{t('Aucune valeur future n’est produite ni affichée.', 'No future value is produced or displayed.')}</li>
              <li>{t('La pente décrit la période affichée seulement; elle ne vaut pas pour un autre horizon.', 'The slope describes the displayed period only; it does not hold for another horizon.')}</li>
              <li>{t('Une tendance linéaire ne restitue ni saisonnalité ni rupture de série.', 'A linear trend captures neither seasonality nor a break in the series.')}</li>
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
