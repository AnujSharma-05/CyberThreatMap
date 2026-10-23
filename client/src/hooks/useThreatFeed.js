import { useEffect, useState } from 'react';
import io from 'socket.io-client';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:4000';

// Owns the socket for the lifetime of the component: one connection, listeners
// removed and socket closed on unmount (safe under React StrictMode remounts).
export function useThreatFeed() {
  const [socketState, setSocketState] = useState('connecting');
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ['websocket'], upgrade: false });
    socket.on('connect', () => setSocketState('connected'));
    socket.on('disconnect', () => setSocketState('disconnected'));
    socket.on('connect_error', () => setSocketState((s) => (s === 'connected' ? s : 'connecting')));
    socket.on('snapshot', setSnapshot);
    return () => {
      socket.off();
      socket.close();
    };
  }, []);

  return { socketState, snapshot };
}
