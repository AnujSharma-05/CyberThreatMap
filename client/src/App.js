import React, { useState, useEffect, useRef } from 'react';
import Globe from 'react-globe.gl';
import io from 'socket.io-client';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:4000';

const socket = io(BACKEND_URL, {
  transports: ['websocket'],
  upgrade: false
});

function App() {
  const globeEl = useRef();
  const [attacks, setAttacks] = useState([]);
  const [status, setStatus] = useState('Connecting...');
  const [globeLabels, setGlobeLabels] = useState([]);

  useEffect(() => {
    socket.on('connect', () => {
      setStatus('CONNECTED: MONITORING');
    });

    socket.on('threat-data', (data) => {
      setStatus('WARNING: THREATS DETECTED');
      setAttacks(data);

      // --- LABEL GENERATION (No Emojis!) ---
      
      // 1. Attackers (Red Text)
      const attackers = data.map(d => ({
        lat: d.src.lat,
        lng: d.src.lng,
        text: d.src.city.toUpperCase(), // Clean Uppercase Text
        color: 'rgba(255, 60, 60, 0.9)', // Red
        size: 0.5,
        dotRadius: 0.3
      }));

      // 2. Targets (Cyan Text)
      const uniqueTargets = new Map();
      data.forEach(d => {
        uniqueTargets.set(d.dst.name, {
            lat: d.dst.lat,
            lng: d.dst.lng,
            text: `[HQ] ${d.dst.name.toUpperCase()}`, // Added [HQ] prefix for clarity
            color: 'rgba(0, 255, 255, 1)', // Cyan
            size: 0.8, // Bigger text
            dotRadius: 0.8 // Bigger dot
        });
      });
      
      setGlobeLabels([...attackers, ...Array.from(uniqueTargets.values())]);
    });

    // Auto-rotate logic
    if (globeEl.current) {
      globeEl.current.controls().autoRotate = true;
      globeEl.current.controls().autoRotateSpeed = 0.5;
    }

    return () => {
      socket.off('connect');
      socket.off('threat-data');
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', margin: 0, overflow: 'hidden' }}>
      
      {/* 1. TOP LEFT HUD */}
      <div style={{
        position: 'absolute', top: 20, left: 20, zIndex: 10,
        fontFamily: 'monospace', color: '#00ff00',
        pointerEvents: 'none'
      }}>
        <h2 style={{ margin: 0, textShadow: '0 0 5px #00ff00' }}>CYBER WAR ROOM</h2>
        <div style={{ fontSize: '12px', color: '#ccc' }}>REAL-TIME SANS ISC FEED</div>
        <br/>
        <div>STATUS: {status}</div>
        <div>ACTIVE VECTORS: {attacks.length}</div>
      </div>

      {/* 2. BOTTOM RIGHT LEGEND (The Key) */}
      <div style={{
        position: 'absolute', bottom: 30, right: 30, zIndex: 10,
        background: 'rgba(0, 10, 0, 0.8)',
        border: '1px solid #333',
        padding: '15px',
        borderRadius: '5px',
        fontFamily: 'monospace',
        color: 'white',
        minWidth: '200px'
      }}>
        <h4 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #555', paddingBottom: '5px' }}>LEGEND</h4>
        
        {/* Legend Item: Honeypot */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ width: '12px', height: '12px', background: '#00ffff', borderRadius: '50%', marginRight: '10px', boxShadow: '0 0 5px #00ffff' }}></div>
          <span style={{ fontSize: '12px' }}>HONEYPOT (Target)</span>
        </div>

        {/* Legend Item: Attacker */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ width: '12px', height: '12px', background: '#ff3c3c', borderRadius: '50%', marginRight: '10px' }}></div>
          <span style={{ fontSize: '12px' }}>ATTACKER (Source)</span>
        </div>

        {/* Legend Item: DDoS Line */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ width: '20px', height: '3px', background: '#ff0000', marginRight: '10px' }}></div>
          <span style={{ fontSize: '12px' }}>HEAVY TRAFFIC (DDoS)</span>
        </div>

        {/* Legend Item: Port Scan Line */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '20px', height: '3px', background: '#ff9900', marginRight: '10px' }}></div>
          <span style={{ fontSize: '12px' }}>RECON (Port Scan)</span>
        </div>
      </div>

      <Globe
        ref={globeEl}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        
        arcsData={attacks}
        arcStartLat={d => d.src.lat}
        arcStartLng={d => d.src.lng}
        arcEndLat={d => d.dst.lat}
        arcEndLng={d => d.dst.lng}
        arcColor={d => d.type === 'DDoS Flood' ? '#ff0000' : '#ff9900'}
        arcDashLength={0.4}
        arcDashGap={1}
        arcDashAnimateTime={2000}
        arcStroke={0.5}

        // RINGS for Impact
        ringsData={attacks}
        ringLat={d => d.dst.lat}
        ringLng={d => d.dst.lng}
        ringColor={() => '#00ffff'}
        ringMaxRadius={6}
        ringPropagationSpeed={3}
        ringRepeatPeriod={800}

        // LABELS
        labelsData={globeLabels}
        labelLat={d => d.lat}
        labelLng={d => d.lng}
        labelText={d => d.text}
        labelColor={d => d.color}
        labelSize={d => d.size}
        labelDotRadius={d => d.dotRadius}
      />
    </div>
  );
}

export default App;