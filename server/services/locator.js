const geoip = require('geoip-lite');

// we apply the CS concept of Heuristic Classification here to classify the "type" of attack based on known patterns as it is not given by the api
// logic: based upon the number of attacks and the total count of events from a single source ip, we can classify the attack type
// Port scan is like knocking the doors and leaving (few attack counts across many targets)
// Exploit attempt is like trying to break in (moderate attack counts across targets)
// DoS/DDoS or Flooding attack -- It is the big guns we are looking for!


function classifyAttack(attacks, count) {
    const intensity = count / attacks;

    if(intensity <5) return "Port Scan";
    if(intensity <50) return "Exploit Attempt";
    if(intensity>=50) return "Denial of Service (DoS/DDoS) or Flooding Attack";
    return "Unknown Attack Type";
}


// this functiong basically adds lats and longs to the SANS Raw Data
function enrichThreatData(rawData){
    const processed = [];
    
    rawData.forEach(record => {
        const geo = geoip.lookup(record.ip);
        
        // If GeoIP fails (common for private IPs), skip
        if(!geo) return;

        const type = classifyAttack(record.attacks, record.count);

        // Pushing ONE single object containing everything
        processed.push({
            // Wrap location data in 'src' so it's organized
            src: {
                ip: record.ip,
                country: geo.country,
                region: geo.region,
                city: geo.city || "Unknown", // Handle missing city names
                lat: geo.ll[0],
                lng: geo.ll[1]
            },
            // Metadata at the root level
            type: type,
            magnitude: record.count,
            timestamp: new Date().toISOString()
        });
    });
    
    return processed;
}

module.exports = { enrichThreatData };