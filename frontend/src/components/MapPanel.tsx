/** Carte Plotly animée au point de référence; elle ne crée aucune donnée spatiale. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Info, MapPinned, RefreshCw } from 'lucide-react';
import type { DatasetMetadata, Observation } from '../lib/api';
import { createPlotlyMapFigure } from '../lib/interactive-map';

/** Propriétés de carte partagées par le produit et les lignes visibles du tableau de bord. */
interface MapPanelProps {
  metadata: DatasetMetadata;
  sector: string;
  observations: Observation[];
}

/** État réseau de Plotly utilisé pour montrer chargement, succès ou erreur. */
type PlotStatus = 'loading' | 'ready' | 'error';

/** Affiche latitude et longitude avec l’hémisphère correspondant. */
function formatCoordinate(value: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(3)}° ${value >= 0 ? positive : negative}`;
}

/** Construit une carte temporelle Plotly à partir des seules lignes sélectionnées. */
export function MapPanel({ metadata, sector, observations }: MapPanelProps) {
  const panelElement = useRef<HTMLElement>(null);
  const plotElement = useRef<HTMLDivElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [plotStatus, setPlotStatus] = useState<PlotStatus>('loading');
  const [reloadKey, setReloadKey] = useState(0);

  // Ne transmet à Plotly que les observations réelles, finies et ordonnées par date.
  const visibleRows = useMemo(() => observations
    .filter((row) => Number.isFinite(row.value) && /^\d{4}-\d{2}-\d{2}$/.test(row.date))
    .sort((left, right) => left.date.localeCompare(right.date)), [observations]);
  // Refuse de superposer plusieurs secteurs sur le même emplacement unique.
  const visibleSectors = useMemo(() => [...new Set(visibleRows.map((row) => row.sector))], [visibleRows]);
  // Les coordonnées doivent provenir du catalogue et respecter les plages géographiques.
  const hasReferenceCoordinates = Number.isFinite(metadata.latitude)
    && Number.isFinite(metadata.longitude)
    && Math.abs(metadata.latitude) <= 90
    && Math.abs(metadata.longitude) <= 180;
  const isAirTemperature = metadata.variable === 'T2M' && metadata.unit.includes('°C');
  const mapSector = visibleSectors.length === 1 ? visibleSectors[0] : sector;

  let unavailableMessage = '';
  if (!hasReferenceCoordinates) {
    unavailableMessage = 'Coordonnée de référence absente ou invalide; aucun point n’est inventé.';
  } else if (visibleRows.length === 0) {
    unavailableMessage = 'Aucune observation mensuelle valide dans cette sélection.';
  } else if (visibleSectors.length > 1) {
    unavailableMessage = 'Plusieurs secteurs sont sélectionnés, mais le catalogue ne fournit qu’un point de référence. Choisissez un seul secteur pour éviter de superposer des données sans coordonnées propres.';
  }

  // Diffère l’import et le rendu de la carte jusqu’à l’approche du panneau dans la fenêtre.
  useEffect(() => {
    const panel = panelElement.current;
    if (!panel || !('IntersectionObserver' in window)) {
      setIsNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setIsNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: '180px' });
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = plotElement.current;
    if (!element || unavailableMessage || !isNearViewport) return;
    const mapElement = element as HTMLDivElement;

    let cancelled = false;
    let plotly: typeof import('plotly.js-dist-min').default | null = null;
    setPlotStatus('loading');

    // Charge le bundle Plotly à la demande et annule les mutations si le composant est démonté.
    async function renderMap() {
      try {
        const plotlyModule = await import('plotly.js-dist-min');
        plotly = plotlyModule.default;
        if (cancelled) return;

        const figure = createPlotlyMapFigure(metadata, visibleRows);
        await plotly.newPlot(mapElement, figure.data, figure.layout, {
          responsive: true,
          scrollZoom: true,
          displayModeBar: true,
          displaylogo: false,
          modeBarButtonsToRemove: ['select2d', 'lasso2d'],
        });
        if (cancelled) {
          plotly.purge(mapElement);
          return;
        }
        if (figure.frames.length > 0) await plotly.addFrames(mapElement, figure.frames);
        if (!cancelled) setPlotStatus('ready');
      } catch {
        if (!cancelled) setPlotStatus('error');
      }
    }

    void renderMap();
    return () => {
      cancelled = true;
      if (plotly) plotly.purge(mapElement);
    };
  }, [isNearViewport, metadata, unavailableMessage, visibleRows, reloadKey]);

  return (
    <section ref={panelElement} className="panel" id="map">
      <div className="panel-heading map-heading">
        <div>
          <div className="section-title"><MapPinned size={19} aria-hidden="true" /><h2>Carte interactive · Plotly</h2></div>
          <p>{mapSector || 'Douala'} · fond OpenStreetMap · série mensuelle filtrée</p>
        </div>
        <div className="map-current-value">
          <Info size={15} aria-hidden="true" />
          <span>{isAirTemperature ? 'T2M de l’air à 2 m · palette jaune–rouge' : 'Survolez le point · glissez pour zoomer'}</span>
        </div>
      </div>

      <div className="map-stage">
        {unavailableMessage ? (
          <div className="map-unavailable" role="status">{unavailableMessage}</div>
        ) : (
          <>
            <div
              ref={plotElement}
              className="plotly-map"
              role="region"
              aria-label={`Carte Plotly interactive des valeurs mensuelles de ${metadata.label} au point de référence ${mapSector}`}
            />
            <div className="map-overlay map-overlay-top">
              <strong>{mapSector || 'Douala'} · point de référence</strong>
              <span>{formatCoordinate(metadata.latitude, 'N', 'S')} · {formatCoordinate(metadata.longitude, 'E', 'O')}</span>
            </div>
            {plotStatus === 'loading' && (
              <div className="map-loading" role="status">Chargement de la carte interactive…</div>
            )}
            {plotStatus === 'error' && (
              <div className="map-error" role="alert">
                <span>Plotly n’a pas pu charger la carte. Vérifiez la connexion au fond OpenStreetMap.</span>
                <button type="button" onClick={() => setReloadKey((key) => key + 1)} aria-label="Réessayer de charger la carte">
                  <RefreshCw size={14} aria-hidden="true" /> Réessayer
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="map-caption">
        {isAirTemperature
          ? 'Le marqueur fixe montre le T2M mensuel (température de l’air à 2 m, pas la température de surface); la palette jaune–orange–rouge code sa valeur au seul point de référence.'
          : 'Le marqueur fixe montre la valeur mensuelle de l’indicateur sélectionné au seul point de référence.'}{' '}
        La glissière et lecture/pause parcourent les mois visibles; l’échelle colorée correspond à cette sélection et ne constitue pas une alerte. Le fond de carte est © OpenStreetMap contributors. Aucune grille thermique ni limite de quartier n’est disponible : il n’y a ni interpolation spatiale ni valeur attribuée aux zones voisines.
      </div>
    </section>
  );
}
