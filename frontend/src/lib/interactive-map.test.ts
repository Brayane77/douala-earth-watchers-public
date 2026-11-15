/** Tests de la carte Plotly : coordonnées source fixes, couleurs temporelles, aucune interpolation spatiale. */
import { describe, expect, it } from 'vitest';
import type { Observation } from './api';
import { createPlotlyMapFigure } from './interactive-map';

const temperatureMetadata = {
  latitude: 4.05,
  longitude: 9.75,
  variable: 'T2M',
  unit: '°C',
  label: 'Température de l’air à 2 m',
  precision: 1,
};

const observations: Observation[] = [
  { date: '2020-02-01', sector: 'Douala', value: 28 },
  { date: '2020-01-01', sector: 'Douala', value: 26 },
  { date: '2020-03-01', sector: 'Douala', value: 30 },
];

describe('carte temporelle Plotly', () => {
  it('anime les valeurs mensuelles au même point de référence, sans créer de zones', () => {
    const figure = createPlotlyMapFigure(temperatureMetadata, observations);

    expect(figure.data).toHaveLength(1);
    expect(figure.data[0].type).toBe('scattermap');
    expect(figure.frames.map((frame) => frame.name)).toEqual(['2020-01', '2020-02', '2020-03']);
    expect(figure.frames).toHaveLength(3);

    for (const frame of figure.frames) {
      const trace = frame.data?.[0];
      expect(trace?.type).toBe('scattermap');
      if (trace?.type !== 'scattermap') throw new Error('La trame doit rester un point Plotly.');
      expect(trace.lat).toEqual([temperatureMetadata.latitude]);
      expect(trace.lon).toEqual([temperatureMetadata.longitude]);
      expect(trace.marker?.color).toHaveLength(1);
      expect(trace.marker?.colorscale).toBe('YlOrRd');
    }

    expect(figure.layout.sliders?.[0].steps).toHaveLength(3);
    expect(figure.layout.map?.style).toBe('open-street-map');
  });

  it('utilise une palette non thermique pour les indicateurs qui ne sont pas T2M', () => {
    const figure = createPlotlyMapFigure({
      ...temperatureMetadata,
      variable: 'PRECTOT',
      unit: 'mm/mois',
    }, observations);
    const firstFrame = figure.frames[0].data?.[0];

    expect(firstFrame?.type).toBe('scattermap');
    if (firstFrame?.type !== 'scattermap') throw new Error('La trame doit rester un point Plotly.');
    expect(firstFrame.marker?.colorscale).toBe('Blues');
  });

  it('n’invente pas de valeur cartographique si la sélection est vide', () => {
    expect(() => createPlotlyMapFigure(temperatureMetadata, [])).toThrow(
      'La carte requiert au moins une observation mensuelle valide.',
    );
  });
});
