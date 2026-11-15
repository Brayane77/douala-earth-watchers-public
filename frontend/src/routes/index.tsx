/** Tableau de bord des produits climatiques mensuels et des composites de végétation MODIS. */
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  BellRing,
  CalendarDays,
  ChevronDown,
  Database,
  Home,
  Leaf,
  LoaderCircle,
  Map,
  MapPin,
  Menu,
  RefreshCw,
  Satellite,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { MapPanel } from '../components/MapPanel';
import { LanguageToggle } from '../components/LanguageToggle';
import { MetricCard } from '../components/MetricCard';
import { ThemeToggle } from '../components/ThemeToggle';
import { localizedProductLabel, useTranslation } from '../lib/i18n';
import cityImage from '../assets/douala-city.jpg';
import brandLogo from '../assets/logo-dew.svg';
import { fetchDashboardData } from '../lib/api';
import type { DashboardResponse, DatasetMetadata } from '../lib/api';
import {
  downloadCsv,
  formatMonth,
  formatUnit,
  formatValue,
  maximumPeriodNote,
  minimumPeriodNote,
  periodForPreset,
  rowsForPeriod,
  summarizeRows,
  type Period,
  type PeriodPreset,
} from '../lib/climate';

// Sépare les visualisations du code critique qui rend l’enveloppe du tableau de bord.
const ChartPanel = lazy(() => import('../components/ChartPanel').then((module) => ({ default: module.ChartPanel })));
const TrendAnalysisPanel = lazy(() => import('../components/TrendAnalysisPanel').then((module) => ({ default: module.TrendAnalysisPanel })));
const VegetationPanel = lazy(() => import('../components/VegetationPanel').then((module) => ({ default: module.VegetationPanel })));

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Douala Earth Watchers — Tableau de bord' },
      { name: 'description', content: 'Séries climatiques et composites MODIS de végétation pour Douala, avec provenance, dates et fréquence native vérifiables.' },
    ],
  }),
  component: DashboardPage,
});

/** Élément de navigation et identifiant de section associé dans le dashboard. */
interface NavigationItem {
  id: string;
  label: string;
  labelEn: string;
  icon: LucideIcon;
}

// Garde les sections et les routes distinctes dans un même ordre de navigation.
const navigation: NavigationItem[] = [
  { id: 'overview', label: 'Vue d’ensemble', labelEn: 'Overview', icon: Home },
  { id: 'map', label: 'Carte de référence', labelEn: 'Reference map', icon: Map },
  { id: 'series', label: 'Évolution temporelle', labelEn: 'Time series', icon: Activity },
  { id: 'trends', label: 'Tendances', labelEn: 'Trends', icon: TrendingUp },
  { id: 'vegetation', label: 'Végétation', labelEn: 'Vegetation', icon: Leaf },
  { id: 'previsions', label: 'Prévisions et seuils', labelEn: 'Forecasts and thresholds', icon: BellRing },
  { id: 'sources', label: 'Sources et contrôles', labelEn: 'Sources and checks', icon: Database },
];

// Identifiant d’interface séparé, car l’archive MODIS n’appartient pas au catalogue mensuel.
const MODIS_VEGETATION_KIND = 'modis_vegetation';

// Raccourcis proposés pour les séries climatiques uniquement.
const presets: { id: PeriodPreset }[] = [
  { id: '12m' },
  { id: '36m' },
  { id: '60m' },
  { id: 'all' },
];

/** Maintient une valeur de mois dans la couverture déclarée par la source. */
function clampMonth(value: string, minimum: string, maximum: string): string {
  if (!value) return minimum;
  return value < minimum ? minimum : value > maximum ? maximum : value;
}

