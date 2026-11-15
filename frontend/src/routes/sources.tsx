/** Page de provenance et de contrôles structurels, avec l’archive MODIS séparée du catalogue mensuel. */
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Activity, AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Database, Info, Leaf, LoaderCircle, MapPin, RefreshCw, Satellite, Waves, type LucideIcon } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { fetchDashboardData, fetchModisVegetationArchive } from '../lib/api';
import type { DashboardResponse, DatasetMetadata, Observation } from '../lib/api';
import { formatMonth, monthIndex } from '../lib/climate';

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
          <span className="brand-mark"><Waves size={23} aria-hidden="true" /></span>
          <span className="brand-copy">
            <strong>Douala Earth Watchers</strong>
            <small>Sources et validation</small>
          </span>
        </Link>
        <div className="sources-header-actions">
          <span className="connection-state"><span className="connection-dot" />Données CSV locales</span>
          <ThemeToggle />
        </div>
      </header>

      {dashboard.isPending ? (
        <main className="sources-content" role="status">
          <div className="app-message-card"><span className="loading-mark"><LoaderCircle className="spin" size={24} aria-hidden="true" /></span><h1>Chargement des sources</h1><p>Lecture du catalogue CSV local depuis FastAPI…</p></div>
        </main>
      ) : dashboard.isError || !dashboard.data ? (
        <main className="sources-content">
          <div className="app-message-card error-card">
            <span className="loading-mark"><Database size={24} aria-hidden="true" /></span>
            <h1>Catalogue indisponible</h1>
            <p>{dashboard.error instanceof Error ? dashboard.error.message : 'Le backend FastAPI ne répond pas.'}</p>
            <p className="error-hint">Aucune donnée de remplacement n’est chargée. Vérifiez FastAPI puis réessayez.</p>
            <div className="message-actions">
              <button type="button" className="primary-button" onClick={() => { void dashboard.refetch(); }}><RefreshCw size={15} aria-hidden="true" /> Réessayer</button>
              <Link to="/" className="secondary-link">Retour au tableau de bord</Link>
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
  const datasets = Object.entries(payload.catalog).map(([kind, metadata]) => {
    const rows = payload.datasets[kind]?.data ?? [];
    return { kind, metadata, inspection: inspectDataset(metadata, rows) };
  });
  const checkedDatasets = datasets.filter(({ inspection }) => inspection.valid).length;

  return (
    <main className="sources-content">
      <div className="sources-page-intro">
        <div>
          <span className="eyebrow">CATALOGUE LOCAL · CONTRÔLES TRANSPARENTS</span>
          <h1>Sources et validation</h1>
          <p>Les indicateurs viennent des CSV versionnés du dépôt. L’interface ne lance pas de requête vers NASA et ne remplace pas une source manquante.</p>
        </div>
        <Link to="/" className="back-link"><ArrowLeft size={15} aria-hidden="true" /> Retour au tableau de bord</Link>
      </div>

      <section className="panel validation-panel" aria-labelledby="validation-title">
        <div className="panel-heading">
          <div>
            <div className="section-title"><CheckCircle2 size={19} aria-hidden="true" /><h2 id="validation-title">Contrôles des données chargées</h2></div>
            <p>Résultat calculé sur le payload reçu de l’API pour chaque série.</p>
          </div>
          <span className={`validation-count ${checkedDatasets === datasets.length ? 'validation-count-ok' : 'validation-count-warning'}`}>
            {checkedDatasets} / {datasets.length} séries cohérentes
          </span>
        </div>
        <div className="validation-rule-grid">
          <div><strong>Contrôle dans l’API</strong><span>Colonnes, dates, valeurs finies, secteur non vide et unicité du mois par secteur.</span></div>
          <div><strong>Contrôle de cette page</strong><span>Nombre de lignes, valeur numérique, secteur du catalogue, période source et doublons mois/secteur.</span></div>
          <div><strong>Valeurs manquantes</strong><span>Aucune interpolation : les mois présents sont comptés séparément des mois attendus.</span></div>
        </div>
        <p className="validation-note"><Info size={15} aria-hidden="true" /> Ces contrôles vérifient la structure et la cohérence du fichier; ils ne constituent pas une validation indépendante des produits NASA.</p>
      </section>

      <section className="source-record-grid" aria-label="Catalogue des séries mensuelles disponibles">
        {datasets.map(({ kind, metadata, inspection }) => (
          <SourceRecord key={kind} kind={kind} metadata={metadata} inspection={inspection} />
        ))}
      </section>

      {/* Cette archive MODIS reste séparée des séries mensuelles utilisées par le dashboard. */}
      <ModisArchivePanel />

      <section className="panel unavailable-panel" aria-labelledby="unavailable-title">
        <div className="panel-heading">
          <div>
            <div className="section-title"><AlertTriangle size={19} aria-hidden="true" /><h2 id="unavailable-title">Données et fonctions absentes</h2></div>
            <p>Ces limites sont visibles plutôt que masquées par une valeur fictive.</p>
          </div>
        </div>
        <div className="unavailable-grid">
          <UnavailableItem icon={Satellite} title="Température de surface (LST)" detail="Aucun raster ou CSV LST exploitable. T2M mesure la température de l’air à 2 m, pas la température de surface." />
          <UnavailableItem icon={Activity} title="Prévision actuelle et alertes officielles" detail="Le backtest historique T2M est disponible dans une page distincte et les seuils exploratoires sont configurables. Le snapshot s’arrête au 2025-12-31, sans date de récupération, et aucune source officielle d’alerte n’est connectée." />
          <UnavailableItem icon={MapPin} title="Valeur par clic ou quartier" detail="Les séries sont agrégées ou ponctuelles et aucun raster ni polygone n’est disponible. Le fond OpenStreetMap n’est pas une couche de mesure." />
        </div>
      </section>

      <div className="validation-cta-row">
        <Link to="/previsions" className="export-button">Prévisions et alertes <ArrowRight size={14} aria-hidden="true" /></Link>
        <Link to="/validation-scientifique" className="export-button">Backtest scientifique <ArrowRight size={14} aria-hidden="true" /></Link>
      </div>

      <footer className="app-footer sources-footer">
        <span><strong>Douala Earth Watchers</strong> · Mode démo sur données locales</span>
        <span><Database size={14} aria-hidden="true" /> {datasets.reduce((total, dataset) => total + dataset.inspection.rowCount, 0).toLocaleString('fr-FR')} lignes reçues · {payload.source}</span>
      </footer>
    </main>
  );
}

// Charge et présente séparément le point MODIS, sa fréquence et ses comptes de QA réels.
function ModisArchivePanel() {
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
          <div className="section-title"><Leaf size={19} aria-hidden="true" /><h2 id="modis-archive-title">Végétation observée — MODIS</h2></div>
          <p>Archive NDVI/EVI de Douala; source d’observation distincte, exclue des prévisions T2M.</p>
        </div>
        <span className="source-tag">MOD13Q1.061</span>
      </div>

      {archive.isPending ? (
        <p role="status">Chargement de l’archive MODIS et de ses contrôles qualité…</p>
      ) : archive.isError || !archive.data ? (
        <p className="error-hint">{archive.error instanceof Error ? archive.error.message : 'L’archive MODIS est indisponible; aucune valeur de remplacement n’est affichée.'}</p>
      ) : (
        <>
          {/* Ces métadonnées décrivent le produit réellement archivé, pas une extrapolation spatiale. */}
          <div className="validation-rule-grid">
            <div><strong>Point / produit</strong><span>{archive.data.metadata.latitude.toFixed(2)}°N, {archive.data.metadata.longitude.toFixed(2)}°E · {archive.data.metadata.product}</span></div>
            <div><strong>Résolution / fréquence</strong><span>{archive.data.metadata.spatial_resolution_m} m · composites de {archive.data.metadata.temporal_resolution_days} jours</span></div>
            <div><strong>Couverture reçue</strong><span>{archive.data.metadata.start} — {archive.data.metadata.end} · {archive.data.metadata.record_count} composites</span></div>
            <div><strong>Fenêtre demandée</strong><span>{archive.data.metadata.requested_start} — {archive.data.metadata.requested_end}</span></div>
          </div>

          {/* Les rangs sont calculés depuis le CSV brut et restent des comptes QA, pas des scores de prévision. */}
          <div className="unavailable-grid">
            <article className="unavailable-item"><span className="availability-icon"><CheckCircle2 size={17} aria-hidden="true" /></span><div><strong>QA bonne — rang 0</strong><p>{archive.data.metadata.quality_counts.good} composites</p></div></article>
            <article className="unavailable-item"><span className="availability-icon"><Info size={17} aria-hidden="true" /></span><div><strong>QA marginale — rang 1</strong><p>{archive.data.metadata.quality_counts.marginal} composites</p></div></article>
            <article className="unavailable-item"><span className="availability-icon"><AlertTriangle size={17} aria-hidden="true" /></span><div><strong>QA nuageuse — rang 3</strong><p>{archive.data.metadata.quality_counts.cloudy} composites</p></div></article>
            <article className="unavailable-item"><span className="availability-icon"><MapPin size={17} aria-hidden="true" /></span><div><strong>Masque côtier</strong><p>{archive.data.metadata.land_water_mask_counts['Ocean coastlines and lake shorelines'] ?? 0} composites classés « Ocean coastlines and lake shorelines »</p></div></article>
          </div>

          {/* Le conflit AppEEARS et les limites scientifiques accompagnent les valeurs servies. */}
          <p className="validation-note"><AlertTriangle size={15} aria-hidden="true" />{archive.data.metadata.status_warning}</p>
          <p className="source-note"><Info size={15} aria-hidden="true" />Indices sans unité; valeurs brutes exportées avec QA. Pas d’interpolation quotidienne, de prédiction T2M ni d’interprétation par quartier. Le statut d’éligibilité au modèle est : non.</p>
        </>
      )}
    </section>
  );
}

