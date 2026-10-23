const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const { fetchThreats } = require('./services/collector');
const { Feed } = require('./services/feed');

// ALLOWED_ORIGINS: comma-separated list. Unset => local dev origins only.
function parseOrigins(value) {
    if (!value) return ['http://localhost:3000', 'http://127.0.0.1:3000'];
    return value.split(',').map((s) => s.trim()).filter(Boolean);
}

function createApp({ feed, allowedOrigins = parseOrigins(process.env.ALLOWED_ORIGINS) } = {}) {
    const app = express();
    const corsOptions = {
        origin: allowedOrigins.includes('*') ? true : allowedOrigins,
        methods: ['GET', 'POST'],
    };
    app.use(cors(corsOptions));

    const server = http.createServer(app);
    const io = new Server(server, { cors: corsOptions });

    app.get('/health', (req, res) => {
        const health = feed.getHealth();
        // 503 only before the first success has ever happened and the provider is failing.
        const unavailable = health.status === 'error' && !health.lastSuccessAt;
        res.status(unavailable ? 503 : 200).json({ ok: !unavailable, feed: health });
    });

    io.on('connection', (socket) => {
        // New clients get the current state immediately instead of waiting for the next poll.
        socket.emit('snapshot', feed.getSnapshot());
    });

    return { app, server, io };
}

function createFeed(options = {}) {
    let io = null;
    const feed = new Feed({
        fetchRaw: () => fetchThreats(),
        intervalMs: Number(process.env.POLL_INTERVAL_MS) || 60000,
        onUpdate: (snapshot) => io && io.emit('snapshot', snapshot),
        ...options,
    });
    feed.attachIo = (instance) => { io = instance; };
    return feed;
}

module.exports = { createApp, createFeed, parseOrigins };
