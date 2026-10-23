const { normalizeSansPayload, PROVIDER } = require('./normalizer');

const MAX_BACKOFF_MS = 10 * 60 * 1000;

/**
 * Owns the latest in-memory snapshot and feed health. Polls sequentially
 * (setTimeout chain + in-flight guard), so cycles never overlap, and backs
 * off exponentially while the provider is failing.
 */
class Feed {
    constructor({ fetchRaw, normalize = normalizeSansPayload, intervalMs = 60000, now = () => new Date(), onUpdate = () => {}, logger = console }) {
        this.fetchRaw = fetchRaw;
        this.normalize = normalize;
        this.intervalMs = intervalMs;
        this.now = now;
        this.onUpdate = onUpdate;
        this.logger = logger;

        this.observations = [];
        this.failures = 0;
        this.inFlight = false;
        this.timer = null;
        this.stopped = false;
        this.state = {
            provider: PROVIDER,
            status: 'loading', // loading | ok | error
            lastAttemptAt: null,
            lastSuccessAt: null,
            error: null,
            observationCount: 0,
            mappedCount: 0,
            skippedCount: 0,
            intervalMs,
        };
    }

    getHealth() {
        const s = { ...this.state };
        // A feed that has succeeded before but has not refreshed in 3 intervals is stale.
        s.stale = Boolean(s.lastSuccessAt) && this.now() - new Date(s.lastSuccessAt) > this.intervalMs * 3;
        return s;
    }

    getSnapshot() {
        return { feed: this.getHealth(), observations: this.observations };
    }

    async pollOnce() {
        if (this.inFlight) return false;
        this.inFlight = true;
        const attemptAt = this.now().toISOString();
        this.state.lastAttemptAt = attemptAt;
        try {
            const raw = await this.fetchRaw();
            const { observations, skipped } = this.normalize(raw, attemptAt);
            this.observations = observations;
            this.failures = 0;
            this.state = {
                ...this.state,
                status: 'ok',
                lastSuccessAt: attemptAt,
                error: null,
                observationCount: observations.length,
                mappedCount: observations.filter((o) => o.geo.latitude !== null).length,
                skippedCount: skipped,
            };
            if (skipped > 0) this.logger.warn(`[feed] skipped ${skipped} malformed/duplicate record(s)`);
            this.logger.log(`[feed] ok: ${observations.length} observations (${this.state.mappedCount} mapped)`);
        } catch (error) {
            this.failures += 1;
            // Keep serving the previous snapshot; surface the failure separately.
            this.state = {
                ...this.state,
                status: 'error',
                error: { code: error.code || 'unknown', message: error.message },
            };
            this.logger.error(`[feed] ${this.state.error.code}: ${error.message} (failure #${this.failures})`);
        } finally {
            this.inFlight = false;
        }
        this.onUpdate(this.getSnapshot());
        return true;
    }

    nextDelay() {
        return this.failures === 0 ? this.intervalMs : Math.min(this.intervalMs * 2 ** this.failures, MAX_BACKOFF_MS);
    }

    start() {
        this.stopped = false;
        const loop = async () => {
            await this.pollOnce();
            if (!this.stopped) {
                this.timer = setTimeout(loop, this.nextDelay());
            }
        };
        return loop();
    }

    stop() {
        this.stopped = true;
        clearTimeout(this.timer);
    }
}

module.exports = { Feed };
