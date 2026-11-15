/** Composant de série mensuelle : graphique d’observations avec état vide explicite. */
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity } from 'lucide-react';
import type { DatasetMetadata, Observation } from '../lib/api';
import { formatMonth, formatValue } from '../lib/climate';

/** Séries et étiquettes déjà filtrées pour le graphique mensuel. */
interface ChartPanelProps {
  rows: Observation[];
  metadata: DatasetMetadata;
  periodLabel: string;
}

/** Trace la série mensuelle filtrée et affiche une note si la sélection est vide. */
export function ChartPanel({ rows, metadata, periodLabel }: ChartPanelProps) {
  return (
    <section className="panel chart-panel" id="series">
      <div className="panel-heading chart-heading">
        <div>
          <div className="section-title"><Activity size={19} aria-hidden="true" /><h2>Évolution de la série</h2></div>
          <p>{metadata.label} · {periodLabel}</p>
        </div>
        <span className="unit-chip">{metadata.unit}</span>
      </div>

      {rows.length ? (
        <>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rows} margin={{ top: 12, right: 14, left: 2, bottom: 2 }}>
                <defs>
                  <linearGradient id="seriesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={metadata.color} stopOpacity={0.24} />
                    <stop offset="95%" stopColor={metadata.color} stopOpacity={0.015} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value: string) => formatMonth(value, true)}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={28}
                  tickMargin={11}
                />
                <YAxis
                  width={58}
                  tickFormatter={(value: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: metadata.precision }).format(value)}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  cursor={{ stroke: 'var(--border)', strokeDasharray: '4 4' }}
                  labelFormatter={(label) => formatMonth(String(label))}
                  formatter={(value) => [formatValue(Number(value), metadata), metadata.label]}
                  contentStyle={{ borderRadius: 12, borderColor: 'var(--border)', boxShadow: '0 12px 30px rgba(18, 47, 67, .12)' }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  name={metadata.label}
                  stroke={metadata.color}
                  strokeWidth={2.6}
                  fill="url(#seriesFill)"
                  activeDot={{ r: 5, strokeWidth: 2, fill: '#fff' }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend"><span className="legend-swatch" style={{ backgroundColor: metadata.color }} />{metadata.label}<span className="legend-context">· {metadata.source}</span></div>
        </>
      ) : (
        <div className="chart-empty" role="status">Aucune observation pour cette zone et cette période.</div>
      )}
    </section>
  );
}