// Rend les métadonnées des séries mensuelles chargées par le catalogue principal.
function SourceRecord({ kind, metadata, inspection }: { kind: string; metadata: DatasetMetadata; inspection: Inspection }) {
  return (
    <article className="panel source-record-card">
      <div className="source-record-heading">
        <span className="source-tag">NASA</span>
        <div><h2>{metadata.label}</h2><p>{metadata.source}</p></div>
        <span className={`validation-badge ${inspection.valid ? 'validation-badge-ok' : 'validation-badge-warning'}`}>
          {inspection.valid ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />}
          {inspection.valid ? 'Contrôles passés' : 'À vérifier'}
        </span>
      </div>
      <dl className="source-details source-record-details">
        <div><dt>Identifiant API</dt><dd><code>{kind}</code></dd></div>
        <div><dt>Fichier local</dt><dd>{metadata.filename}</dd></div>
        <div><dt>Variable</dt><dd>{metadata.variable}</dd></div>
        <div><dt>Unité</dt><dd>{metadata.unit}</dd></div>
        <div><dt>Agrégation</dt><dd>{metadata.aggregation}</dd></div>
        <div><dt>Résolution</dt><dd>{metadata.spatial_resolution}</dd></div>
        <div><dt>Période source</dt><dd>{formatMonth(metadata.start)} — {formatMonth(metadata.end)}</dd></div>
        <div><dt>Mois présents / attendus</dt><dd>{inspection.observedMonths} / {inspection.expectedMonths}</dd></div>
        <div><dt>Lignes reçues / catalogue</dt><dd>{inspection.rowCount.toLocaleString('fr-FR')} / {metadata.record_count.toLocaleString('fr-FR')}</dd></div>
        <div><dt>Lignes invalides / doublons</dt><dd>{inspection.invalidRows} / {inspection.duplicateMonths}</dd></div>
      </dl>
      <p className="source-note"><Info size={15} aria-hidden="true" />{metadata.provenance_note}</p>
    </article>
  );
}

/** Affiche une limitation documentée sans la remplacer par une valeur estimée. */
function UnavailableItem({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail: string }) {
  return (
    <article className="unavailable-item">
      <span className="availability-icon"><Icon size={17} aria-hidden="true" /></span>
      <div><strong>{title}</strong><p>{detail}</p></div>
    </article>
  );
}
