// Derive one user-facing status from socket state + feed health.
// tone: loading | ok | warn | error
export function deriveStatus(socketState, snapshot) {
  const feed = snapshot && snapshot.feed;

  if (!feed) {
    return socketState === 'connected'
      ? { tone: 'loading', label: 'Waiting for first snapshot' }
      : { tone: 'loading', label: 'Connecting to server' };
  }
  if (socketState === 'disconnected') {
    return { tone: 'warn', label: 'Server disconnected · showing last data' };
  }
  if (feed.status === 'error') {
    return feed.lastSuccessAt
      ? { tone: 'warn', label: 'Provider error · showing last data' }
      : { tone: 'error', label: 'Provider error · no data yet' };
  }
  if (feed.stale) return { tone: 'warn', label: 'Feed stale' };
  if (feed.status === 'loading') return { tone: 'loading', label: 'Loading feed' };
  if (feed.observationCount === 0) return { tone: 'ok', label: 'Feed healthy · no observations' };
  return { tone: 'ok', label: 'Feed healthy' };
}

export function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
