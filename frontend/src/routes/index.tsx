/** Tableau de bord des produits climatiques mensuels et des composites de végétation MODIS. */
import { useEffect, useMemo, useState } from 'react';
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
  Info,
  Leaf,
  LoaderCircle,
  Map,
  MapPin,
  Menu,
  RefreshCw,
  Satellite,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { ChartPanel } from '../components/ChartPanel';
import { MapPanel } from '../components/MapPanel';
import { VegetationPanel } from '../components/VegetationPanel';
import { MetricCard } from '../components/MetricCard';
import { ThemeToggle } from '../components/ThemeToggle';
import cityImage from '../assets/douala-city.jpg';
import { fetchDashboardData } from '../lib/api';
import type { DashboardResponse, DatasetMetadata } from '../lib/api';
import {
  downloadCsv,
  formatMonth,
  formatValue,
  maximumPeriodNote,
  minimumPeriodNote,
  periodForPreset,
  rowsForPeriod,
  summarizeRows,
  type Period,
  type PeriodPreset,
} from '../lib/climate';

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
  icon: LucideIcon;
}

// Garde les sections et les routes distinctes dans un même ordre de navigation.
const navigation: NavigationItem[] = [
  { id: 'overview', label: 'Vue d’ensemble', icon: Home },
  { id: 'map', label: 'Carte de référence', icon: Map },
  { id: 'series', label: 'Évolution temporelle', icon: Activity },
  { id: 'vegetation', label: 'Végétation', icon: Leaf },
  { id: 'previsions', label: 'Prévisions et alertes', icon: BellRing },
  { id: 'sources', label: 'Sources et validation', icon: Database },
];

// Identifiant d’interface séparé, car l’archive MODIS n’appartient pas au catalogue mensuel.
const MODIS_VEGETATION_KIND = 'modis_vegetation';

// Raccourcis proposés pour les séries climatiques uniquement.
const presets: { id: PeriodPreset; label: string }[] = [
  { id: '12m', label: '12 mois' },
  { id: '36m', label: '3 ans' },
  { id: '60m', label: '5 ans' },
  { id: 'all', label: 'Toute la période' },
];

/** Maintient une valeur de mois dans la couverture déclarée par la source. */
function clampMonth(value: string, minimum: string, maximum: string): string {
  if (!value) return minimum;
  return value < minimum ? minimum : value > maximum ? maximum : value;
}

/** Charge le catalogue local et choisit un état chargement, erreur ou contenu. */
function DashboardPage() {
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
      : 'Le backend FastAPI ne répond pas.';
    return <ErrorScreen message={message} onRetry={() => { void dashboard.refetch(); }} />;
  }

  return <DashboardContent payload={dashboard.data} />;
}

