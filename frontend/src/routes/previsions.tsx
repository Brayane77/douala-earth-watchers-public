/** Prévision T2M indisponible au présent, feed officiel d'alertes absent et seuils exploratoires configurables. */
import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Activity, AlertTriangle, ArrowLeft, ArrowRight, BellRing, CalendarDays, CheckCircle2, Info, LoaderCircle, Waves } from 'lucide-react';
import { LanguageToggle } from '../components/LanguageToggle';
import { ThemeToggle } from '../components/ThemeToggle';
import brandLogo from '../assets/logo-dew.svg';
import { MonthlyMlLab } from '../components/MonthlyMlLab';
import { useTranslation } from '../lib/i18n';
import {
  evaluateDailyT2MThreshold,
  fetchDailyT2MForecast,
  fetchOfficialAlertsStatus,
  type ExploratoryThresholdResult,
} from '../lib/api';

// Déclare le titre et la description de la route dans le navigateur.
export const Route = createFileRoute('/previsions')({
  head: () => ({
    meta: [
      { title: 'Prévisions et alertes — Douala Earth Watchers' },
      { name: 'description', content: 'Évaluation ML exploratoire sur CSV mensuel, séparée du forecast quotidien T2M, des prévisions actuelles et des alertes officielles.' },
    ],
  }),
  component: ForecastsPage,
});

