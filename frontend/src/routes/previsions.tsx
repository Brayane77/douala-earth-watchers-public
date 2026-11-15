/** Prévision T2M indisponible au présent, feed officiel d'alertes absent et seuils exploratoires configurables. */
import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Activity, AlertTriangle, ArrowLeft, ArrowRight, BellRing, CalendarDays, CheckCircle2, Info, LoaderCircle, Waves } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { MonthlyMlLab } from '../components/MonthlyMlLab';
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
      setFormError('Saisissez un seuil numérique fini; aucun seuil n’est prérempli par l’application.');
      return;
    }
    setIsSubmitting(true);
    try {
      const evaluated = await evaluateDailyT2MThreshold(variable, operator, numericThreshold);
      setResult(evaluated);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Le seuil n’a pas pu être évalué.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Choisit l'unité d'aide en fonction de la variable réellement sélectionnée.
  const thresholdUnit = variable === 'T2M' ? '°C' : 'mm/jour';

  return (
    <div className="sources-page-shell forecast-page-shell">
      <header className="topbar sources-topbar">
        <Link className="brand-lockup" to="/">
          <span className="brand-mark"><Waves size={23} aria-hidden="true" /></span>
          <span className="brand-copy">
            <strong>Douala Earth Watchers</strong>
            <small>Prévisions et indicateurs exploratoires</small>
          </span>
        </Link>
        <div className="sources-header-actions">
          <Link to="/" className="back-link"><ArrowLeft size={15} aria-hidden="true" /> Tableau de bord</Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="sources-content forecast-content">
        <div className="sources-page-intro">
          <div>
            <span className="eyebrow">T2M QUOTIDIEN · NASA POWER · LST</span>
            <h1>Prévisions et alertes</h1>
            <p>Le backtest historique est séparé d’une prévision actuelle. Les alertes officielles et les seuils exploratoires ne sont jamais confondus.</p>
          </div>
          <Link to="/validation-scientifique" className="back-link">Voir le backtest <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>

        <MonthlyMlLab />

        <section className="panel forecast-status-panel" aria-labelledby="forecast-status-title">
          <div className="panel-heading">
            <div>
              <div className="section-title"><Activity size={19} aria-hidden="true" /><h2 id="forecast-status-title">Prévision actuelle</h2></div>
              <p>Horizon prévu par le protocole : J+1 à J+3, sur la température de l’air à 2 m.</p>
            </div>
            <span className="validation-count validation-count-warning">Données insuffisantes</span>
          </div>

          {forecast.isPending ? (
            <p className="forecast-loading" role="status"><LoaderCircle className="spin" size={18} aria-hidden="true" /> Chargement du statut de la source…</p>
          ) : forecast.isError || !forecast.data ? (
            <p className="forecast-error" role="alert">{forecast.error instanceof Error ? forecast.error.message : 'Le statut du forecast est indisponible.'}</p>
          ) : (
            <>
              <div className="forecast-status-callout" role="status">
                <AlertTriangle size={20} aria-hidden="true" />
                <div>
                  <strong>Aucune valeur future n’est publiée.</strong>
                  <p>{forecast.data.reasons.join(' ')}</p>
                </div>
              </div>
              <dl className="source-details forecast-source-details">
                <div><dt>Produit / variable</dt><dd>{forecast.data.source.provider} · {forecast.data.source.upstream_product} · T2M (air à 2 m)</dd></div>
                <div><dt>Dernière date source</dt><dd>{forecast.data.source_end_date} · LST</dd></div>
                <div><dt>Récupération du fichier</dt><dd>{forecast.data.retrieved_at ?? 'Non documentée'}</dd></div>
                <div><dt>Point / résolution</dt><dd>{forecast.data.source.coordinates_requested.latitude.toFixed(2)}°N, {forecast.data.source.coordinates_requested.longitude.toFixed(2)}°E · {forecast.data.source.native_grid_resolution}</dd></div>
                <div><dt>Dernière observation</dt><dd>{forecast.data.latest_observation.t2m_c.toFixed(2)} °C au {forecast.data.latest_observation.date}</dd></div>
                <div><dt>Incertitude</dt><dd>{forecast.data.uncertainty}</dd></div>
              </dl>
              <div className="forecast-actions">
                <Link to="/validation-scientifique" className="export-button">Consulter la validation historique <ArrowRight size={15} aria-hidden="true" /></Link>
              </div>
            </>
          )}
        </section>

        <div className="forecast-columns">
          <section className="panel official-alert-panel" aria-labelledby="official-alert-title">
            <div className="panel-heading">
              <div>
                <div className="section-title"><BellRing size={19} aria-hidden="true" /><h2 id="official-alert-title">Alertes officielles</h2></div>
                <p>Messages émis par une source d'autorité distincte des indicateurs du tableau de bord.</p>
              </div>
            </div>
            {alerts.isPending ? (
              <p className="forecast-loading" role="status"><LoaderCircle className="spin" size={18} aria-hidden="true" /> Vérification de la disponibilité…</p>
            ) : alerts.isError || !alerts.data ? (
              <p className="forecast-error" role="alert">{alerts.error instanceof Error ? alerts.error.message : 'Le statut de disponibilité est inconnu.'}</p>
            ) : (
              <div className="official-alert-empty" role="status">
                <Info size={19} aria-hidden="true" />
                <div><strong>Aucun flux officiel connecté</strong><p>{alerts.data.official_alerts.reason} Aucun avis n’est généré ou affiché comme avis d’autorité.</p></div>
              </div>
            )}
          </section>

          <section className="panel exploratory-alert-panel" aria-labelledby="exploratory-alert-title">
            <div className="panel-heading">
              <div>
                <div className="section-title"><CalendarDays size={19} aria-hidden="true" /><h2 id="exploratory-alert-title">Indicateur de seuil exploratoire</h2></div>
                <p>Définissez vous-même une règle; elle sera comparée à la dernière ligne réelle de l’archive.</p>
              </div>
            </div>
            <form className="threshold-form" onSubmit={(event) => { void submitThreshold(event); }}>
              <label className="forecast-field">
                <span>Variable</span>
                <select value={variable} onChange={(event) => { setVariable(event.target.value as 'T2M' | 'PRECTOTCORR'); setResult(null); }}>
                  <option value="T2M">Température de l’air à 2 m (T2M)</option>
                  <option value="PRECTOTCORR">Précipitations corrigées (PRECTOTCORR)</option>
                </select>
              </label>
              <label className="forecast-field">
                <span>Condition</span>
                <select value={operator} onChange={(event) => { setOperator(event.target.value as 'gt' | 'lt'); setResult(null); }}>
                  <option value="gt">Supérieur à</option>
                  <option value="lt">Inférieur à</option>
                </select>
              </label>
              <label className="forecast-field threshold-value-field">
                <span>Seuil ({thresholdUnit})</span>
                <input
                  type="number"
                  step="any"
                  required
                  value={threshold}
                  onChange={(event) => { setThreshold(event.target.value); setResult(null); }}
                  placeholder="Saisir un seuil"
                  aria-label={`Seuil exploratoire en ${thresholdUnit}`}
                />
              </label>
              <button type="submit" className="primary-button threshold-submit" disabled={isSubmitting}>
                {isSubmitting ? <LoaderCircle className="spin" size={15} aria-hidden="true" /> : <Activity size={15} aria-hidden="true" />}
                {isSubmitting ? 'Évaluation…' : 'Évaluer sur l’archive'}
              </button>
            </form>

            {formError && <p className="forecast-error" role="alert">{formError}</p>}
            {result && (
              <div className={`threshold-result ${result.triggered ? 'threshold-result-triggered' : 'threshold-result-clear'}`} role="status">
                {result.triggered ? <AlertTriangle size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
                <div>
                  <strong>{result.triggered ? 'Seuil dépassé dans l’archive' : 'Seuil non dépassé dans l’archive'}</strong>
                  <p>
                    {result.observation.label} : {result.observation.value.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} {result.observation.unit}
                    {' '}{result.rule.symbol}{' '}{result.rule.threshold.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} {result.rule.unit}
                    {' · observation du '}{result.observation.date}.
                  </p>
                  <small>{result.message}</small>
                </div>
              </div>
            )}
            <p className="validation-note threshold-disclaimer"><Info size={15} aria-hidden="true" />Le seuil est exploratoire et défini par vous, sans valeur par défaut. La dernière donnée est historique; aucun seuil sanitaire, risque d’inondation ou avis officiel n’est inféré.</p>
          </section>
        </div>

        <section className="panel forecast-scope-panel" aria-labelledby="forecast-scope-title">
          <div className="panel-heading">
            <div>
              <div className="section-title"><Info size={19} aria-hidden="true" /><h2 id="forecast-scope-title">Portée et limites</h2></div>
              <p>Les séries historiques, les prévisions et les alertes restent des objets distincts.</p>
            </div>
          </div>
          <div className="validation-rule-grid">
            <div><strong>Produit évalué</strong><span>NASA POWER/MERRA-2 T2M, température moyenne de l’air à 2 m; pas une mesure de station ni de surface.</span></div>
            <div><strong>Archive disponible</strong><span>{forecast.data?.source.source_period.start ?? '2015-01-01'} à {forecast.data?.source_end_date ?? '2025-12-31'}, LST; la date de récupération manque.</span></div>
            <div><strong>Pas d’extrapolation actuelle</strong><span>Sans données fraîches et provenance d’émission, aucun point futur, intervalle ou risque n’est affiché.</span></div>
          </div>
        </section>

        <footer className="app-footer sources-footer">
          <span><strong>Douala Earth Watchers</strong> · observations et résultats versionnés</span>
          <span>Prévision actuelle et alertes officielles non disponibles</span>
        </footer>
      </main>
    </div>
  );
}