/** Synchronise les filtres d’affichage et les statistiques des observations reçues. */
function DashboardContent({ payload }: { payload: DashboardResponse }) {
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
    return <ErrorScreen message="Le backend n’a renvoyé aucune série exploitable pour cet indicateur." onRetry={() => window.location.reload()} />;
  }

  const periodLabel = isVegetationProduct
    ? 'MODIS DV · composites de 16 jours'
    : period.start && period.end
      ? `${formatMonth(period.start)} — ${formatMonth(period.end)}`
      : 'Période indisponible';
  const sectorLabel = selectedSector || 'Tous les secteurs';

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
  const averageTitle = isAirTemperature ? 'Température moyenne de l’air' : 'Moyenne sur la période';
  const minimumTitle = isAirTemperature ? 'Minimum de l’air à 2 m' : 'Minimum observé';
  const maximumTitle = isAirTemperature ? 'Maximum de l’air à 2 m' : 'Maximum observé';

  return (
    <div className="dashboard-shell min-h-screen bg-background font-sans text-foreground">
      <header className="topbar">
        <button
          className="mobile-menu-button"
          type="button"
          aria-label={mobileNavOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          <Menu size={21} aria-hidden="true" />
        </button>
        <a className="brand-lockup" href="#overview" onClick={(event) => { event.preventDefault(); navigateTo('overview'); }}>
          <span className="brand-mark"><Waves size={23} aria-hidden="true" /></span>
          <span className="brand-copy">
            <strong>Douala Earth Watchers</strong>
            <small>Observatoire environnemental de Douala</small>
          </span>
        </a>
        <div className="topbar-context">
          <div className="topbar-pill"><MapPin size={16} aria-hidden="true" /><span><strong>Douala</strong><small>Littoral, Cameroun</small></span></div>
          <div className="topbar-pill topbar-period"><CalendarDays size={16} aria-hidden="true" /><span>{periodLabel}</span></div>
          <div className="connection-state"><span className="connection-dot" /><span>Mode démo · CSV locaux</span></div>
          <ThemeToggle />
        </div>
      </header>

      <div className="app-layout">
        <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`} aria-label="Navigation du tableau de bord">
          <nav className="sidebar-nav">
            {navigation
              .filter(({ id }) => !isVegetationProduct || !['map', 'series'].includes(id))
              .map(({ id, label, icon: Icon }) => id === 'sources' ? (
              <Link key={id} to="/sources" className="sidebar-link">
                <Icon size={19} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ) : id === 'previsions' ? (
              <Link key={id} to="/previsions" className="sidebar-link">
                <Icon size={19} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ) : (
              <button
                key={id}
                type="button"
                className={`sidebar-link ${activeSection === id ? 'active' : ''}`}
                aria-current={activeSection === id ? 'page' : undefined}
                onClick={() => navigateTo(id)}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-visual">
            <img src={cityImage} alt="" loading="lazy" />
            <div className="sidebar-image-shade" />
            <div className="sidebar-visual-copy">
              <span>PRODUITS NASA · CSV LOCAUX</span>
              <p>Des séries documentées, avec leurs limites visibles.</p>
              <Leaf size={19} aria-hidden="true" />
            </div>
          </div>
          <div className="sidebar-status"><span className="status-dot" />Séries agrégées, provenance vérifiable</div>
        </aside>

        <main className="main-content">
          <section className="page-intro" id="overview">
            <div>
              <span className="eyebrow">{isVegetationProduct ? 'OBSERVATIONS DE VÉGÉTATION · MODIS' : 'SÉRIES CLIMATIQUES · CAMEROUN'}</span>
              <h1>{isVegetationProduct ? 'Composites de végétation MODIS DV.' : 'Le climat de Douala, en données.'}</h1>
              <p>{isVegetationProduct ? 'Explorez NDVI et EVI sur les dates composites réellement reçues, sans interpolation ni extrapolation à tous les quartiers.' : 'Explorez les séries mensuelles, leur provenance et les mois réellement disponibles — sans valeurs simulées.'}</p>
            </div>
            <div className="period-summary"><CalendarDays size={16} aria-hidden="true" /><span>{periodLabel}</span></div>
          </section>

          <section className="filter-panel" aria-label={isVegetationProduct ? 'Sélection du produit de végétation' : 'Filtres des séries climatiques'}>
            <div className="filter-fields">
              <label className="filter-field">
                <span>Série / produit</span>
                <div className="select-wrap">
                  <select value={selectedProduct} onChange={(event) => changeKind(event.target.value)} aria-label="Choisir une série ou un produit">
                    {Object.entries(payload.catalog).map(([datasetKind, item]) => (
                      <option key={datasetKind} value={datasetKind}>{item.label}</option>
                    ))}
                    <option value={MODIS_VEGETATION_KIND}>Végétation observée · MODIS DV</option>
                  </select>
                  <ChevronDown size={15} aria-hidden="true" />
                </div>
              </label>

              {isVegetationProduct ? (
                <div className="vegetation-product-context" role="note">
                  <strong>MOD13Q1.061 · composites natifs de 16 jours</strong>
                  <span>Le point de référence est unique; secteur et période mensuelle ne s’appliquent pas à cette archive.</span>
                </div>
              ) : (
                <>
              <label className="filter-field">
                <span>Zone de données</span>
                <div className="select-wrap">
                  <select value={selectedSector} onChange={(event) => setSelectedSector(event.target.value)} aria-label="Choisir une zone">
                    {metadata.sectors.length > 1 && <option value="">Toutes les zones</option>}
                    {metadata.sectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
                  </select>
                  <ChevronDown size={15} aria-hidden="true" />
                </div>
              </label>

              <div className="filter-field period-field">
                <span id="period-label">Période mensuelle</span>
                <div className="month-inputs" aria-labelledby="period-label">
                  <input
                    type="month"
                    aria-label="Début de période"
                    min={metadata.start}
                    max={period.end || metadata.end}
                    value={clampMonth(period.start, metadata.start, metadata.end)}
                    onChange={(event) => changeStart(event.target.value)}
                  />
                  <span>à</span>
                  <input
                    type="month"
                    aria-label="Fin de période"
                    min={period.start || metadata.start}
                    max={metadata.end}
                    value={clampMonth(period.end, metadata.start, metadata.end)}
                    onChange={(event) => changeEnd(event.target.value)}
                  />
                </div>
              </div>

              <div className="filter-field preset-field">
                <span>Raccourcis</span>
                <div className="period-presets" role="group" aria-label="Raccourcis de période">
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={activePreset === preset.id ? 'selected' : ''}
                      onClick={() => applyPreset(preset.id)}
                    >{preset.label}</button>
                  ))}
                </div>
              </div>
                </>
              )}
            </div>
            <div className="filter-actions">
              <div className="filter-source">
                {isVegetationProduct ? <Leaf size={15} aria-hidden="true" /> : <Database size={15} aria-hidden="true" />}
                <span>{isVegetationProduct ? 'Archive MODIS DV · NDVI/EVI · données locales, fréquence native conservée' : `${metadata.record_count.toLocaleString('fr-FR')} lignes source · ${metadata.unit} · données locales`}</span>
              </div>
              {!isVegetationProduct && (
                <button type="button" className="export-button" disabled={!visibleRows.length} onClick={() => downloadCsv(visibleRows, metadata)}>
                  <ArrowDownRight size={16} aria-hidden="true" /> Exporter les lignes affichées
                </button>
              )}
            </div>
          </section>

          {!isVegetationProduct && (
            <>
          <section className="metric-grid" aria-label="Indicateurs de la période sélectionnée">
            <MetricCard
              title={averageTitle}
              value={formatValue(stats.average, metadata)}
              note={`${stats.observedMonths} mois avec une valeur présente`}
              tone="blue"
            />
            <MetricCard
              title={minimumTitle}
              value={formatValue(stats.minimum, metadata)}
              note={minimumPeriodNote(stats.minimumMonths)}
              tone="blue"
            />
            <MetricCard
              title={maximumTitle}
              value={formatValue(stats.maximum, metadata)}
              note={maximumPeriodNote(stats.maximumMonths)}
              tone="orange"
            />
            <MetricCard
              title="Mois renseignés"
              value={stats.observedMonths.toLocaleString('fr-FR')}
              note={`sur ${stats.expectedMonths} mois attendus dans la sélection`}
              tone="green"
            />
          </section>

          <div className="dashboard-columns">
            <div className="primary-column">
              <MapPanel metadata={metadata} sector={sectorLabel} observations={visibleRows} />
              <ChartPanel rows={visibleRows} metadata={metadata} periodLabel={periodLabel} />
            </div>

            <aside className="detail-column">
              <section className="panel source-panel" id="sources">
                <div className="panel-heading">
                  <div>
                    <div className="section-title"><Database size={19} aria-hidden="true" /><h2>Source et traçabilité</h2></div>
                    <p>Métadonnées du catalogue local FastAPI</p>
                  </div>
                  <Satellite className="source-satellite" size={24} aria-hidden="true" />
                </div>
                <div className="source-dataset-title">
                  <span className="source-tag">NASA</span>
                  <strong>{metadata.label}</strong>
                </div>
                <dl className="source-details">
                  <div><dt>Produit / source</dt><dd>{metadata.source}</dd></div>
                  <div><dt>Variable</dt><dd>{metadata.variable}</dd></div>
                  <div><dt>Fichier</dt><dd>{metadata.filename}</dd></div>
                  <div><dt>Unité</dt><dd>{metadata.unit}</dd></div>
                  <div><dt>Agrégation</dt><dd>{metadata.aggregation}</dd></div>
                  <div><dt>Résolution</dt><dd>{metadata.spatial_resolution}</dd></div>
                  <div><dt>Période disponible</dt><dd>{formatMonth(metadata.start)} — {formatMonth(metadata.end)}</dd></div>
                  <div><dt>Lignes dans le CSV</dt><dd>{metadata.record_count.toLocaleString('fr-FR')}</dd></div>
                </dl>
                <div className="source-note">
                  <Info size={16} aria-hidden="true" />
                  <p>{metadata.provenance_note}</p>
                </div>
                <Link to="/sources" className="source-details-link">Consulter les sources et les contrôles <ArrowRight size={14} aria-hidden="true" /></Link>
              </section>

              <ZonePanel metadata={metadata} sector={sectorLabel} rows={visibleRows} stats={stats} period={periodLabel} />
            </aside>
          </div>
            </>
          )}

          <VegetationPanel />

          <section className="availability-panel" aria-labelledby="availability-title">
            <div className="panel-heading">
              <div>
                <div className="section-title"><Info size={18} aria-hidden="true" /><h2 id="availability-title">Données et usages indisponibles — aucune valeur simulée</h2></div>
                <p>Les éléments ci-dessous exigent une source ou une validation qui n’est pas disponible dans cette archive.</p>
              </div>
            </div>
            <div className="availability-grid">
              <AvailabilityCard icon={Leaf} title="NDVI comme indicateur climatique mensuel" detail="L’archive MODIS DV est accessible dans le sélecteur Série / produit et la section Végétation, à sa fréquence native de 16 jours et avec ses QA. Elle reste séparée des statistiques T2M/précipitations et de toute prévision." />
              <AvailabilityCard icon={Satellite} title="Température de surface (LST)" detail="Aucun raster LST disponible. T2M décrit la température de l’air à 2 m, pas celle de la surface." />
              <AvailabilityCard icon={Activity} title="Prévision actuelle et alertes officielles" detail="Le backtest historique et les seuils exploratoires sont accessibles dans Prévisions et alertes. Faute de snapshot récent et de flux d’autorité, aucune valeur future ni aucun avis officiel n’est publié." />
            </div>
          </section>

          <footer className="app-footer">
            <span><strong>Douala Earth Watchers</strong> · Observatoire environnemental de Douala</span>
            <span><Leaf size={14} aria-hidden="true" /> CSV locaux versionnés · fond de carte © OpenStreetMap</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

/** Données filtrées nécessaires au résumé spatial agrégé du dashboard. */
interface ZonePanelProps {
  metadata: DatasetMetadata;
  sector: string;
  rows: { date: string; sector: string; value: number }[];
  stats: ReturnType<typeof summarizeRows>;
  period: string;
}

/** Récapitule les coordonnées de référence et la couverture sans détail par quartier. */
function ZonePanel({ metadata, sector, rows, stats, period }: ZonePanelProps) {
  return (
    <section className="panel zone-panel">
      <div className="panel-heading">
        <div>
          <div className="section-title"><MapPin size={18} aria-hidden="true" /><h2>Repère spatial</h2></div>
          <p>Coordonnée de référence du catalogue, pas un point de mesure par quartier</p>
        </div>
      </div>
      <div className="zone-name"><strong>{sector}</strong><span>AGRÉGAT</span></div>
      <div className="coordinate-line">{metadata.latitude.toFixed(3)}° N <span>·</span> {metadata.longitude.toFixed(3)}° E</div>
      <dl className="zone-stats">
        <div><dt>Mois renseignés / attendus</dt><dd>{stats.observedMonths} / {stats.expectedMonths}</dd></div>
        <div><dt>Observations dans la sélection</dt><dd>{rows.length.toLocaleString('fr-FR')}</dd></div>
        <div><dt>Période affichée</dt><dd>{period}</dd></div>
        <div><dt>Résolution annoncée</dt><dd>{metadata.spatial_resolution}</dd></div>
      </dl>
      <p className="zone-disclaimer">La coordonnée est un repère du catalogue. Les séries sont agrégées ou ponctuelles et ne localisent pas chaque observation à l’intérieur de Douala.</p>
    </section>
  );
}

/** Contenu d’une carte qui explique une source ou fonction non disponible. */
interface AvailabilityCardProps {
  icon: LucideIcon;
  title: string;
  detail: string;
}

/** Rend une limite ou une source indisponible avec son explication explicite. */
function AvailabilityCard({ icon: Icon, title, detail }: AvailabilityCardProps) {
  return (
    <article className="availability-card">
      <span className="availability-icon"><Icon size={17} aria-hidden="true" /></span>
      <div><strong>{title}</strong><p>{detail}</p></div>
    </article>
  );
}

/** Indique l’attente de la réponse du catalogue sans charger de données factices. */
function LoadingScreen() {
  return (
    <main className="app-message-screen" role="status" aria-live="polite">
      <div className="app-message-card">
        <span className="loading-mark"><LoaderCircle size={26} className="spin" aria-hidden="true" /></span>
        <span className="eyebrow">DOUALA EARTH WATCHERS</span>
        <h1>Chargement des observations</h1>
        <p>Lecture du catalogue CSV depuis le backend FastAPI…</p>
      </div>
    </main>
  );
}

/** Affiche l’échec d’accès API et permet de relancer la requête. */
function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="app-message-screen">
      <div className="app-message-card error-card">
        <span className="loading-mark"><Database size={25} aria-hidden="true" /></span>
        <span className="eyebrow">SOURCE DE DONNÉES INDISPONIBLE</span>
        <h1>Connexion au backend impossible</h1>
        <p>{message}</p>
        <p className="error-hint">Vérifiez que FastAPI tourne sur le port 8000. Les données ne seront pas remplacées par une simulation.</p>
        <button type="button" className="primary-button" onClick={onRetry}><RefreshCw size={16} aria-hidden="true" /> Réessayer</button>
      </div>
    </main>
  );
}
