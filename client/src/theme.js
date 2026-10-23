// Single source of truth for category styling. Map markers, legend, list rows
// and the detail card all read from here. Only categories the data can
// genuinely support are listed; add more only when a provider supplies evidence.
export const CATEGORIES = {
  unknown: {
    label: 'Reported source activity',
    color: '#4fc3f7',
    description: 'IP reported to SANS ISC. The feed does not state an attack type.',
  },
};

export const SELECTED_COLOR = '#ffd54f';
export const SIMULATED_COLOR = '#ff8a65';

export const categoryOf = (obs) => CATEGORIES[obs.classification?.category] || CATEGORIES.unknown;

export const BASIS_LABELS = {
  source_reported: 'Reported by source',
  threat_intel_match: 'Threat-intel match',
  heuristic: 'Heuristic',
  unknown: 'No supporting evidence',
};

export const GLOBE_IMAGES = {
  earth: '//unpkg.com/three-globe/example/img/earth-night.jpg',
  sky: '//unpkg.com/three-globe/example/img/night-sky.png',
};

// Illustrative destinations, used ONLY in the explicitly-labelled simulated mode.
// They are not honeypots, victims, or real targets.
export const DEMO_DESTINATIONS = [
  { name: 'Seattle', lat: 47.6062, lng: -122.3321 },
  { name: 'Berlin', lat: 52.52, lng: 13.405 },
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
  { name: 'São Paulo', lat: -23.5505, lng: -46.6333 },
  { name: 'Sydney', lat: -33.8688, lng: 151.2093 },
  { name: 'Mumbai', lat: 19.076, lng: 72.8777 },
];