/** Charge le catalogue local et choisit un état chargement, erreur ou contenu. */
function DashboardPage() {
  const { t } = useTranslation();
  const dashboard = useQuery({
    queryKey: ['dashboard-data'],
    queryFn: ({ signal }) => fetchDashboardData(signal),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (dashboard.isPending) return <LoadingScreen />;

  if (dashboard.isError || !dashboard.data) {
    const message = dashboard.error instanceof Error
      ? dashboard.error.message
      : t('Le backend FastAPI ne répond pas.', 'The FastAPI backend is not responding.');
    return <ErrorScreen message={message} onRetry={() => { void dashboard.refetch(); }} />;
  }

  return <DashboardContent payload={dashboard.data} />;
}

/** Synchronise les filtres d’affichage et les statistiques des observations reçues. */
function DashboardContent({ payload }: { payload: DashboardResponse }) {
  const { t, intlLocale, language } = useTranslation();
  const [requestedKind, setRequestedKind] = useState('');
  const [selectedSector, setSelectedSector] = useState('');
  const [period, setPeriod] = useState<Period>({ start: '', end: '' });
  const [activePreset, setActivePreset] = useState<PeriodPreset | 'custom'>('12m');
  const [activeSection, setActiveSection] = useState('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const firstKind = Object.keys(payload.catalog)[0] ?? '';
  const isVegetationProduct = requestedKind === MODIS_VEGETATION_KIND;
  const kind = payload.catalog[requestedKind] ? requestedKind : firstKind;
  const selectedProduct = isVegetationProduct ? MODIS_VEGETATION_KIND : kind;
  const metadata = payload.catalog[kind];
  const dataset = payload.datasets[kind];

  useEffect(() => {
    if (!metadata) return;
    setPeriod(periodForPreset(metadata, '12m'));
    setSelectedSector(metadata.sectors.length === 1 ? metadata.sectors[0] : '');
    setActivePreset('12m');
  }, [metadata]);

  const sourceRows = useMemo(() => {
    if (!dataset) return [];
    return dataset.data
      .filter((row) => !selectedSector || row.sector === selectedSector)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [dataset, selectedSector]);

  const visibleRows = useMemo(() => rowsForPeriod(sourceRows, period), [sourceRows, period]);
  const stats = useMemo(() => summarizeRows(visibleRows, period), [visibleRows, period]);

  if (!metadata || !dataset) {
    return (
      <ErrorScreen
        message={t(
          'Le backend n’a renvoyé aucune série exploitable pour cet indicateur.',
          'The backend returned no usable series for this indicator.',
        )}
        onRetry={() => window.location.reload()}
      />
    );
  }

  const periodLabel = isVegetationProduct
    ? t('MODIS DV · composites de 16 jours', 'MODIS DV · 16-day composites')
    : period.start && period.end
      ? `${formatMonth(period.start, false, intlLocale)} — ${formatMonth(period.end, false, intlLocale)}`
      : t('Période indisponible', 'Period unavailable');
  const sectorLabel = selectedSector || t('Tous les secteurs', 'All sectors');

  /** Met à jour la navigation interne et fait défiler la section choisie. */
  function navigateTo(id: string) {
    setActiveSection(id);
    setMobileNavOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Bascule entre produits climatiques et MODIS sans appliquer les filtres mensuels à la végétation. */
  function changeKind(nextKind: string) {
    const nextIsVegetation = nextKind === MODIS_VEGETATION_KIND;
    const nextClimateKind = payload.catalog[nextKind] ? nextKind : firstKind;
    const nextMetadata = payload.catalog[nextClimateKind];

    setRequestedKind(nextKind);
    setPeriod(nextIsVegetation || !nextMetadata ? { start: '', end: '' } : periodForPreset(nextMetadata, '12m'));
    setSelectedSector(nextIsVegetation || !nextMetadata || nextMetadata.sectors.length !== 1 ? '' : nextMetadata.sectors[0]);
    setActivePreset(nextIsVegetation ? 'custom' : '12m');
    setActiveSection(nextIsVegetation ? 'vegetation' : 'overview');
  }

  /** Applique un raccourci borné par la période réellement disponible. */
  function applyPreset(preset: PeriodPreset) {
    setPeriod(periodForPreset(metadata, preset));
    setActivePreset(preset);
  }

  /** Ajuste le début et conserve une plage de mois valide. */
  function changeStart(start: string) {
    setPeriod((current) => ({ start, end: current.end && start > current.end ? start : current.end || metadata.end }));
    setActivePreset('custom');
  }

  /** Ajuste la fin et conserve une plage de mois valide. */
  function changeEnd(end: string) {
    setPeriod((current) => ({ start: current.start && end < current.start ? end : current.start || metadata.start, end }));
    setActivePreset('custom');
  }

  const isAirTemperature = metadata.variable === 'T2M' && metadata.unit.includes('°C');
  const averageTitle = isAirTemperature ? t('Température moyenne de l’air', 'Mean air temperature') : t('Moyenne sur la période', 'Period average');
  const minimumTitle = isAirTemperature ? t('Minimum de l’air à 2 m', 'Minimum air temperature at 2 m') : t('Minimum observé', 'Observed minimum');
  const maximumTitle = isAirTemperature ? t('Maximum de l’air à 2 m', 'Maximum air temperature at 2 m') : t('Maximum observé', 'Observed maximum');
  const productLabel = localizedProductLabel(metadata.kind, metadata.label, t);

  return (
    <div className="dashboard-shell min-h-screen bg-background font-sans text-foreground">
      <header className="topbar">
        <button
          className="mobile-menu-button"
          type="button"
          aria-label={mobileNavOpen ? t('Fermer le menu', 'Close menu') : t('Ouvrir le menu', 'Open menu')}
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          <Menu size={21} aria-hidden="true" />
        </button>
        <a className="brand-lockup" href="#overview" onClick={(event) => { event.preventDefault(); navigateTo('overview'); }}>
          <span className="brand-mark"><img className="brand-logo" src={brandLogo} alt="" aria-hidden="true" /></span>
          <span className="brand-copy">
            <strong>Douala Earth Watchers</strong>
            <small>{t('Observatoire environnemental de Douala', 'Douala Environmental Observatory')}</small>
          </span>
        </a>
        <div className="topbar-context">
          <div className="topbar-pill"><MapPin size={16} aria-hidden="true" /><span><strong>Douala</strong><small>{t('Littoral, Cameroun', 'Littoral, Cameroon')}</small></span></div>
          <div className="topbar-pill topbar-period"><CalendarDays size={16} aria-hidden="true" /><span>{periodLabel}</span></div>
          <div className="connection-state"><span className="connection-dot" /><span>{t('Mode démo · CSV locaux', 'Demo mode · local CSV files')}</span></div>
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      <div className="app-layout">
        <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`} aria-label={t('Navigation du tableau de bord', 'Dashboard navigation')}>
          <nav className="sidebar-nav">
            {navigation
              .filter(({ id }) => !isVegetationProduct || !['map', 'series', 'trends'].includes(id))
              .map(({ id, label, labelEn, icon: Icon }) => {
                const localizedLabel = t(label, labelEn);
                return id === 'sources' ? (
                  <Link key={id} to="/sources" className="sidebar-link"><Icon size={19} aria-hidden="true" /><span>{localizedLabel}</span></Link>
                ) : id === 'previsions' ? (
                  <Link key={id} to="/previsions" className="sidebar-link"><Icon size={19} aria-hidden="true" /><span>{localizedLabel}</span></Link>
                ) : (
                  <button
                    key={id}
                    type="button"
                    className={`sidebar-link ${activeSection === id ? 'active' : ''}`}
                    aria-current={activeSection === id ? 'page' : undefined}
                    onClick={() => navigateTo(id)}
                  >
                    <Icon size={19} aria-hidden="true" /><span>{localizedLabel}</span>
                  </button>
                );
              })}
          </nav>
          <div className="sidebar-visual">
            <img src={cityImage} alt="" loading="lazy" />
            <div className="sidebar-image-shade" />
            <div className="sidebar-visual-copy">
              <span>{t('PRODUITS NASA · CSV LOCAUX', 'NASA PRODUCTS · LOCAL CSV')}</span>
              <p>{t('Des séries documentées, avec leurs limites visibles.', 'Documented datasets, with their limitations visible.')}</p>
              <Leaf size={19} aria-hidden="true" />
            </div>
          </div>
          <div className="sidebar-status"><span className="status-dot" />{t('Séries agrégées, provenance vérifiable', 'Aggregated series, traceable provenance')}</div>
        </aside>

        <main className="main-content">
          <section className="page-intro" id="overview">
            <div>
              <span className="eyebrow">{isVegetationProduct ? t('OBSERVATIONS DE VÉGÉTATION · MODIS', 'VEGETATION OBSERVATIONS · MODIS') : t('SÉRIES CLIMATIQUES · CAMEROUN', 'CLIMATE SERIES · CAMEROON')}</span>
              <h1>{isVegetationProduct ? t('Composites de végétation MODIS DV.', 'MODIS DV vegetation composites.') : t('Le climat de Douala, en données.', 'Douala’s climate, in data.')}</h1>
              <p>{isVegetationProduct ? t('Explorez NDVI et EVI sur les dates composites réellement reçues, sans interpolation.', 'Explore NDVI and EVI on the composite dates actually received, without interpolation.') : t('Explorez les séries mensuelles, leur provenance et les mois réellement disponibles.', 'Explore monthly series, their provenance, and the months actually available.')}</p>
            </div>
            <div className="period-summary"><CalendarDays size={16} aria-hidden="true" /><span>{periodLabel}</span></div>
          </section>

          <section className="filter-panel" aria-label={isVegetationProduct ? t('Sélection du produit de végétation', 'Vegetation product selection') : t('Filtres des séries climatiques', 'Climate series filters')}>
            <div className="filter-fields">
              <label className="filter-field">
                <span>{t('Série / produit', 'Series / product')}</span>
                <div className="select-wrap">
                  <select value={selectedProduct} onChange={(event) => changeKind(event.target.value)} aria-label={t('Choisir une série ou un produit', 'Choose a series or product')}>
                    {Object.entries(payload.catalog).map(([datasetKind, item]) => (
                      <option key={datasetKind} value={datasetKind}>{localizedProductLabel(item.kind, item.label, t)}</option>
                    ))}
                    <option value={MODIS_VEGETATION_KIND}>{t('Végétation observée · MODIS DV', 'Observed vegetation · MODIS DV')}</option>
                  </select>
                  <ChevronDown size={15} aria-hidden="true" />
                </div>
              </label>

              {isVegetationProduct ? (
                <div className="vegetation-product-context" role="note">
                  <strong>MOD13Q1.061 · composites natifs de 16 jours</strong>
                  <span>{t('Le point de référence est unique; secteur et période mensuelle ne s’appliquent pas à cette archive.', 'There is a single reference point; sector and monthly period filters do not apply to this archive.')}</span>
                </div>
              ) : (
                <>
              <label className="filter-field">
                <span>{t('Zone de données', 'Data area')}</span>
                <div className="select-wrap">
                  <select value={selectedSector} onChange={(event) => setSelectedSector(event.target.value)} aria-label={t('Choisir une zone', 'Choose an area')}>
                    {metadata.sectors.length > 1 && <option value="">{t('Toutes les zones', 'All areas')}</option>}
                    {metadata.sectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
                  </select>
                  <ChevronDown size={15} aria-hidden="true" />
                </div>
              </label>

              <div className="filter-field">
                <span id="period-label">{t('Période mensuelle', 'Monthly period')}</span>
                <div className="month-inputs" aria-labelledby="period-label">
                  <input
                    type="month"
                    aria-label={t('Début de période', 'Period start')}
                    min={metadata.start}
                    max={period.end || metadata.end}
                    value={clampMonth(period.start, metadata.start, metadata.end)}
                    onChange={(event) => changeStart(event.target.value)}
                  />
                  <span>{t('à', 'to')}</span>
                  <input
                    type="month"
                    aria-label={t('Fin de période', 'Period end')}
                    min={period.start || metadata.start}
                    max={metadata.end}
                    value={clampMonth(period.end, metadata.start, metadata.end)}
                    onChange={(event) => changeEnd(event.target.value)}
                  />
                </div>
              </div>

              <div className="filter-field">
                <span>{t('Raccourcis', 'Quick ranges')}</span>
                <div className="period-presets" role="group" aria-label={t('Raccourcis de période', 'Period quick ranges')}>
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={activePreset === preset.id ? 'selected' : ''}
                      onClick={() => applyPreset(preset.id)}
                    >{preset.id === '12m' ? t('12 mois', '12 months') : preset.id === '36m' ? t('3 ans', '3 years') : preset.id === '60m' ? t('5 ans', '5 years') : t('Toute la période', 'All available')}</button>
                  ))}
                </div>
              </div>
                </>
              )}
            </div>
            <div className="filter-actions">
              <div className="filter-source">
                {isVegetationProduct ? <Leaf size={15} aria-hidden="true" /> : <Database size={15} aria-hidden="true" />}
                <span>{isVegetationProduct
                  ? t('Archive MODIS DV · NDVI/EVI · données locales, fréquence native conservée', 'MODIS DV archive · NDVI/EVI · local data, native frequency preserved')
                  : `${metadata.record_count.toLocaleString(intlLocale)} ${t('lignes source', 'source rows')} · ${formatUnit(metadata.unit, language)} · ${t('données locales', 'local data')}`}</span>
              </div>
              {!isVegetationProduct && (
                <button type="button" className="export-button" disabled={!visibleRows.length} onClick={() => downloadCsv(visibleRows, metadata)}>
                  <ArrowDownRight size={16} aria-hidden="true" /> {t('Exporter les lignes affichées', 'Export displayed rows')}
                </button>
              )}
            </div>
          </section>

          {!isVegetationProduct && (
            <>
          <section className="metric-grid" aria-label={t('Indicateurs de la période sélectionnée', 'Selected period metrics')}>
            <MetricCard
              title={averageTitle}
              value={formatValue(stats.average, metadata, intlLocale, language)}
              note={`${stats.observedMonths} ${t('mois avec une valeur présente', 'months with an available value')}`}
              tone="blue"
            />
            <MetricCard
              title={minimumTitle}
              value={formatValue(stats.minimum, metadata, intlLocale, language)}
              note={minimumPeriodNote(stats.minimumMonths, intlLocale, language)}
              tone="blue"
            />
            <MetricCard
              title={maximumTitle}
              value={formatValue(stats.maximum, metadata, intlLocale, language)}
              note={maximumPeriodNote(stats.maximumMonths, intlLocale, language)}
              tone="orange"
            />
            <MetricCard
              title={t('Mois renseignés', 'Months reported')}
              value={stats.observedMonths.toLocaleString(intlLocale)}
              note={`${t('sur', 'of')} ${stats.expectedMonths} ${t('mois attendus dans la sélection', 'expected months in this selection')}`}
              tone="green"
            />
          </section>

          <div className="dashboard-columns">
            <div className="primary-column">
              <MapPanel metadata={metadata} sector={sectorLabel} observations={visibleRows} />
              <Suspense fallback={<PanelLoadingFallback label={t('Chargement du graphique…', 'Loading chart…')} />}>
                <ChartPanel rows={visibleRows} metadata={metadata} periodLabel={periodLabel} />
              </Suspense>
            </div>

            <aside className="detail-column">
              <section className="panel source-panel" id="sources">
                <div className="panel-heading">
                  <div>
                    <div className="section-title"><Database size={19} aria-hidden="true" /><h2>{t('Source et traçabilité', 'Source and traceability')}</h2></div>
                    <p>{t('Métadonnées du catalogue local FastAPI', 'Local FastAPI catalog metadata')}</p>
                  </div>
                  <Satellite className="source-satellite" size={24} aria-hidden="true" />
                </div>
                <div className="source-dataset-title">
                  <span className="source-tag">NASA</span>
                  <strong>{productLabel}</strong>
                </div>
                <dl className="source-details">
                  <div><dt>{t('Produit / source', 'Product / source')}</dt><dd>{metadata.source}</dd></div>
                  <div><dt>{t('Fichier', 'File')}</dt><dd>{metadata.filename}</dd></div>
                  <div><dt>{t('Agrégation', 'Aggregation')}</dt><dd>{metadata.aggregation}</dd></div>
                  <div><dt>{t('Période disponible', 'Available period')}</dt><dd>{formatMonth(metadata.start, false, intlLocale)} — {formatMonth(metadata.end, false, intlLocale)}</dd></div>
                </dl>
                <Link to="/sources" className="source-details-link">{t('Consulter les sources et les contrôles', 'View sources and checks')} <ArrowRight size={14} aria-hidden="true" /></Link>
              </section>
            </aside>
          </div>
            </>
          )}

          <Suspense fallback={<PanelLoadingFallback label={t('Chargement des analyses…', 'Loading analyses…')} />}>
            {!isVegetationProduct && (
              <TrendAnalysisPanel observations={visibleRows} metadata={metadata} isVegetationProduct={isVegetationProduct} />
            )}
            <VegetationPanel />
          </Suspense>

          <footer className="app-footer">
            <span><strong>Douala Earth Watchers</strong> · {t('Observatoire environnemental de Douala', 'Douala Environmental Observatory')}</span>
            <span><Leaf size={14} aria-hidden="true" /> {t('CSV locaux versionnés · fond de carte © OpenStreetMap', 'Versioned local CSV · basemap © OpenStreetMap')}</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

/** Maintient une place visuelle explicite pendant le téléchargement d’un panneau. */
function PanelLoadingFallback({ label }: { label: string }) {
  return <div className="panel-loading-fallback" role="status" aria-live="polite">{label}</div>;
}

/** Indique l’attente de la réponse du catalogue sans charger de données factices. */
function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <main className="app-message-screen" role="status" aria-live="polite">
      <div className="app-message-card">
        <img className="loading-logo" src={brandLogo} alt="" aria-hidden="true" />
        <span className="loading-mark"><LoaderCircle size={26} className="spin" aria-hidden="true" /></span>
        <span className="eyebrow">DOUALA EARTH WATCHERS</span>
        <h1>{t('Chargement des observations', 'Loading observations')}</h1>
        <p>{t('Lecture du catalogue CSV depuis le backend FastAPI…', 'Reading the CSV catalog from the FastAPI backend…')}</p>
      </div>
    </main>
  );
}

/** Affiche l’échec d’accès API et permet de relancer la requête. */
function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <main className="app-message-screen">
      <div className="app-message-card error-card">
        <span className="loading-mark"><Database size={25} aria-hidden="true" /></span>
        <span className="eyebrow">{t('SOURCE DE DONNÉES INDISPONIBLE', 'DATA SOURCE UNAVAILABLE')}</span>
        <h1>{t('Connexion au backend impossible', 'Unable to connect to backend')}</h1>
        <p>{message}</p>
        <p className="error-hint">{t('Vérifiez que FastAPI tourne sur le port 8000. Les données ne seront pas remplacées par une simulation.', 'Check that FastAPI is running on port 8000. Data will not be replaced with a simulation.')}</p>
        <button type="button" className="primary-button" onClick={onRetry}><RefreshCw size={16} aria-hidden="true" /> {t('Réessayer', 'Retry')}</button>
      </div>
    </main>
  );
}
