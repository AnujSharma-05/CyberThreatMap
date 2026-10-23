const geoip = require('geoip-lite');

const PROVIDER = 'sans-isc';

let regionNames = null;
try {
    regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
} catch (e) {
    regionNames = null;
}

function countryName(code) {
    if (!code || !regionNames) return null;
    try {
        return regionNames.of(code) || null;
    } catch (e) {
        return null;
    }
}

function toCount(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
}

function toDateString(value) {
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function nonEmpty(value) {
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function normalizeGeo(lookup) {
    if (!lookup) {
        return {
            countryCode: null,
            countryName: null,
            region: null,
            city: null,
            latitude: null,
            longitude: null,
            precision: 'unknown',
        };
    }
    const [lat, lng] = Array.isArray(lookup.ll) ? lookup.ll : [];
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
    const city = nonEmpty(lookup.city);
    const region = nonEmpty(lookup.region);
    const countryCode = nonEmpty(lookup.country);

    let precision = 'unknown';
    if (hasCoords) {
        if (city) precision = 'city';
        else if (region) precision = 'region';
        else if (countryCode) precision = 'country';
    }

    return {
        countryCode,
        countryName: countryName(countryCode),
        region,
        city,
        latitude: hasCoords ? lat : null,
        longitude: hasCoords ? lng : null,
        precision,
    };
}

// SANS source-summary records say nothing about attack type, so every record
// is "unknown" until a source (or an intel match) supplies stronger evidence.
function classify() {
    return {
        category: 'unknown',
        basis: 'unknown',
        label: 'Reported source activity',
        evidence: 'SANS ISC source summary; no attack type is reported for this record.',
    };
}

/**
 * Normalize one raw SANS ISC "sources/attacks" record.
 * Returns null when the record has no usable IP.
 * SANS definitions: `count` = number of reports, `attacks` = number of targets.
 */
function normalizeSansRecord(record, fetchedAt, lookup = geoip.lookup) {
    if (!record || typeof record.ip !== 'string' || record.ip.trim() === '') return null;
    const ip = record.ip.trim();

    return {
        id: `${PROVIDER}:${ip}`,
        provider: PROVIDER,
        observedEntity: { ip },
        geo: normalizeGeo(lookup(ip)),
        metrics: {
            reportCount: toCount(record.count),
            targetCount: toCount(record.attacks),
        },
        time: {
            firstSeen: toDateString(record.firstseen),
            lastSeen: toDateString(record.lastseen),
            providerTimestamp: null,
            fetchedAt,
        },
        classification: classify(),
        destination: null,
    };
}

/**
 * Normalize a raw payload. Malformed records are skipped and counted.
 * @returns {{ observations: object[], skipped: number }}
 */
function normalizeSansPayload(payload, fetchedAt, lookup = geoip.lookup) {
    if (!Array.isArray(payload)) {
        const err = new Error('Unexpected payload shape from SANS ISC');
        err.code = 'bad_format';
        throw err;
    }
    const seen = new Set();
    const observations = [];
    let skipped = 0;
    for (const record of payload) {
        const obs = normalizeSansRecord(record, fetchedAt, lookup);
        if (!obs || seen.has(obs.id)) {
            skipped += 1;
            continue;
        }
        seen.add(obs.id);
        observations.push(obs);
    }
    return { observations, skipped };
}

module.exports = { PROVIDER, normalizeSansRecord, normalizeSansPayload };
