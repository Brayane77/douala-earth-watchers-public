/** Présente le backtest T2M quotidien pré-calculé, ses baselines, horizons et exports reproductibles. */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Activity, AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Database, Download, Info, LoaderCircle, Waves } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ThemeToggle } from '../components/ThemeToggle';
import { fetchDailyT2MValidation, type DailyValidationPrediction } from '../lib/api';

// Déclare les métadonnées de la route de validation indépendante de la page Sources.
export const Route = createFileRoute('/validation-scientifique')({
  head: () => ({
    meta: [
      { title: 'Validation scientifique — Douala Earth Watchers' },
      { name: 'description', content: 'Backtest chronologique quotidien de T2M, comparé à la persistance et à la baseline saisonnière, avec MAE, RMSE, N et empreintes.' },
    ],
  }),
  component: ValidationPage,
});

// Affiche le rapport statique issu du script de pré-calcul hors ligne.
function ValidationPage() {
  const validation = useQuery({
    queryKey: ['validation-t2m-daily'],
    queryFn: ({ signal }) => fetchDailyT2MValidation(signal),
    staleTime: 5 * 60 * 1000,
  });
  const [selectedHorizon, setSelectedHorizon] = useState<1 | 2 | 3>(1);

  // Sélectionne uniquement les prédictions du même horizon que le graphique.
  const chartRows = useMemo(() => validation.data?.validation.predictions
    .filter((row) => row.horizon_days === selectedHorizon)
    .map(toChartRow) ?? [], [validation.data, selectedHorizon]);

  return (
    <div className="sources-page-shell forecast-page-shell">
      <header className="topbar sources-topbar">
        <Link className="brand-lockup" to="/">
          <span className="brand-mark"><Waves size={23} aria-hidden="true" /></span>
          <span className="brand-copy">
            <strong>Douala Earth Watchers</strong>
            <small>Validation scientifique</small>
          </span>
        </Link>
        <div className="sources-header-actions">
          <Link to="/previsions" className="back-link"><ArrowLeft size={15} aria-hidden="true" /> Prévisions et alertes</Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="sources-content forecast-content">
        <div className="sources-page-intro">
          <div>
            <span className="eyebrow">BACKTEST CHRONOLOGIQUE · NASA POWER T2M</span>
            <h1>Validation scientifique</h1>
            <p>Résultats historiques hors échantillon, distincts de la validation structurelle des fichiers et de toute prévision actuelle.</p>
          </div>
          <Link to="/sources" className="back-link">Voir les sources <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>

        {validation.isPending ? (
          <div className="panel forecast-loading" role="status"><LoaderCircle className="spin" size={19} aria-hidden="true" /> Chargement du rapport de validation pré-calculé…</div>
        ) : validation.isError || !validation.data ? (
          <section className="panel forecast-error" role="alert">
            <AlertTriangle size={20} aria-hidden="true" />
            <div><strong>Rapport de validation indisponible</strong><p>{validation.error instanceof Error ? validation.error.message : 'Aucun artefact pré-calculé n’a été fourni.'}</p></div>
          </section>
        ) : (
          <ValidationReport
            runId={validation.data.run_id}
            sourceHash={validation.data.source.sha256}
            codeHash={validation.data.code_sha256}
            sourceStart={validation.data.source.source_period.start}
            sourceEnd={validation.data.source.source_period.end}
            timeStandard={validation.data.source.time_standard}
            latestDate={validation.data.latest_observation.date}
            metricsByHorizon={validation.data.validation.metrics_by_horizon}
            validationStart={validation.data.validation.period.start}
            validationEnd={validation.data.validation.period.end}
            method={validation.data.validation.method}
            candidateStatus={validation.data.validation.candidate_status}
            uncertainty={validation.data.validation.uncertainty}
            stationValidation={validation.data.validation.station_validation}
            predictions={validation.data.validation.predictions}
            chartRows={chartRows}
            selectedHorizon={selectedHorizon}
            onSelectHorizon={setSelectedHorizon}
          />
        )}

        <footer className="app-footer sources-footer">
          <span><strong>Douala Earth Watchers</strong> · validation d’un produit de réanalyse</span>
          <span>Scores T2M en °C · pas de MAPE ni d’incertitude simulée</span>
        </footer>
      </main>
    </div>
  );
}

