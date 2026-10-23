// Group observations that share the same GeoIP coordinates. GeoIP resolves many
// IPs to one coarse point, so we aggregate the marker rather than jitter it.
const coordKey = (geo) => `${geo.latitude.toFixed(2)},${geo.longitude.toFixed(2)}`;

export function locationLabel(geo) {
  if (geo.latitude === null) return 'Location unavailable';
  const cc = geo.countryCode || '';
  if (geo.city) return cc ? `${geo.city}, ${cc}` : geo.city;
  if (geo.region) return cc ? `${geo.region}, ${cc}` : geo.region;
  return geo.countryName || cc || 'Unknown location';
}

export function groupObservations(observations) {
  const map = new Map();
  for (const obs of observations) {
    if (obs.geo.latitude === null || obs.geo.longitude === null) continue;
    const key = coordKey(obs.geo);
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        lat: obs.geo.latitude,
        lng: obs.geo.longitude,
        label: locationLabel(obs.geo),
        precision: obs.geo.precision,
        observations: [],
        totalReports: 0,
      };
      map.set(key, group);
    }
    group.observations.push(obs);
    group.totalReports += obs.metrics.reportCount || 0;
  }
  return [...map.values()].sort((a, b) => b.totalReports - a.totalReports);
}

// Camera altitude (globe radii): ~2.5 = whole globe, <1 = zoomed in.
// Show fewer labels when zoomed out so they never pile up.
export function labelBudget(altitude) {
  if (altitude > 2) return 6;
  if (altitude > 1.2) return 14;
  if (altitude > 0.6) return 30;
  return 60;
}

export function visibleLabelGroups(groups, altitude, selectedKey) {
  const top = groups.slice(0, labelBudget(altitude));
  if (selectedKey && !top.some((g) => g.key === selectedKey)) {
    const selected = groups.find((g) => g.key === selectedKey);
    if (selected) top.push(selected);
  }
  return top;
}

export function filterObservations(observations, { query = '', country = '' } = {}) {
  const q = query.trim().toLowerCase();
  return observations.filter((o) => {
    if (country && o.geo.countryCode !== country) return false;
    if (q && !o.observedEntity.ip.toLowerCase().includes(q)) return false;
    return true;
  });
}

// Deterministic (not random) pick so simulated routes stay stable between refreshes.
export function pickDemoDestination(key, destinations) {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return destinations[h % destinations.length];
}
