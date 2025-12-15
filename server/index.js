const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const { fetchThreats } = require('./services/collector');
const { enrichThreatData } = require('./services/locator');

const app = express();
app.use(cors()); 

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Since we don't know the real victim, we visualize attacks hitting *us* --> honeypots 
// in these locations.
const TARGETS = [
    { name: "HQ (Seattle)", lat: 47.6062, lng: -122.3321 },
    { name: "Server EU (Berlin)", lat: 52.5200, lng: 13.4050 },
    { name: "Server Asia (Tokyo)", lat: 35.6762, lng: 139.6503 },
    { name: "Server SA (Sao Paulo)", lat: -23.5505, lng: -46.6333 },
    { name: "Server AU (Sydney)", lat: -33.8688, lng: 151.2093 },
    { name: "Server IN (Mumbai)", lat: 19.0760, lng: 72.8777 },
    { name: "Server IN (Delhi)", lat: 28.7041, lng: 77.1025 },
    { name: "Server IN (Bangalore)", lat: 12.9716, lng: 77.5946 }
];

function getRandomTarget() {
    return TARGETS[Math.floor(Math.random() * TARGETS.length)];
}

async function broadcastThreats() {
    try {
        console.log("Cycle Start: Fetching new intelligence...");
        
        
        const rawData = await fetchThreats();
        
        let richData = enrichThreatData(rawData);

   
        richData = richData.map(attack => {
            const target = getRandomTarget();
            return {
                ...attack,
                dst: {
                    name: target.name,
                    lat: target.lat,
                    lng: target.lng
                }
            };
        });

     
        if (richData.length > 0) {
            console.log(`📡 Broadcasting ${richData.length} attacks to clients.`);
            io.emit('threat-data', richData);
        }

    } catch (error) {
        console.error("Critical Error in Loop:", error);
    }
}


io.on('connection', (socket) => {
    console.log('👤 New Client Connected:', socket.id); 
    
  
});

setInterval(broadcastThreats, 60000);

broadcastThreats();



const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
    console.log(`
        Backend is alive! 
        Server running on: http://localhost:${PORT}
        Socket Endpoint: ws://localhost:${PORT}`);
});