// Formate une prédiction de backtest pour les axes et infobulles Recharts.
function toChartRow(row: DailyValidationPrediction) {
  return {
    valid_date: row.valid_date,
    observed: row.observed_c,
    candidate: row.ridge_candidate_c,
    persistence: row.persistence_c,
    seasonal: row.seasonal_baseline_c,
  };
}

// Présente les tableaux, le graphique, la configuration et les empreintes du même artefact API.
function ValidationReport({
  runId,
  sourceHash,
  codeHash,
  sourceStart,
  sourceEnd,
  timeStandard,
  latestDate,
  metricsByHorizon,
  validationStart,
  validationEnd,
  method,
  candidateStatus,
  uncertainty,
  stationValidation,
  predictions,
  chartRows,
  selectedHorizon,
  onSelectHorizon,
}: {
  runId: string;
  sourceHash: string;
  codeHash: string;
  sourceStart: string;
  sourceEnd: string;
  timeStandard: string;
  latestDate: string;
  metricsByHorizon: Record<string, {
    horizon_days: number;
    n: number;
    origin_period: { start: string; end: string };
    validation_period: { start: string; end: string };
    training_examples: { min: number; max: number };
    models: {
      ridge_candidate: { mae: number; rmse: number };
      persistence: { mae: number; rmse: number };
      seasonal_baseline: { mae: number; rmse: number };
    };
  }>;
  validationStart: string;
  validationEnd: string;
  method: string;
  candidateStatus: string;
  uncertainty: string;
  stationValidation: string;
  predictions: DailyValidationPrediction[];
  chartRows: ReturnType<typeof toChartRow>[];
  selectedHorizon: 1 | 2 | 3;
  onSelectHorizon: (horizon: 1 | 2 | 3) => void;
}) {
  const horizons = [1, 2, 3] as const;

  return (
    <>
      <section className="panel validation-panel forecast-validation-summary" aria-labelledby="validation-summary-title">
        <div className="panel-heading">
          <div>
            <div className="section-title"><CheckCircle2 size={19} aria-hidden="true" /><h2 id="validation-summary-title">Backtest prêt · résultats historiques</h2></div>
            <p>{method}</p>
          </div>
          <span className="validation-count validation-count-ok">Artefact vérifié</span>
        </div>
        <div className="validation-rule-grid forecast-manifest-grid">
          <div><strong>Source / période</strong><span>NASA POWER/MERRA-2 T2M · {sourceStart} à {sourceEnd} · {timeStandard}</span></div>
          <div><strong>Test terminal</strong><span>{validationStart} à {validationEnd}; une fenêtre croissante à chaque origine.</span></div>
          <div><strong>Provenance source</strong><span>SHA-256 <code>{sourceHash}</code>; récupération non documentée. Dernière date : {latestDate}.</span></div>
          <div><strong>Configuration / code</strong><span>Run <code>{runId}</code> · code SHA-256 <code>{codeHash}</code>.</span></div>
          <div><strong>Baseline persistance</strong><span>Dernière T2M connue à l’origine, maintenue sur l’horizon demandé.</span></div>
          <div><strong>Baseline saisonnière</strong><span>Observation à la date cible moins 365 jours; uniquement si elle est disponible à l’origine.</span></div>
        </div>
        <p className="validation-note"><Info size={15} aria-hidden="true" />{candidateStatus} {uncertainty} {stationValidation}</p>
      </section>

      <section className="panel scientific-metrics-panel" aria-labelledby="metrics-title">
        <div className="panel-heading">
          <div>
            <div className="section-title"><Activity size={19} aria-hidden="true" /><h2 id="metrics-title">Scores hors échantillon par horizon</h2></div>
            <p>MAE et RMSE en °C; N, période des origines et dates valides publiés pour chaque comparaison.</p>
          </div>
          <div className="forecast-export-actions">
            <a className="export-button" href="/api/validation/t2m-daily/export.csv" download><Download size={14} aria-hidden="true" /> CSV</a>
            <a className="export-button" href="/api/validation/t2m-daily/export.json" download><Download size={14} aria-hidden="true" /> JSON</a>
          </div>
        </div>
        <div className="scientific-table-wrap">
          <table className="scientific-table">
            <thead>
              <tr>
                <th>Horizon</th><th>N</th><th>Période valide</th><th>Modèle candidat MAE / RMSE</th><th>Persistance MAE / RMSE</th><th>Saisonnière MAE / RMSE</th>
              </tr>
            </thead>
            <tbody>
              {horizons.map((horizon) => {
                const metric = metricsByHorizon[String(horizon)];
                if (!metric) return null;
                return (
                  <tr key={horizon}>
                    <th scope="row">J+{horizon}</th>
                    <td>{metric.n}</td>
                    <td>{metric.validation_period.start} — {metric.validation_period.end}</td>
                    <td>{formatError(metric.models.ridge_candidate.mae)} / {formatError(metric.models.ridge_candidate.rmse)}</td>
                    <td>{formatError(metric.models.persistence.mae)} / {formatError(metric.models.persistence.rmse)}</td>
                    <td>{formatError(metric.models.seasonal_baseline.mae)} / {formatError(metric.models.seasonal_baseline.rmse)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel scientific-chart-panel" aria-labelledby="validation-chart-title">
        <div className="panel-heading chart-heading">
          <div>
            <div className="section-title"><Database size={19} aria-hidden="true" /><h2 id="validation-chart-title">Prédictions et observations du backtest</h2></div>
            <p>Les points représentent uniquement le jeu terminal historique; aucune ligne n'est une prévision actuelle.</p>
          </div>
          <div className="horizon-switcher" role="group" aria-label="Choisir l’horizon du graphique">
            {horizons.map((horizon) => (
              <button key={horizon} type="button" className={selectedHorizon === horizon ? 'selected' : ''} aria-pressed={selectedHorizon === horizon} onClick={() => onSelectHorizon(horizon)}>J+{horizon}</button>
            ))}
          </div>
        </div>
        <div className="chart-wrap scientific-chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartRows} margin={{ top: 8, right: 12, left: 3, bottom: 4 }}>
              <CartesianGrid stroke="#e4ecef" strokeDasharray="4 4" />
              <XAxis dataKey="valid_date" tickFormatter={(value: string) => value.slice(5)} interval={30} minTickGap={20} tick={{ fill: '#728693', fontSize: 9 }} />
              <YAxis domain={['auto', 'auto']} tick={{ fill: '#728693', fontSize: 9 }} width={42} />
              <Tooltip labelFormatter={(value) => `Date valide : ${String(value)}`} formatter={(value, name) => [`${Number(value).toFixed(2)} °C`, String(name)]} />
              <Legend />
              <Line name="Observé" type="linear" dataKey="observed" stroke="#334e61" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line name="Ridge expérimental" type="linear" dataKey="candidate" stroke="#d45d37" strokeWidth={1.6} dot={false} isAnimationActive={false} />
              <Line name="Persistance" type="linear" dataKey="persistence" stroke="#2484ab" strokeWidth={1.2} dot={false} isAnimationActive={false} />
              <Line name="Baseline saisonnière" type="linear" dataKey="seasonal" stroke="#8a6ab5" strokeWidth={1.2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel validation-caveats-panel" aria-labelledby="caveats-title">
        <div className="panel-heading">
          <div>
            <div className="section-title"><AlertTriangle size={19} aria-hidden="true" /><h2 id="caveats-title">Interprétation à ne pas dépasser</h2></div>
            <p>Le rapport évalue un produit de données, pas la météo indépendante observée à Douala.</p>
          </div>
        </div>
        <div className="validation-rule-grid">
          <div><strong>Échelle spatiale</strong><span>Point de requête sur une grille MERRA-2 d’environ 0,5° × 0,625°; aucune valeur par quartier.</span></div>
          <div><strong>Archive historique</strong><span>Le CSV ne donne ni horodatage de récupération ni versions telles que publiées; les scores sont un rejeu sur la version archivée.</span></div>
          <div><strong>Pas d’alerte</strong><span>Les métriques ne deviennent ni un seuil sanitaire, ni un avis officiel, ni un risque de pluie ou d’inondation.</span></div>
        </div>
      </section>

      <section className="validation-cta-row">
        <Link to="/previsions" className="export-button"><ArrowLeft size={15} aria-hidden="true" /> Prévisions et alertes</Link>
        <Link to="/sources" className="export-button">Contrôles des sources <ArrowRight size={15} aria-hidden="true" /></Link>
      </section>
      <span className="visually-hidden" aria-live="polite">{predictions.length} prédictions historiques sont disponibles pour l’export.</span>
    </>
  );
}

// Formate une erreur à deux décimales sans la présenter comme un pourcentage de précision.
function formatError(value: number): string {
  return `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} °C`;
}
