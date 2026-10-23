import { groupObservations, visibleLabelGroups, filterObservations, locationLabel, pickDemoDestination } from './grouping';
import { deriveStatus } from './status';

const obs = (ip, lat, lng, extra = {}) => ({
  id: `sans-isc:${ip}`,
  observedEntity: { ip },
  geo: {
    latitude: lat,
    longitude: lng,
    city: lat === null ? null : 'Berlin',
    region: null,
    countryCode: 'DE',
    countryName: 'Germany',
    precision: lat === null ? 'unknown' : 'city',
  },
  metrics: { reportCount: 10, targetCount: 1 },
  ...extra,
});

test('observations sharing GeoIP coordinates are aggregated into one group', () => {
  const groups = groupObservations([obs('1.1.1.1', 52.5, 13.4), obs('1.1.1.2', 52.5, 13.4), obs('2.2.2.2', 35, 139)]);
  expect(groups).toHaveLength(2);
  expect(groups[0].observations).toHaveLength(2);
  expect(groups[0].totalReports).toBe(20);
});

test('records without coordinates are not mapped and get no fabricated position', () => {
  const groups = groupObservations([obs('3.3.3.3', null, null)]);
  expect(groups).toHaveLength(0);
  expect(locationLabel(obs('3.3.3.3', null, null).geo)).toBe('Location unavailable');
});

test('label budget shrinks when zoomed out but keeps the selected group', () => {
  const many = groupObservations(Array.from({ length: 40 }, (_, i) => obs(`9.9.9.${i}`, i, i)));
  expect(visibleLabelGroups(many, 2.5, null)).toHaveLength(6);
  expect(visibleLabelGroups(many, 2.5, many[39].key)).toHaveLength(7);
  expect(visibleLabelGroups(many, 0.4, null).length).toBe(40);
});

test('search and country filters work on IP and country code', () => {
  const list = [obs('1.1.1.1', 1, 1), obs('8.8.8.8', 2, 2)];
  expect(filterObservations(list, { query: '8.8' })).toHaveLength(1);
  expect(filterObservations(list, { country: 'FR' })).toHaveLength(0);
});

test('demo destinations are deterministic', () => {
  const dests = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
  expect(pickDemoDestination('52.50,13.40', dests)).toBe(pickDemoDestination('52.50,13.40', dests));
});

test('status distinguishes loading, healthy, empty, stale, provider error and disconnect', () => {
  const feed = (o) => ({ feed: { status: 'ok', stale: false, observationCount: 5, lastSuccessAt: 'x', ...o } });
  expect(deriveStatus('connecting', null).tone).toBe('loading');
  expect(deriveStatus('connected', null).label).toMatch(/first snapshot/);
  expect(deriveStatus('connected', feed()).tone).toBe('ok');
  expect(deriveStatus('connected', feed({ observationCount: 0 })).label).toMatch(/no observations/);
  expect(deriveStatus('connected', feed({ stale: true })).label).toMatch(/stale/);
  expect(deriveStatus('connected', feed({ status: 'error' })).tone).toBe('warn');
  expect(deriveStatus('connected', feed({ status: 'error', lastSuccessAt: null })).tone).toBe('error');
  expect(deriveStatus('disconnected', feed()).label).toMatch(/disconnected/);
});