// Affiche le statut réel des données et attend une règle explicite avant d'évaluer un seuil.
function ForecastsPage() {
  const { t, intlLocale } = useTranslation();
  const forecast = useQuery({
    queryKey: ['forecast-t2m-daily'],
    queryFn: ({ signal }) => fetchDailyT2MForecast(signal),
    staleTime: 5 * 60 * 1000,
  });
  const alerts = useQuery({
    queryKey: ['alerts-status'],
    queryFn: ({ signal }) => fetchOfficialAlertsStatus(signal),
    staleTime: 5 * 60 * 1000,
  });
  const [variable, setVariable] = useState<'T2M' | 'PRECTOTCORR'>('T2M');
  const [operator, setOperator] = useState<'gt' | 'lt'>('gt');
  const [threshold, setThreshold] = useState('');
  const [result, setResult] = useState<ExploratoryThresholdResult | null>(null);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Compare uniquement le seuil soumis par l'utilisateur à la dernière observation archivée.
  async function submitThreshold(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setResult(null);
    const numericThreshold = Number(threshold);
    if (!threshold.trim() || !Number.isFinite(numericThreshold)) {
      setFormError(t('Saisissez un seuil numérique fini; aucun seuil n’est prérempli par l’application.', 'Enter a finite numeric threshold; no threshold is pre-filled by the application.'));
      return;
    }
    setIsSubmitting(true);
    try {
      const evaluated = await evaluateDailyT2MThreshold(variable, operator, numericThreshold);
      setResult(evaluated);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('Le seuil n’a pas pu être évalué.', 'The threshold could not be evaluated.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  // Choisit l'unité d'aide en fonction de la variable réellement sélectionnée.
  const thresholdUnit = variable === 'T2M' ? '°C' : t('mm/jour', 'mm/day');

  return (
    <div className="sources-page-shell">
      <header className="topbar sources-topbar">
        <Link className="brand-lockup" to="/">
          <span className="brand-mark"><img className="brand-logo" src={brandLogo} alt="" aria-hidden="true" /></span>
          <span className="brand-copy">
            <strong>Douala Earth Watchers</strong>
            <small>{t('Prévisions et indicateurs exploratoires', 'Forecasts and exploratory indicators')}</small>
          </span>
        </Link>
        <div className="sources-header-actions">
          <Link to="/" className="back-link"><ArrowLeft size={15} aria-hidden="true" /> {t('Tableau de bord', 'Dashboard')}</Link>
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      <main className="sources-content forecast-content">
        <div className="sources-page-intro">
          <div>
            <span className="eyebrow">{t('T2M QUOTIDIEN · NASA POWER · LST', 'DAILY T2M · NASA POWER · LST')}</span>
            <h1>{t('Prévisions et alertes', 'Forecasts and alerts')}</h1>
            <p>{t('Backtest historique, seuils définis par vous et alertes officielles : trois objets distincts, jamais confondus.', 'Historical backtest, thresholds you define and official alerts: three distinct objects, never conflated.')}</p>
          </div>
          <Link to="/validation-scientifique" className="back-link">{t('Voir le backtest', 'View the backtest')} <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>

        <MonthlyMlLab />

        <section className="panel forecast-status-panel" aria-labelledby="forecast-status-title">
          <div className="panel-heading">
            <div>
              <div className="section-title"><Activity size={19} aria-hidden="true" /><h2 id="forecast-status-title">{t('Prévision actuelle', 'Current forecast')}</h2></div>
              <p>{t('Horizon prévu par le protocole : J+1 à J+3, sur la température de l’air à 2 m.', 'Protocol horizon: D+1 to D+3, on 2 m air temperature.')}</p>
            </div>
            <span className="validation-count validation-count-warning">{t('Données insuffisantes', 'Insufficient data')}</span>
          </div>

          {forecast.isPending ? (
            <p className="forecast-loading" role="status"><LoaderCircle className="spin" size={18} aria-hidden="true" /> {t('Chargement du statut de la source…', 'Loading the source status…')}</p>
          ) : forecast.isError || !forecast.data ? (
            <p className="forecast-error" role="alert">{forecast.error instanceof Error ? forecast.error.message : t('Le statut du forecast est indisponible.', 'The forecast status is unavailable.')}</p>
          ) : (
            <>
              <div className="forecast-status-callout" role="status">
                <AlertTriangle size={20} aria-hidden="true" />
                <div>
                  <strong>{t('Aucune valeur future n’est publiée.', 'No future value is published.')}</strong>
                  <p>{forecast.data.reasons.join(' ')}</p>
                </div>
              </div>
              <dl className="source-details forecast-source-details">
                <div><dt>{t('Produit / variable', 'Product / variable')}</dt><dd>{forecast.data.source.provider} · {forecast.data.source.upstream_product} · T2M ({t('air à 2 m', '2 m air')})</dd></div>
                <div><dt>{t('Dernière observation', 'Latest observation')}</dt><dd>{forecast.data.latest_observation.t2m_c.toFixed(2)} °C {t('au', 'on')} {forecast.data.latest_observation.date}</dd></div>
                <div><dt>{t('Point / résolution', 'Point / resolution')}</dt><dd>{forecast.data.source.coordinates_requested.latitude.toFixed(2)}°N, {forecast.data.source.coordinates_requested.longitude.toFixed(2)}°E · {forecast.data.source.native_grid_resolution}</dd></div>
              </dl>
              <div className="forecast-actions">
                <Link to="/validation-scientifique" className="export-button">{t('Consulter la validation historique', 'View the historical validation')} <ArrowRight size={15} aria-hidden="true" /></Link>
              </div>
            </>
          )}
        </section>

        <div className="forecast-columns">
          <section className="panel official-alert-panel" aria-labelledby="official-alert-title">
            <div className="panel-heading">
              <div>
                <div className="section-title"><BellRing size={19} aria-hidden="true" /><h2 id="official-alert-title">{t('Alertes officielles', 'Official alerts')}</h2></div>
                <p>{t('Messages émis par une source d’autorité distincte des indicateurs du tableau de bord.', 'Messages issued by an authority source, distinct from the dashboard indicators.')}</p>
              </div>
            </div>
            {alerts.isPending ? (
              <p className="forecast-loading" role="status"><LoaderCircle className="spin" size={18} aria-hidden="true" /> {t('Vérification de la disponibilité…', 'Checking availability…')}</p>
            ) : alerts.isError || !alerts.data ? (
              <p className="forecast-error" role="alert">{alerts.error instanceof Error ? alerts.error.message : t('Le statut de disponibilité est inconnu.', 'The availability status is unknown.')}</p>
            ) : (
              <div className="official-alert-empty" role="status">
                <Info size={19} aria-hidden="true" />
                <div><strong>{t('Aucun flux officiel connecté', 'No official feed connected')}</strong><p>{alerts.data.official_alerts.reason} {t('Aucun avis n’est généré ou affiché comme avis d’autorité.', 'No advisory is generated or displayed as an authority advisory.')}</p></div>
              </div>
            )}
          </section>

          <section className="panel exploratory-alert-panel" aria-labelledby="exploratory-alert-title">
            <div className="panel-heading">
              <div>
                <div className="section-title"><CalendarDays size={19} aria-hidden="true" /><h2 id="exploratory-alert-title">{t('Indicateur de seuil exploratoire', 'Exploratory threshold indicator')}</h2></div>
                <p>{t('Définissez vous-même une règle; elle sera comparée à la dernière ligne réelle de l’archive.', 'Define a rule yourself; it will be compared with the last real row of the archive.')}</p>
              </div>
            </div>
            <form className="threshold-form" onSubmit={(event) => { void submitThreshold(event); }}>
              <label className="forecast-field">
                <span>Variable</span>
                <select value={variable} onChange={(event) => { setVariable(event.target.value as 'T2M' | 'PRECTOTCORR'); setResult(null); }}>
                  <option value="T2M">{t('Température de l’air à 2 m (T2M)', '2 m air temperature (T2M)')}</option>
                  <option value="PRECTOTCORR">{t('Précipitations corrigées (PRECTOTCORR)', 'Bias-corrected precipitation (PRECTOTCORR)')}</option>
                </select>
              </label>
              <label className="forecast-field">
                <span>{t('Condition', 'Condition')}</span>
                <select value={operator} onChange={(event) => { setOperator(event.target.value as 'gt' | 'lt'); setResult(null); }}>
                  <option value="gt">{t('Supérieur à', 'Greater than')}</option>
                  <option value="lt">{t('Inférieur à', 'Less than')}</option>
                </select>
              </label>
              <label className="forecast-field threshold-value-field">
                <span>{t('Seuil', 'Threshold')} ({thresholdUnit})</span>
                <input
                  type="number"
                  step="any"
                  required
                  value={threshold}
                  onChange={(event) => { setThreshold(event.target.value); setResult(null); }}
                  placeholder={t('Saisir un seuil', 'Enter a threshold')}
                  aria-label={t(`Seuil exploratoire en ${thresholdUnit}`, `Exploratory threshold in ${thresholdUnit}`)}
                />
              </label>
              <button type="submit" className="primary-button threshold-submit" disabled={isSubmitting}>
                {isSubmitting ? <LoaderCircle className="spin" size={15} aria-hidden="true" /> : <Activity size={15} aria-hidden="true" />}
                {isSubmitting ? t('Évaluation…', 'Evaluating…') : t('Évaluer sur l’archive', 'Evaluate on the archive')}
              </button>
            </form>

            {formError && <p className="forecast-error" role="alert">{formError}</p>}
            {result && (
              <div className={`threshold-result ${result.triggered ? 'threshold-result-triggered' : 'threshold-result-clear'}`} role="status">
                {result.triggered ? <AlertTriangle size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
                <div>
                  <strong>{result.triggered ? t('Seuil dépassé dans l’archive', 'Threshold exceeded in the archive') : t('Seuil non dépassé dans l’archive', 'Threshold not exceeded in the archive')}</strong>
                  <p>
                    {result.observation.label} : {result.observation.value.toLocaleString(intlLocale, { maximumFractionDigits: 3 })} {result.observation.unit}
                    {' '}{result.rule.symbol}{' '}{result.rule.threshold.toLocaleString(intlLocale, { maximumFractionDigits: 3 })} {result.rule.unit}
                    {' · '}{t('observation du', 'observation of')} {result.observation.date}.
                  </p>
                  <small>{result.message}</small>
                </div>
              </div>
            )}
            <p className="validation-note threshold-disclaimer"><Info size={15} aria-hidden="true" />{t('Le seuil est exploratoire et défini par vous, sans valeur par défaut. La dernière donnée est historique; aucun seuil sanitaire, risque d’inondation ou avis officiel n’est inféré.', 'The threshold is exploratory and defined by you, with no default value. The latest data is historical; no health threshold, flood risk or official advisory is inferred.')}</p>
          </section>
        </div>

        <footer className="app-footer sources-footer">
          <span><strong>Douala Earth Watchers</strong> · {t('observations et résultats versionnés', 'versioned observations and results')}</span>
          <span>{t('Backtest et seuils exploratoires · non officiels', 'Backtest and exploratory thresholds · not official')}</span>
        </footer>
      </main>
    </div>
  );
}
