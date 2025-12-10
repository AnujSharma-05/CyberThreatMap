const axios = require('axios');

const url = "https://isc.sans.edu/api/sources/attacks/20/?json";
// this returns the top 20 attacking ips right now
// does this returns specifically dos attacks? or all attacks?
// answer: all attacks
// can we narrow it down to dos attacks only?
// answer: no, the api does not provide that functionality  

// can we add metadata to each attack entry like attack type, severity, etc.?
// answer: the api provides some metadata like attack type and port, but not severity

// what is the defination of all attacks here?
// answer: all attacks means any kind of cyber attack including dos, ddos, malware, phishing, etc.


// lets fetch the attack type as well
// we need to inspect the raw data returned by the api. lets do that in test.js

async function fetchThreats(){
    try{
        console.log("Polling Sans ISC for threat data...");
        const response = await axios.get(url);
        const data = response.data;

        if(Array.isArray(data)){
            console.log(`Fetched ${data.length} active threat entries.`);
            return data;
        } else {
            console.error("Unexpected data format received from Sans ISC.");
            return [];
        }
    } catch (error) {
        console.error("Error fetching threat data from Sans ISC:", error.message);
        return [];
    }
}


module.exports = { fetchThreats }; 