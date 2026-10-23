import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import { useThreatFeed } from './hooks/useThreatFeed';
import { deriveStatus, formatTime } from './lib/status';
import {
  filterObservations,
  groupObservations,
  locationLabel,
  pickDemoDestination,
  visibleLabelGroups,
} from './lib/grouping';
import {
  BASIS_LABELS,
  CATEGORIES,
  DEMO_DESTINATIONS,
  GLOBE_IMAGES,
  SELECTED_COLOR,
  SIMULATED_COLOR,
  categoryOf,
} from './theme';
import './styles.css';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const num = (n) => (n === null || n === undefined ? '—' : n.toLocaleString());

function Header({ status, feed, count, mapped }) {
  return (
    <header className="header">
      <div className="brand">
        <h1>CyberThreatMap</h1>
        <p>SANS ISC source activity · aggregated reports · refreshed every {Math.round((feed?.intervalMs || 60000) / 1000)}s</p>
      </div>
      <div className="status" role="status" aria-live="polite">
        <span className={`dot dot-${status.tone}`} aria-hidden="true" />
        <span>{status.label}</span>
        <span className="muted">
          {feed ? ` · ${count} sources (${mapped} mapped) · updated ${formatTime(feed.lastSuccessAt)}` : ''}
        </span>
      </div>
    </header>
  );
}

function Legend({ simulated }) {
  return (
    <div className="legend" aria-label="Legend">
      {Object.entries(CATEGORIES).map(([key, c]) => (
        <div key={key} className="legend-row" title={c.description}>
          <span className="swatch" style={{ background: c.color }} /> {c.label}
        </div>
      ))}
      <div className="legend-row"><span className="swatch ring" style={{ borderColor: CATEGORIES.unknown.color }} /> Pulse = activity at location</div>
      <div className="legend-row"><span className="swatch" style={{ background: SELECTED_COLOR }} /> Selected</div>
      {simulated && (
        <div className="legend-row sim"><span className="line" style={{ background: SIMULATED_COLOR }} /> Simulated route (not real)</div>
      )}
      <div className="legend-note">Marker size ∝ total reports. Locations are approximate GeoIP.</div>
    </div>
  );
}

function DetailCard({ selection, observations, groups, onClose, onSelectObs }) {
  if (!selection) return null;

  if (selection.type === 'group') {
    const group = groups.find((g) => g.key === selection.key);
    if (!group) return null;
    return (
      <aside className="detail" aria-label="Location details">
        <button className="close" onClick={onClose} aria-label="Close details">×</button>
        <h2>{group.label}</h2>
        <p className="muted">{group.observations.length} reported source(s) · {num(group.totalReports)} reports · {group.precision}-level GeoIP</p>
        <ul className="ip-list">
          {group.observations.map((o) => (
            <li key={o.id}><button className="link" onClick={() => onSelectObs(o)}>{o.observedEntity.ip}</button> <span className="muted">{num(o.metrics.reportCount)} reports</span></li>
          ))}
        </ul>
      </aside>
    );
  }

  const obs = observations.find((o) => o.id === selection.id);
  if (!obs) return null;
  const cat = categoryOf(obs);
  return (
    <aside className="detail" aria-label="Observation details">
      <button className="close" onClick={onClose} aria-label="Close details">×</button>
      <h2>{obs.observedEntity.ip}</h2>
      <p className="muted">{locationLabel(obs.geo)}{obs.geo.precision !== 'unknown' ? ` · ${obs.geo.precision}-level GeoIP (approximate)` : ''}</p>
      <dl>
        <dt>Reports</dt><dd>{num(obs.metrics.reportCount)}</dd>
        <dt>Targets</dt><dd>{num(obs.metrics.targetCount)}</dd>
        <dt>First seen</dt><dd>{obs.time.firstSeen || '—'}</dd>
        <dt>Last seen</dt><dd>{obs.time.lastSeen || '—'}</dd>
        <dt>Category</dt><dd><span className="swatch" style={{ background: cat.color }} /> {obs.classification.label}</dd>
        <dt>Basis</dt><dd>{BASIS_LABELS[obs.classification.basis]}</dd>
        <dt>Provider</dt><dd>SANS ISC / DShield</dd>
        <dt>Fetched</dt><dd>{formatTime(obs.time.fetchedAt)}</dd>
      </dl>
      <p className="note">{obs.classification.evidence}</p>
    </aside>
  );
}

