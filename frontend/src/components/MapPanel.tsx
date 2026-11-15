/** Carte Plotly animée au point de référence; elle ne crée aucune donnée spatiale. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Info, MapPinned, RefreshCw } from 'lucide-react';
import type { DatasetMetadata, Observation } from '../lib/api';
import { createPlotlyMapFigure } from '../lib/interactive-map';
import { useTranslation } from '../lib/i18n';

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
  const { t } = useTranslation();
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
    unavailableMessage = t('Coordonnée de référence absente ou invalide; aucun point n’est inventé.', 'Reference coordinate missing or invalid; no point is invented.');
  } else if (visibleRows.length === 0) {
    unavailableMessage = t('Aucune observation mensuelle valide dans cette sélection.', 'No valid monthly observation in this selection.');
  } else if (visibleSectors.length > 1) {
    unavailableMessage = t('Plusieurs secteurs sont sélectionnés, mais le catalogue ne fournit qu’un point de référence. Choisissez un seul secteur pour éviter de superposer des données sans coordonnées propres.', 'Several areas are selected, but the catalog provides only one reference point. Choose a single area to avoid overlapping data without its own coordinates.');
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
          <div className="section-title"><MapPinned size={19} aria-hidden="true" /><h2>{t('Carte interactive · Plotly', 'Interactive map · Plotly')}</h2></div>
          <p>{mapSector || 'Douala'} · {t('fond OpenStreetMap · série mensuelle filtrée', 'OpenStreetMap basemap · filtered monthly series')}</p>
        </div>
        <div className="map-current-value">
          <Info size={15} aria-hidden="true" />
          <span>{isAirTemperature ? t('T2M de l’air à 2 m · palette jaune–rouge', '2 m air T2M · yellow-to-red palette') : t('Survolez le point · glissez pour zoomer', 'Hover the point · drag to zoom')}</span>
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
              aria-label={t(`Carte Plotly interactive des valeurs mensuelles de ${metadata.label} au point de référence ${mapSector}`, `Interactive Plotly map of monthly ${metadata.label} values at reference point ${mapSector}`)}
            />
            <div className="map-overlay map-overlay-top">
              <strong>{mapSector || 'Douala'} · {t('point de référence', 'reference point')}</strong>
              <span>{formatCoordinate(metadata.latitude, 'N', 'S')} · {formatCoordinate(metadata.longitude, 'E', t('O', 'W'))}</span>
            </div>
            {plotStatus === 'loading' && (
              <div className="map-loading" role="status">{t('Chargement de la carte interactive…', 'Loading the interactive map…')}</div>
            )}
            {plotStatus === 'error' && (
              <div className="map-error" role="alert">
                <span>{t('Plotly n’a pas pu charger la carte. Vérifiez la connexion au fond OpenStreetMap.', 'Plotly could not load the map. Check the connection to the OpenStreetMap basemap.')}</span>
                <button type="button" onClick={() => setReloadKey((key) => key + 1)} aria-label={t('Réessayer de charger la carte', 'Retry loading the map')}>
                  <RefreshCw size={14} aria-hidden="true" /> {t('Réessayer', 'Retry')}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="map-caption">
        {isAirTemperature
          ? t('Le marqueur fixe montre le T2M mensuel (température de l’air à 2 m, pas la température de surface); la palette jaune–orange–rouge code sa valeur au seul point de référence.', 'The fixed marker shows monthly T2M (2 m air temperature, not land-surface temperature); the yellow–orange–red palette encodes its value at the single reference point.')
          : t('Le marqueur fixe montre la valeur mensuelle de l’indicateur sélectionné au seul point de référence.', 'The fixed marker shows the monthly value of the selected indicator at the single reference point.').concat(' ')}
        {t('La glissière et lecture/pause parcourent les mois visibles; l’échelle colorée correspond à cette sélection et ne constitue pas une alerte. Le fond de carte est © OpenStreetMap contributors. Aucune grille thermique ni limite de quartier n’est disponible : il n’y a ni interpolation spatiale ni valeur attribuée aux zones voisines.', 'The slider and play/pause buttons step through the visible months; the colour scale matches this selection and is not an alert. The basemap is © OpenStreetMap contributors. No thermal grid or neighbourhood boundary is available: there is no spatial interpolation and no value assigned to neighbouring areas.')}
      </div>
    </section>
  );
}
