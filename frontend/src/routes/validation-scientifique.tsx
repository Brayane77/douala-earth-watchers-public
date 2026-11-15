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
import { LanguageToggle } from '../components/LanguageToggle';
import { ThemeToggle } from '../components/ThemeToggle';
import brandLogo from '../assets/logo-dew.svg';
import { fetchDailyT2MValidation, type DailyValidationPrediction } from '../lib/api';
import { useTranslation } from '../lib/i18n';

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
  const { t } = useTranslation();
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
    <div className="sources-page-shell">
      <header className="topbar sources-topbar">
        <Link className="brand-lockup" to="/">
          <span className="brand-mark"><img className="brand-logo" src={brandLogo} alt="" aria-hidden="true" /></span>
          <span className="brand-copy">
            <strong>Douala Earth Watchers</strong>
            <small>{t('Validation scientifique', 'Scientific validation')}</small>
          </span>
        </Link>
        <div className="sources-header-actions">
          <Link to="/previsions" className="back-link"><ArrowLeft size={15} aria-hidden="true" /> {t('Prévisions et alertes', 'Forecasts and alerts')}</Link>
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      <main className="sources-content forecast-content">
        <div className="sources-page-intro">
          <div>
            <span className="eyebrow">{t('BACKTEST CHRONOLOGIQUE · NASA POWER T2M', 'CHRONOLOGICAL BACKTEST · NASA POWER T2M')}</span>
            <h1>{t('Validation scientifique', 'Scientific validation')}</h1>
            <p>{t('Résultats hors échantillon, comparés à la persistance et à la baseline saisonnière.', 'Out-of-sample results, compared with persistence and the seasonal baseline.')}</p>
          </div>
          <Link to="/sources" className="back-link">{t('Voir les sources', 'View the sources')} <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>

        {validation.isPending ? (
          <div className="panel forecast-loading" role="status"><LoaderCircle className="spin" size={19} aria-hidden="true" /> {t('Chargement du rapport de validation pré-calculé…', 'Loading the pre-computed validation report…')}</div>
        ) : validation.isError || !validation.data ? (
          <section className="panel forecast-error" role="alert">
            <AlertTriangle size={20} aria-hidden="true" />
            <div><strong>{t('Rapport de validation indisponible', 'Validation report unavailable')}</strong><p>{validation.error instanceof Error ? validation.error.message : t('Aucun artefact pré-calculé n’a été fourni.', 'No pre-computed artifact was provided.')}</p></div>
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
          <span><strong>Douala Earth Watchers</strong> · {t('validation d’un produit de réanalyse', 'validation of a reanalysis product')}</span>
          <span>{t('Scores T2M en °C · pas de MAPE ni d’incertitude simulée', 'T2M scores in °C · no MAPE and no simulated uncertainty')}</span>
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
  const { t } = useTranslation();
  const horizons = [1, 2, 3] as const;

  return (
    <>
      <section className="panel validation-panel" aria-labelledby="validation-summary-title">
        <div className="panel-heading">
          <div>
            <div className="section-title"><CheckCircle2 size={19} aria-hidden="true" /><h2 id="validation-summary-title">{t('Backtest prêt · résultats historiques', 'Backtest ready · historical results')}</h2></div>
            <p>{method}</p>
          </div>
          <span className="validation-count validation-count-ok">{t('Artefact vérifié', 'Artifact verified')}</span>
        </div>
        <div className="validation-rule-grid forecast-manifest-grid">
          <div><strong>{t('Source / période', 'Source / period')}</strong><span>NASA POWER/MERRA-2 T2M · {sourceStart} {t('à', 'to')} {sourceEnd} · {timeStandard}</span></div>
          <div><strong>{t('Test terminal', 'Hold-out test')}</strong><span>{validationStart} {t('à', 'to')} {validationEnd}; {t('une fenêtre croissante à chaque origine.', 'an expanding window at each origin.')}</span></div>
          <div><strong>{t('Provenance source', 'Source provenance')}</strong><span>SHA-256 <code>{sourceHash}</code>; {t('récupération non documentée. Dernière date', 'retrieval undocumented. Latest date')} : {latestDate}.</span></div>
          <div><strong>{t('Configuration / code', 'Configuration / code')}</strong><span>Run <code>{runId}</code> · code SHA-256 <code>{codeHash}</code>.</span></div>
          <div><strong>{t('Baseline persistance', 'Persistence baseline')}</strong><span>{t('Dernière T2M connue à l’origine, maintenue sur l’horizon demandé.', 'Latest T2M known at the origin, held over the requested horizon.')}</span></div>
          <div><strong>{t('Baseline saisonnière', 'Seasonal baseline')}</strong><span>{t('Observation à la date cible moins 365 jours; uniquement si elle est disponible à l’origine.', 'Observation at the target date minus 365 days; only when available at the origin.')}</span></div>
        </div>
        <p className="validation-note"><Info size={15} aria-hidden="true" />{candidateStatus} {uncertainty} {stationValidation} {t('Les scores sont un rejeu de la version archivée; le CSV ne fournit ni horodatage de récupération ni versions publiées.', 'The scores replay the archived version; the CSV provides neither a retrieval timestamp nor released versions.')}</p>
      </section>

      <section className="panel scientific-metrics-panel" aria-labelledby="metrics-title">
        <div className="panel-heading">
          <div>
            <div className="section-title"><Activity size={19} aria-hidden="true" /><h2 id="metrics-title">{t('Scores hors échantillon par horizon', 'Out-of-sample scores by horizon')}</h2></div>
            <p>{t('MAE et RMSE en °C; N, période des origines et dates valides publiés pour chaque comparaison.', 'MAE and RMSE in °C; N, origin period and valid dates published for every comparison.')}</p>
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
                <th>Horizon</th><th>N</th><th>{t('Période valide', 'Valid period')}</th><th>{t('Modèle candidat MAE / RMSE', 'Candidate model MAE / RMSE')}</th><th>{t('Persistance MAE / RMSE', 'Persistence MAE / RMSE')}</th><th>{t('Saisonnière MAE / RMSE', 'Seasonal MAE / RMSE')}</th>
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
            <div className="section-title"><Database size={19} aria-hidden="true" /><h2 id="validation-chart-title">{t('Prédictions et observations du backtest', 'Backtest predictions and observations')}</h2></div>
            <p>{t('Les points représentent uniquement le jeu terminal historique; aucune ligne n’est une prévision actuelle.', 'The points show the historical hold-out set only; no line is a current forecast.')}</p>
          </div>
          <div className="horizon-switcher" role="group" aria-label={t('Choisir l’horizon du graphique', 'Choose the chart horizon')}>
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
              <Tooltip labelFormatter={(value) => t(`Date valide : ${String(value)}`, `Valid date: ${String(value)}`)} formatter={(value, name) => [`${Number(value).toFixed(2)} °C`, String(name)]} />
              <Legend />
              <Line name={t('Observé', 'Observed')} type="linear" dataKey="observed" stroke="#334e61" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line name={t('Ridge expérimental', 'Experimental Ridge')} type="linear" dataKey="candidate" stroke="#d45d37" strokeWidth={1.6} dot={false} isAnimationActive={false} />
              <Line name={t('Persistance', 'Persistence')} type="linear" dataKey="persistence" stroke="#2484ab" strokeWidth={1.2} dot={false} isAnimationActive={false} />
              <Line name={t('Baseline saisonnière', 'Seasonal baseline')} type="linear" dataKey="seasonal" stroke="#8a6ab5" strokeWidth={1.2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="validation-cta-row">
        <Link to="/previsions" className="export-button"><ArrowLeft size={15} aria-hidden="true" /> {t('Prévisions et alertes', 'Forecasts and alerts')}</Link>
        <Link to="/sources" className="export-button">{t('Contrôles des sources', 'Source checks')} <ArrowRight size={15} aria-hidden="true" /></Link>
      </section>
      <span className="visually-hidden" aria-live="polite">{predictions.length} {t('prédictions historiques sont disponibles pour l’export.', 'historical predictions are available for export.')}</span>
    </>
  );
}

// Formate une erreur à deux décimales sans la présenter comme un pourcentage de précision.
function formatError(value: number): string {
  return `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} °C`;
}
