/** Page de provenance et de contrôles structurels, avec l’archive MODIS séparée du catalogue mensuel. */
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Database, Info, Leaf, LoaderCircle, MapPin, RefreshCw, Waves } from 'lucide-react';
import { LanguageToggle } from '../components/LanguageToggle';
import { ThemeToggle } from '../components/ThemeToggle';
import brandLogo from '../assets/logo-dew.svg';
import { fetchDashboardData, fetchModisVegetationArchive } from '../lib/api';
import type { DashboardResponse, DatasetMetadata, Observation } from '../lib/api';
import { formatMonth, formatUnit, monthIndex } from '../lib/climate';
import { localizedProductLabel, useTranslation } from '../lib/i18n';

export const Route = createFileRoute('/sources')({
  head: () => ({
    meta: [
      { title: 'Sources et validation — Douala Earth Watchers' },
      { name: 'description', content: 'Sources, périodes, unités et contrôles des séries climatiques locales de Douala.' },
    ],
  }),
  component: SourcesPage,
});

/** Charge le catalogue climatique et rend les états réseau de la page Sources. */
function SourcesPage() {
  const { t } = useTranslation();
  const dashboard = useQuery({
    queryKey: ['dashboard-data'],
    queryFn: ({ signal }) => fetchDashboardData(signal),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return (
    <div className="sources-page-shell">
      <header className="topbar sources-topbar">
        <Link className="brand-lockup" to="/">
          <span className="brand-mark"><img className="brand-logo" src={brandLogo} alt="" aria-hidden="true" /></span>
          <span className="brand-copy">
            <strong>Douala Earth Watchers</strong>
            <small>{t('Sources et validation', 'Sources and validation')}</small>
          </span>
        </Link>
        <div className="sources-header-actions">
          <span className="connection-state"><span className="connection-dot" />{t('Données CSV locales', 'Local CSV data')}</span>
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      {dashboard.isPending ? (
        <main className="sources-content" role="status">
          <div className="app-message-card"><span className="loading-mark"><LoaderCircle className="spin" size={24} aria-hidden="true" /></span><h1>{t('Chargement des sources', 'Loading sources')}</h1><p>{t('Lecture du catalogue CSV local depuis FastAPI…', 'Reading the local CSV catalog from FastAPI…')}</p></div>
        </main>
      ) : dashboard.isError || !dashboard.data ? (
        <main className="sources-content">
          <div className="app-message-card error-card">
            <span className="loading-mark"><Database size={24} aria-hidden="true" /></span>
            <h1>{t('Catalogue indisponible', 'Catalog unavailable')}</h1>
            <p>{dashboard.error instanceof Error ? dashboard.error.message : t('Le backend FastAPI ne répond pas.', 'The FastAPI backend is not responding.')}</p>
            <p className="error-hint">{t('Aucune donnée de remplacement n’est chargée. Vérifiez FastAPI puis réessayez.', 'No replacement data is loaded. Check FastAPI and try again.')}</p>
            <div className="message-actions">
              <button type="button" className="primary-button" onClick={() => { void dashboard.refetch(); }}><RefreshCw size={15} aria-hidden="true" /> {t('Réessayer', 'Retry')}</button>
              <Link to="/" className="secondary-link">{t('Retour au tableau de bord', 'Back to the dashboard')}</Link>
            </div>
          </div>
        </main>
      ) : (
        <SourcesContent payload={dashboard.data} />
      )}
    </div>
  );
}

/** Résumé des contrôles structurels appliqués à une série mensuelle locale. */
interface Inspection {
  valid: boolean;
  rowCount: number;
  observedMonths: number;
  expectedMonths: number;
  invalidRows: number;
  duplicateMonths: number;
}

/** Vérifie la cohérence structurelle; ce contrôle n’est pas une validation scientifique. */
function inspectDataset(metadata: DatasetMetadata, rows: Observation[]): Inspection {
  const seen = new Set<string>();
  const months = new Set<string>();
  let invalidRows = 0;
  let duplicateMonths = 0;

  for (const row of rows) {
    const month = row.date.slice(0, 7);
    const monthIndexValue = monthIndex(month);
    const withinSourcePeriod = month >= metadata.start && month <= metadata.end;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || monthIndexValue === 0 || !Number.isFinite(row.value) || !row.sector.trim() || !metadata.sectors.includes(row.sector) || !withinSourcePeriod) {
      invalidRows += 1;
    }
    const key = `${month}:${row.sector}`;
    if (seen.has(key)) duplicateMonths += 1;
    seen.add(key);
    months.add(month);
  }

  const expectedMonths = Math.max(0, monthIndex(metadata.end) - monthIndex(metadata.start) + 1);
  const valid = rows.length === metadata.record_count && invalidRows === 0 && duplicateMonths === 0;
  return { valid, rowCount: rows.length, observedMonths: months.size, expectedMonths, invalidRows, duplicateMonths };
}

/** Présente les séries mensuelles et leurs contrôles à partir du payload reçu. */
function SourcesContent({ payload }: { payload: DashboardResponse }) {
  const { t, intlLocale } = useTranslation();
  const datasets = Object.entries(payload.catalog).map(([kind, metadata]) => {
    const rows = payload.datasets[kind]?.data ?? [];
    return { kind, metadata, inspection: inspectDataset(metadata, rows) };
  });
  const checkedDatasets = datasets.filter(({ inspection }) => inspection.valid).length;

  return (
    <main className="sources-content">
      <div className="sources-page-intro">
        <div>
          <span className="eyebrow">{t('CATALOGUE LOCAL · CONTRÔLES TRANSPARENTS', 'LOCAL CATALOG · TRANSPARENT CHECKS')}</span>
          <h1>{t('Sources et validation', 'Sources and validation')}</h1>
          <p>{t('Sources, périodes, unités et contrôles de cohérence des séries versionnées du dépôt.', 'Sources, periods, units and consistency checks for the versioned series in the repository.')}</p>
        </div>
        <Link to="/" className="back-link"><ArrowLeft size={15} aria-hidden="true" /> {t('Retour au tableau de bord', 'Back to the dashboard')}</Link>
      </div>

      <section className="panel validation-panel" aria-labelledby="validation-title">
        <div className="panel-heading">
          <div>
            <div className="section-title"><CheckCircle2 size={19} aria-hidden="true" /><h2 id="validation-title">{t('Contrôles des données chargées', 'Checks on loaded data')}</h2></div>
            <p>{t('Vérification structurelle de chaque série reçue de l’API.', 'Structural verification of every series returned by the API.')}</p>
          </div>
          <span className={`validation-count ${checkedDatasets === datasets.length ? 'validation-count-ok' : 'validation-count-warning'}`}>
            {checkedDatasets} / {datasets.length} {t('séries cohérentes', 'consistent series')}
          </span>
        </div>
        <div className="validation-rule-grid">
          <div><strong>{t('Contrôle dans l’API', 'API-side check')}</strong><span>{t('Colonnes, dates, valeurs finies, secteur non vide et unicité du mois par secteur.', 'Columns, dates, finite values, non-empty area and one month per area.')}</span></div>
          <div><strong>{t('Contrôle de cette page', 'Page-side check')}</strong><span>{t('Nombre de lignes, valeur numérique, secteur du catalogue, période source et doublons mois/secteur.', 'Row count, numeric value, catalog area, source period and month/area duplicates.')}</span></div>
          <div><strong>{t('Valeurs manquantes', 'Missing values')}</strong><span>{t('Aucune interpolation : les mois présents sont comptés séparément des mois attendus.', 'No interpolation: present months are counted separately from expected months.')}</span></div>
        </div>
        <p className="validation-note"><Info size={15} aria-hidden="true" /> {t('Ces contrôles vérifient la structure et la cohérence du fichier; ils ne constituent pas une validation indépendante des produits NASA.', 'These checks verify the file structure and consistency; they are not an independent validation of the NASA products.')}</p>
      </section>

      <section className="source-record-grid" aria-label={t('Catalogue des séries mensuelles disponibles', 'Catalog of available monthly series')}>
        {datasets.map(({ kind, metadata, inspection }) => (
          <SourceRecord key={kind} kind={kind} metadata={metadata} inspection={inspection} />
        ))}
      </section>

      {/* Cette archive MODIS reste séparée des séries mensuelles utilisées par le dashboard. */}
      <ModisArchivePanel />

      <div className="validation-cta-row">
        <Link to="/previsions" className="export-button">{t('Prévisions et alertes', 'Forecasts and alerts')} <ArrowRight size={14} aria-hidden="true" /></Link>
        <Link to="/validation-scientifique" className="export-button">{t('Backtest scientifique', 'Scientific backtest')} <ArrowRight size={14} aria-hidden="true" /></Link>
      </div>

      <footer className="app-footer sources-footer">
        <span><strong>Douala Earth Watchers</strong> · {t('données locales versionnées', 'versioned local data')}</span>
        <span><Database size={14} aria-hidden="true" /> {datasets.reduce((total, dataset) => total + dataset.inspection.rowCount, 0).toLocaleString(intlLocale)} {t('lignes reçues', 'rows received')} · {payload.source}</span>
      </footer>
    </main>
  );
}

// Charge et présente séparément le point MODIS, sa fréquence et ses comptes de QA réels.
function ModisArchivePanel() {
  const { t } = useTranslation();
  // Le petit JSON est relu depuis l’API; aucune acquisition NASA n’est lancée dans le navigateur.
  const archive = useQuery({
    queryKey: ['modis-vegetation-dv'],
    queryFn: ({ signal }) => fetchModisVegetationArchive(signal),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Le panneau conserve explicitement les états chargement, erreur et données.
  return (
    <section className="panel validation-panel" aria-labelledby="modis-archive-title">
      <div className="panel-heading">
        <div>
          <div className="section-title"><Leaf size={19} aria-hidden="true" /><h2 id="modis-archive-title">{t('Végétation observée — MODIS', 'Observed vegetation — MODIS')}</h2></div>
          <p>{t('Archive NDVI/EVI de Douala; source d’observation distincte, exclue des prévisions T2M.', 'Douala NDVI/EVI archive; a separate observation source, excluded from T2M forecasts.')}</p>
        </div>
        <span className="source-tag">MOD13Q1.061</span>
      </div>

      {archive.isPending ? (
        <p role="status">{t('Chargement de l’archive MODIS et de ses contrôles qualité…', 'Loading the MODIS archive and its quality checks…')}</p>
      ) : archive.isError || !archive.data ? (
        <p className="error-hint">{archive.error instanceof Error ? archive.error.message : t('L’archive MODIS est indisponible; aucune valeur de remplacement n’est affichée.', 'The MODIS archive is unavailable; no replacement value is displayed.')}</p>
      ) : (
        <>
          {/* Ces métadonnées décrivent le produit réellement archivé, pas une extrapolation spatiale. */}
          <div className="validation-rule-grid">
            <div><strong>{t('Point / produit', 'Point / product')}</strong><span>{archive.data.metadata.latitude.toFixed(2)}°N, {archive.data.metadata.longitude.toFixed(2)}°E · {archive.data.metadata.product}</span></div>
            <div><strong>{t('Résolution / fréquence', 'Resolution / frequency')}</strong><span>{archive.data.metadata.spatial_resolution_m} m · {t('composites de', 'composites of')} {archive.data.metadata.temporal_resolution_days} {t('jours', 'days')}</span></div>
            <div><strong>{t('Couverture reçue', 'Coverage received')}</strong><span>{archive.data.metadata.start} — {archive.data.metadata.end} · {archive.data.metadata.record_count} {t('composites', 'composites')}</span></div>
            <div><strong>{t('Fenêtre demandée', 'Requested window')}</strong><span>{archive.data.metadata.requested_start} — {archive.data.metadata.requested_end}</span></div>
          </div>

          {/* Les rangs sont calculés depuis le CSV brut et restent des comptes QA, pas des scores de prévision. */}
          <div className="qa-grid">
            <article className="qa-card"><span className="qa-icon"><CheckCircle2 size={17} aria-hidden="true" /></span><div><strong>{t('QA bonne — rang 0', 'Good QA — rank 0')}</strong><p>{archive.data.metadata.quality_counts.good} {t('composites', 'composites')}</p></div></article>
            <article className="qa-card"><span className="qa-icon"><Info size={17} aria-hidden="true" /></span><div><strong>{t('QA marginale — rang 1', 'Marginal QA — rank 1')}</strong><p>{archive.data.metadata.quality_counts.marginal} {t('composites', 'composites')}</p></div></article>
            <article className="qa-card"><span className="qa-icon"><AlertTriangle size={17} aria-hidden="true" /></span><div><strong>{t('QA nuageuse — rang 3', 'Cloudy QA — rank 3')}</strong><p>{archive.data.metadata.quality_counts.cloudy} {t('composites', 'composites')}</p></div></article>
            <article className="qa-card"><span className="qa-icon"><MapPin size={17} aria-hidden="true" /></span><div><strong>{t('Masque côtier', 'Coastal mask')}</strong><p>{archive.data.metadata.land_water_mask_counts['Ocean coastlines and lake shorelines'] ?? 0} {t('composites classés « Ocean coastlines and lake shorelines »', 'composites flagged “Ocean coastlines and lake shorelines”')}</p></div></article>
          </div>

          {/* Le conflit AppEEARS et les limites scientifiques accompagnent les valeurs servies. */}
          <p className="validation-note"><AlertTriangle size={15} aria-hidden="true" />{archive.data.metadata.status_warning}</p>
        </>
      )}
    </section>
  );
}

// Rend les métadonnées des séries mensuelles chargées par le catalogue principal.
function SourceRecord({ kind, metadata, inspection }: { kind: string; metadata: DatasetMetadata; inspection: Inspection }) {
  const { t, intlLocale, language } = useTranslation();
  return (
    <article className="panel source-record-card">
      <div className="source-record-heading">
        <span className="source-tag">NASA</span>
        <div><h2>{localizedProductLabel(metadata.kind, metadata.label, t)}</h2><p>{metadata.source}</p></div>
        <span className={`validation-badge ${inspection.valid ? 'validation-badge-ok' : 'validation-badge-warning'}`}>
          {inspection.valid ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />}
          {inspection.valid ? t('Contrôles passés', 'Checks passed') : t('À vérifier', 'To review')}
        </span>
      </div>
      <dl className="source-details source-record-details">
        <div><dt>{t('Identifiant API', 'API identifier')}</dt><dd><code>{kind}</code></dd></div>
        <div><dt>{t('Fichier local', 'Local file')}</dt><dd>{metadata.filename}</dd></div>
        <div><dt>Variable</dt><dd>{metadata.variable}</dd></div>
        <div><dt>{t('Unité', 'Unit')}</dt><dd>{formatUnit(metadata.unit, language)}</dd></div>
        <div><dt>{t('Agrégation', 'Aggregation')}</dt><dd>{metadata.aggregation}</dd></div>
        <div><dt>{t('Résolution', 'Resolution')}</dt><dd>{metadata.spatial_resolution}</dd></div>
        <div><dt>{t('Période source', 'Source period')}</dt><dd>{formatMonth(metadata.start, false, intlLocale)} — {formatMonth(metadata.end, false, intlLocale)}</dd></div>
        <div><dt>{t('Mois présents / attendus', 'Months present / expected')}</dt><dd>{inspection.observedMonths} / {inspection.expectedMonths}</dd></div>
        <div><dt>{t('Lignes reçues / catalogue', 'Rows received / catalog')}</dt><dd>{inspection.rowCount.toLocaleString(intlLocale)} / {metadata.record_count.toLocaleString(intlLocale)}</dd></div>
        <div><dt>{t('Lignes invalides / doublons', 'Invalid rows / duplicates')}</dt><dd>{inspection.invalidRows} / {inspection.duplicateMonths}</dd></div>
      </dl>
      <p className="source-note"><Info size={15} aria-hidden="true" />{metadata.provenance_note}</p>
    </article>
  );
}
