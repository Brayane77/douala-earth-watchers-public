/** Construit une carte Plotly temporelle sans interpoler les observations dans l’espace. */
import type { Data, Frame, Layout } from 'plotly.js-dist-min';
import type { Observation } from './api';

/** Métadonnées minimales nécessaires au repère cartographique et à son échelle. */
export interface MapSeriesMetadata {
  latitude: number;
  longitude: number;
  variable: string;
  unit: string;
  label: string;
  precision: number;
}

/** Traces, disposition et frames passés au rendu Plotly. */
export interface PlotlyMapFigure {
  data: Data[];
  layout: Partial<Layout>;
  frames: Frame[];
}

/** Formate une date mensuelle en libellé français stable quel que soit le fuseau local. */
function monthLabel(date: string): string {
  const month = date.slice(0, 7);
  return new Intl.DateTimeFormat('fr-FR', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T12:00:00Z`));
}

/** Crée une carte animée sur le seul point de référence déclaré par le catalogue. */
export function createPlotlyMapFigure(
  metadata: MapSeriesMetadata,
  observations: Observation[],
): PlotlyMapFigure {
  const rows = observations
    .filter((row) => Number.isFinite(row.value) && /^\d{4}-\d{2}-\d{2}$/.test(row.date))
    .sort((left, right) => left.date.localeCompare(right.date));
  if (rows.length === 0) throw new Error('La carte requiert au moins une observation mensuelle valide.');

  const values = rows.map((row) => row.value);
  const valueMinimum = Math.min(...values);
  const valueMaximum = Math.max(...values);
  const padding = valueMinimum === valueMaximum ? Math.max(Math.abs(valueMinimum) * 0.01, 0.5) : 0;
  const colorMinimum = valueMinimum - padding;
  const colorMaximum = valueMaximum + padding;
  const isAirTemperature = metadata.variable === 'T2M' && metadata.unit.includes('°C');
  const colorscale = isAirTemperature ? 'YlOrRd' : 'Blues';
  const valueFormat = `.${Math.max(0, Math.min(6, metadata.precision))}f`;

  /** Encode une seule valeur au point catalogue; aucune couleur n’est propagée aux pixels voisins. */
  function markerFor(row: Observation) {
    return {
      type: 'scattermap' as const,
      mode: 'markers' as const,
      lat: [metadata.latitude],
      lon: [metadata.longitude],
      customdata: [[row.date, row.value, row.sector]],
      marker: {
        size: 24,
        color: [row.value],
        colorscale,
        cmin: colorMinimum,
        cmax: colorMaximum,
        showscale: true,
        line: { color: '#ffffff', width: 2 },
        colorbar: {
          title: { text: metadata.unit, side: 'right' as const },
          thickness: 11,
          len: 0.54,
          tickfont: { size: 9 },
        },
      },
      hovertemplate: `<b>%{customdata[2]}</b><br>%{customdata[0]}<br>%{customdata[1]:${valueFormat}} ${metadata.unit}<extra></extra>`,
    };
  }

  const frames: Frame[] = rows.map((row) => ({
    name: row.date.slice(0, 7),
    data: [markerFor(row)],
    traces: [0],
  }));
  const hasAnimation = rows.length > 1;
  const sliderSteps = frames.map((frame, index) => {
    const date = String(frame.name);
    const label = rows.length <= 18
      ? monthLabel(date)
      : date.slice(5, 7) === '01' ? date.slice(0, 4) : '';
    return {
      label,
      method: 'animate' as const,
      args: [[frame.name], {
        mode: 'immediate' as const,
        transition: { duration: 0 },
        frame: { duration: 0, redraw: true },
      }],
      value: String(index),
    };
  });

  const layout: Partial<Layout> = {
    autosize: true,
    showlegend: false,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: 'Inter, system-ui, sans-serif', color: '#526b79', size: 10 },
    margin: { l: 8, r: 44, t: 12, b: hasAnimation ? 72 : 12 },
    map: {
      style: 'open-street-map',
      center: { lat: metadata.latitude, lon: metadata.longitude },
      zoom: 10,
      bearing: 0,
      pitch: 0,
      uirevision: `${metadata.latitude},${metadata.longitude}`,
    },
    ...(hasAnimation ? {
      sliders: [{
        active: 0,
        x: 0.19,
        len: 0.77,
        y: 0.015,
        pad: { t: 24, b: 3 },
        currentvalue: { prefix: 'Mois sélectionné : ', font: { size: 10 } },
        steps: sliderSteps,
      }],
      updatemenus: [{
        type: 'buttons' as const,
        direction: 'left' as const,
        showactive: false,
        x: 0.02,
        y: 0.02,
        xanchor: 'left' as const,
        yanchor: 'bottom' as const,
        buttons: [
          {
            label: 'Lecture',
            method: 'animate' as const,
            args: [null, {
              fromcurrent: true,
              mode: 'immediate' as const,
              frame: { duration: 650, redraw: true },
              transition: { duration: 250 },
            }],
          },
          {
            label: 'Pause',
            method: 'animate' as const,
            args: [[null], {
              mode: 'immediate' as const,
              frame: { duration: 0, redraw: false },
              transition: { duration: 0 },
            }],
          },
        ],
      }],
    } : {}),
  };

  return {
    data: [markerFor(rows[0])],
    layout,
    frames: hasAnimation ? frames : [],
  };
}
