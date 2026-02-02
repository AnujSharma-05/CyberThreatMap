const geoip = require('geoip-lite');

// we apply the CS concept of Heuristic Classification here to classify the "type" of attack based on known patterns as it is not given by the api
// logic: based upon the number of attacks and the total count of events from a single source ip, we can classify the attack type
// Port scan is like knocking the doors and leaving (few attack counts across many targets)
// Exploit attempt is like trying to break in (moderate attack counts across targets)
// DoS/DDoS or Flooding attack -- It is the big guns we are looking for!


//-------------------------New Addition Explanation-------------------------//

// Now here was some problem in mapping using geoIP lite that some ip addresses doen't have the info about the city of the location hence now we will move like this that

// If City exists → Use City (e.g., "Berlin").
// If City is missing but Region exists → Use Region (e.g., "California, US").
// If Region is missing → Use Country Code (e.g., "MAPPED: CN")



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
        
        // If GeoIP fails (common for private IPs) then return
        if(!geo) return;

        let locationLable = geo.city;

        if(!locationLable || locationLable.trim() === ""){
            if(geo.region && geo.region.trim() !== ""){
                locationLable = `${geo.region}, ${geo.country}`;
            } else {
                locationLable = `MAPPED: ${geo.country}`;   
            }
        }

        const type = classifyAttack(record.attacks, record.count);
        processed.push({ 
            src:{  
                ip: record.ip,
                country: geo.country,
                region: geo.region,
                //--------------------------New Addition---------//
                city: locationLable, // by doing this now we have ensured that locationLable always has some value
                lat: geo.ll[0],
                lng: geo.ll[1],
                type: type
            },
            dst:{

            },
            magnitude: record.count,
            timestamp: new Date().toISOString()
        });

    });
    
    return processed;
}



module.exports = { enrichThreatData };