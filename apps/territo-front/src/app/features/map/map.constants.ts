export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export const SCORE_TYPES = [
  { value: 'prospection_locale', label: 'Prospection locale' },
  { value: 'demande_btp', label: 'Demande BTP' },
  { value: 'transformation_immo', label: 'Transformation immo' },
  { value: 'liquidite_marche', label: 'Liquidité marché' },
  { value: 'valorisation_prix', label: 'Valorisation prix' },
] as const;

export const PERIODS = [
  { value: '3m', label: '3 mois' },
  { value: '6m', label: '6 mois' },
  { value: '12m', label: '12 mois' },
  { value: '24m', label: '24 mois' },
  { value: '36m', label: '36 mois' },
  { value: '48m', label: '48 mois' },
] as const;

export const LEGEND = [
  { color: '#22c55e', label: '88 – 100' },
  { color: '#84cc16', label: '72 – 87' },
  { color: '#eab308', label: '55 – 71' },
  { color: '#f97316', label: '30 – 54' },
  { color: '#ef4444', label: '0 – 29' },
  { color: '#94a3b8', label: 'Données insuffisantes' },
] as const;

export const FILL_PAINT = {
  'fill-color': [
    'case',
    ['any',
      ['==', ['get', 'score_visibility'], 'greyed'],
      ['==', ['get', 'score_visibility'], 'hidden'],
    ], '#94a3b8',
    ['interpolate', ['linear'], ['get', 'global_score'],
      0, '#ef4444', 30, '#f97316', 55, '#eab308', 72, '#84cc16', 88, '#22c55e',
    ],
  ],
  'fill-opacity': 0.55,
};

export const OUTLINE_PAINT = {
  'line-color': '#ffffff',
  'line-width': 1,
  'line-opacity': 0.8,
};
