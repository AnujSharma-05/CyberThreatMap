const axios = require('axios');

const SANS_URL = process.env.SANS_URL || 'https://isc.sans.edu/api/sources/attacks/20/?json';

class FeedError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

function classifyHttpError(error) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return new FeedError('timeout', 'SANS ISC request timed out');
    }
    const status = error.response && error.response.status;
    if (status === 429) return new FeedError('rate_limited', 'SANS ISC rate limit (HTTP 429)');
    if (status) return new FeedError('http_error', `SANS ISC responded with HTTP ${status}`);
    return new FeedError('network', 'Could not reach SANS ISC');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch the raw SANS ISC payload. Retries are bounded; a valid empty array
 * is returned as-is so callers can tell "no data" from "request failed".
 */
async function fetchThreats({
    http = axios,
    url = SANS_URL,
    timeoutMs = 10000,
    retries = 2,
    backoffMs = 1000,
    wait = sleep,
} = {}) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            const response = await http.get(url, { timeout: timeoutMs });
            if (!Array.isArray(response.data)) {
                throw new FeedError('bad_format', 'Unexpected data format from SANS ISC');
            }
            return response.data;
        } catch (error) {
            lastError = error instanceof FeedError ? error : classifyHttpError(error);
            // Do not hammer the provider when it asks us to slow down or is returning junk.
            if (lastError.code === 'rate_limited' || lastError.code === 'bad_format') break;
            if (attempt < retries) await wait(backoffMs * 2 ** attempt);
        }
    }
    throw lastError;
}

module.exports = { fetchThreats, FeedError, SANS_URL };
