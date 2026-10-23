const { createApp, createFeed } = require('./app');

const feed = createFeed();
const { server, io } = createApp({ feed });
feed.attachIo(io);

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT} (Socket.IO + GET /health)`);
    feed.start();
});
