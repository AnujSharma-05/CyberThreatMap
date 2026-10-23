const test = require('node:test');
const assert = require('node:assert');
const { io: connect } = require('socket.io-client');

const fixture = require('./fixtures/sans.json');
const { normalizeSansPayload, normalizeSansRecord } = require('../services/normalizer');
const { fetchThreats } = require('../services/collector');
const { Feed } = require('../services/feed');
const { createApp } = require('../app');

const FETCHED_AT = '2026-10-24T10:00:00.000Z';
const quiet = { log() {}, warn() {}, error() {} };

// Deterministic geo: a full city hit, a country-only hit, and misses.
const fakeLookup = (ip) => {
    if (ip === '91.191.209.198') return { country: 'TR', region: '34', city: 'Istanbul', ll: [41.0, 28.9] };
    if (ip === '8.8.8.8') return { country: 'US', region: '', city: '', ll: [37.75, -97.82] };
    return null;
};

test('normalizes a valid record and keeps provider timestamps separate from fetchedAt', () => {
    const obs = normalizeSansRecord(fixture[0], FETCHED_AT, fakeLookup);
    assert.strictEqual(obs.id, 'sans-isc:91.191.209.198');
    assert.strictEqual(obs.metrics.reportCount, 157503);
    assert.strictEqual(obs.metrics.targetCount, 8153);
    assert.strictEqual(obs.time.firstSeen, '2022-06-13');
    assert.strictEqual(obs.time.lastSeen, '2026-10-23');
    assert.strictEqual(obs.time.fetchedAt, FETCHED_AT);
    assert.strictEqual(obs.time.providerTimestamp, null);
    assert.strictEqual(obs.geo.precision, 'city');
    assert.strictEqual(obs.geo.countryName, 'Türkiye');
});

test('country-only geolocation is labelled with country precision', () => {
    const obs = normalizeSansRecord(fixture[1], FETCHED_AT, fakeLookup);
    assert.strictEqual(obs.geo.precision, 'country');
    assert.strictEqual(obs.geo.city, null);
});

test('failed geolocation keeps the record with null coordinates', () => {
    const obs = normalizeSansRecord({ ip: '10.0.0.5', attacks: 'x', count: -4, firstseen: '', lastseen: null }, FETCHED_AT, fakeLookup);
    assert.strictEqual(obs.geo.precision, 'unknown');
    assert.strictEqual(obs.geo.latitude, null);
    assert.strictEqual(obs.geo.longitude, null);
    assert.strictEqual(obs.metrics.reportCount, null);
    assert.strictEqual(obs.metrics.targetCount, null);
    assert.strictEqual(obs.time.firstSeen, null);
    assert.strictEqual(obs.time.lastSeen, null);
});

test('classification is unknown and destination is null for source-only records', () => {
    const { observations } = normalizeSansPayload(fixture, FETCHED_AT, fakeLookup);
    for (const obs of observations) {
        assert.strictEqual(obs.classification.category, 'unknown');
        assert.strictEqual(obs.classification.basis, 'unknown');
        assert.strictEqual(obs.destination, null);
    }
});

test('malformed and duplicate records are skipped and counted; non-array payload throws', () => {
    const { observations, skipped } = normalizeSansPayload(fixture, FETCHED_AT, fakeLookup);
    assert.strictEqual(observations.length, 3); // 91.x, 8.8.8.8, 10.0.0.5
    assert.strictEqual(skipped, 3); // empty ip, null, duplicate 8.8.8.8
    assert.throws(() => normalizeSansPayload({ nope: true }, FETCHED_AT, fakeLookup), { code: 'bad_format' });
});

test('collector: empty valid response is returned, failure throws a coded error', async () => {
    const empty = await fetchThreats({ http: { get: async () => ({ data: [] }) } });
    assert.deepStrictEqual(empty, []);

    const timeout = { get: async () => { const e = new Error('t'); e.code = 'ECONNABORTED'; throw e; } };
    await assert.rejects(fetchThreats({ http: timeout, retries: 0 }), { code: 'timeout' });

    const bad = { get: async () => ({ data: '<html>' }) };
    await assert.rejects(fetchThreats({ http: bad }), { code: 'bad_format' });
});