function Explorer({ observations, selectedId, onSelect, open }) {
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('');
  const countries = useMemo(
    () => [...new Set(observations.map((o) => o.geo.countryCode).filter(Boolean))].sort(),
    [observations]
  );
  const rows = useMemo(() => filterObservations(observations, { query, country }), [observations, query, country]);

  return (
    <aside className={`explorer ${open ? 'open' : ''}`} aria-label="Current source observations">
      <h2>Current source observations</h2>
      <p className="muted">Aggregated SANS ISC records, in provider order — not a live event stream.</p>
      <div className="filters">
        <input type="search" placeholder="Search IP" aria-label="Search IP" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select aria-label="Filter by country" value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">All countries</option>
          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <ul className="rows">
        {rows.length === 0 && <li className="empty">{observations.length === 0 ? 'No observations in the latest snapshot.' : 'No matches.'}</li>}
        {rows.map((o) => (
          <li key={o.id}>
            <button className={`row ${o.id === selectedId ? 'selected' : ''}`} onClick={() => onSelect(o)}>
              <span className="swatch" style={{ background: categoryOf(o).color }} />
              <span className="row-main">
                <span className="ip">{o.observedEntity.ip}</span>
                <span className="muted">{locationLabel(o.geo)}</span>
              </span>
              <span className="row-metric">{num(o.metrics.reportCount)}<small>reports</small></span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function App() {
  const globeEl = useRef();
  const { socketState, snapshot } = useThreatFeed();
  const [selection, setSelection] = useState(null);
  const [simulated, setSimulated] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [altitude, setAltitude] = useState(2.5);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const reduced = useMemo(prefersReducedMotion, []);

  const observations = useMemo(() => snapshot?.observations || [], [snapshot]);
  const feed = snapshot?.feed;
  const status = deriveStatus(socketState, snapshot);
  const groups = useMemo(() => groupObservations(observations), [observations]);

  const selectedGroupKey = useMemo(() => {
    if (!selection) return null;
    if (selection.type === 'group') return selection.key;
    return groups.find((g) => g.observations.some((o) => o.id === selection.id))?.key || null;
  }, [selection, groups]);

  const labelGroups = useMemo(() => visibleLabelGroups(groups, altitude, selectedGroupKey), [groups, altitude, selectedGroupKey]);
  const ringGroups = useMemo(() => {
    const top = groups.slice(0, 12);
    const sel = groups.find((g) => g.key === selectedGroupKey);
    return sel && !top.includes(sel) ? [...top, sel] : top;
  }, [groups, selectedGroupKey]);

  const simArcs = useMemo(
    () => (simulated
      ? groups.slice(0, 15).map((g) => ({ g, dst: pickDemoDestination(g.key, DEMO_DESTINATIONS) }))
      : []),
    [simulated, groups]
  );

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onGlobeReady = useCallback(() => {
    const g = globeEl.current;
    if (!g) return;
    const controls = g.controls();
    controls.autoRotate = !reduced;
    controls.autoRotateSpeed = 0.4;
    g.pointOfView({ lat: 20, lng: 10, altitude: 2.5 });
  }, [reduced]);

  const focus = useCallback((lat, lng, alt = 1.4) => {
    const g = globeEl.current;
    if (!g) return;
    g.controls().autoRotate = false;
    g.pointOfView({ lat, lng, altitude: alt }, reduced ? 0 : 800);
  }, [reduced]);

  const selectObs = useCallback((o) => {
    setSelection({ type: 'obs', id: o.id });
    setExplorerOpen(false);
    if (o.geo.latitude !== null) focus(o.geo.latitude, o.geo.longitude);
  }, [focus]);

  const selectGroup = useCallback((g) => {
    setSelection({ type: 'group', key: g.key });
    focus(g.lat, g.lng, 1.2);
  }, [focus]);

  const resetView = () => {
    setSelection(null);
    const g = globeEl.current;
    if (!g) return;
    g.controls().autoRotate = !reduced;
    g.pointOfView({ lat: 20, lng: 10, altitude: 2.5 }, reduced ? 0 : 800);
  };

  return (
    <div className="app">
      <div className="globe-wrap">
        <Globe
          ref={globeEl}
          width={size.w}
          height={size.h}
          onGlobeReady={onGlobeReady}
          onZoom={(pov) => setAltitude(pov.altitude)}
          globeImageUrl={GLOBE_IMAGES.earth}
          backgroundImageUrl={GLOBE_IMAGES.sky}
          atmosphereColor="#4fc3f7"
          atmosphereAltitude={0.18}

          pointsData={groups}
          pointLat="lat"
          pointLng="lng"
          pointAltitude={0.012}
          pointRadius={(g) => 0.2 + Math.min(0.6, Math.log10(g.totalReports + 10) / 10)}
          pointColor={(g) => (g.key === selectedGroupKey ? SELECTED_COLOR : CATEGORIES.unknown.color)}
          pointLabel={(g) => `${g.label} · ${g.observations.length} source(s)`}
          onPointClick={selectGroup}

          ringsData={reduced ? [] : ringGroups}
          ringLat="lat"
          ringLng="lng"
          ringColor={() => (t) => `rgba(79,195,247,${1 - t})`}
          ringMaxRadius={4}
          ringPropagationSpeed={2}
          ringRepeatPeriod={1400}

          labelsData={labelGroups}
          labelLat="lat"
          labelLng="lng"
          labelText="label"
          labelSize={0.55}
          labelDotRadius={0}
          labelAltitude={0.02}
          labelColor={(g) => (g.key === selectedGroupKey ? SELECTED_COLOR : 'rgba(225,240,255,0.9)')}
          labelResolution={2}
          onLabelClick={selectGroup}

          arcsData={simArcs}
          arcStartLat={(a) => a.g.lat}
          arcStartLng={(a) => a.g.lng}
          arcEndLat={(a) => a.dst.lat}
          arcEndLng={(a) => a.dst.lng}
          arcColor={() => [SIMULATED_COLOR, 'rgba(255,138,101,0.1)']}
          arcDashLength={0.4}
          arcDashGap={1}
          arcDashAnimateTime={reduced ? 0 : 2500}
          arcStroke={0.35}
          arcLabel={() => 'SIMULATED ROUTE · illustrative only'}
        />
      </div>

      <Header status={status} feed={feed} count={feed?.observationCount ?? 0} mapped={feed?.mappedCount ?? 0} />

      {simulated && <div className="sim-banner" role="alert">SIMULATED ROUTES · illustrative only · not source-to-target attack data</div>}
      {feed?.status === 'error' && (
        <div className="error-banner" role="alert">SANS ISC fetch failed ({feed.error?.code}). Retrying with backoff{feed.lastSuccessAt ? '; showing last good data.' : '.'}</div>
      )}
      {feed &&observations.length > feed.mappedCount && (
        <div className="info-banner">{observations.length - feed.mappedCount} source(s) have no GeoIP location and appear in the list only.</div>
      )}

      <div className="controls">
        <button onClick={resetView}>Reset view</button>
        <label className="toggle">
          <input type="checkbox" checked={simulated} onChange={(e) => setSimulated(e.target.checked)} />
          Simulated routes
        </label>
        <button className="mobile-only" onClick={() => setExplorerOpen((o) => !o)} aria-expanded={explorerOpen}>Sources</button>
      </div>

      <Legend simulated={simulated} />
      <Explorer observations={observations} selectedId={selection?.type === 'obs' ? selection.id : null} onSelect={selectObs} open={explorerOpen} />
      <DetailCard selection={selection} observations={observations} groups={groups} onClose={() => setSelection(null)} onSelectObs={selectObs} />

      <footer className="credit">Data: <a href="https://isc.sans.edu" target="_blank" rel="noreferrer">SANS Internet Storm Center</a> (DShield) · GeoIP: MaxMind GeoLite via geoip-lite</footer>
    </div>
  );
}

export default App;