test('collector: retries are bounded; 429 is not retried', async () => {
    let calls = 0;
    const flaky = { get: async () => { calls += 1; const e = new Error('x'); e.response = { status: 503 }; throw e; } };
    await assert.rejects(fetchThreats({ http: flaky, retries: 2, wait: async () => {} }), { code: 'http_error' });
    assert.strictEqual(calls, 3);

    calls = 0;
    const limited = { get: async () => { calls += 1; const e = new Error('x'); e.response = { status: 429 }; throw e; } };
    await assert.rejects(fetchThreats({ http: limited, retries: 2, wait: async () => {} }), { code: 'rate_limited' });
    assert.strictEqual(calls, 1);
});

test('feed: empty success differs from failure, and failure keeps the previous snapshot', async () => {
    let mode = 'empty';
    const feed = new Feed({
        fetchRaw: async () => {
            if (mode === 'fail') { const e = new Error('down'); e.code = 'network'; throw e; }
            return mode === 'empty' ? [] : fixture;
        },
        normalize: (raw, at) => normalizeSansPayload(raw, at, fakeLookup),
        logger: quiet,
    });

    await feed.pollOnce();
    assert.strictEqual(feed.getHealth().status, 'ok');
    assert.strictEqual(feed.getHealth().observationCount, 0);
    assert.strictEqual(feed.getHealth().error, null);

    mode = 'data';
    await feed.pollOnce();
    assert.strictEqual(feed.getHealth().observationCount, 3);
    assert.strictEqual(feed.getHealth().mappedCount, 2);

    mode = 'fail';
    await feed.pollOnce();
    const health = feed.getHealth();
    assert.strictEqual(health.status, 'error');
    assert.strictEqual(health.error.code, 'network');
    assert.ok(health.lastSuccessAt);
    assert.strictEqual(feed.getSnapshot().observations.length, 3);
    assert.ok(feed.nextDelay() > feed.intervalMs, 'backs off after failure');
});

test('feed: poll cycles do not overlap', async () => {
    let active = 0;
    let maxActive = 0;
    const feed = new Feed({
        fetchRaw: async () => {
            active += 1;
            maxActive = Math.max(maxActive, active);
            await new Promise((r) => setTimeout(r, 20));
            active -= 1;
            return [];
        },
        logger: quiet,
    });
    const results = await Promise.all([feed.pollOnce(), feed.pollOnce(), feed.pollOnce()]);
    assert.strictEqual(maxActive, 1);
    assert.deepStrictEqual(results, [true, false, false]);
});

test('feed: stale flag after 3 missed intervals', async () => {
    let t = Date.parse(FETCHED_AT);
    const feed = new Feed({ fetchRaw: async () => [], now: () => new Date(t), logger: quiet });
    await feed.pollOnce();
    assert.strictEqual(feed.getHealth().stale, false);
    t += feed.intervalMs * 4;
    assert.strictEqual(feed.getHealth().stale, true);
});

test('new socket client receives the latest snapshot immediately; /health reports state', async () => {
    const feed = new Feed({
        fetchRaw: async () => fixture,
        normalize: (raw, at) => normalizeSansPayload(raw, at, fakeLookup),
        logger: quiet,
    });
    await feed.pollOnce();

    const { server, io } = createApp({ feed, allowedOrigins: ['*'] });
    await new Promise((resolve) => server.listen(0, resolve));
    const { port } = server.address();

    const client = connect(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
    try {
        const snapshot = await new Promise((resolve, reject) => {
            client.on('snapshot', resolve);
            client.on('connect_error', reject);
        });
        assert.strictEqual(snapshot.observations.length, 3);
        assert.strictEqual(snapshot.feed.status, 'ok');

        const res = await fetch(`http://127.0.0.1:${port}/health`);
        const body = await res.json();
        assert.strictEqual(res.status, 200);
        assert.strictEqual(body.feed.observationCount, 3);
    } finally {
        client.close();
        io.close();
        server.close();
    }
});
