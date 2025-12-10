const { fetchThreats } = require('./collector');
// async function testing() {
//     const data = await fetchThreats();
//     console.log(data);
// }
// testing();



// new function for raw data analysis
// async function analyzeRawData() {
//     console.log("Analyzing raw data from Sans ISC...");
//     const data = await fetchThreats();

//     if(data.length >0){
//     console.log("Raw data fetched for analysis:");
//     console.log(JSON.stringify(data, null, 2)); 
//     console.log(".......................")



//     const sample = data[0];
//     console.log("Sample entry for inspection:");
//     console.log(JSON.stringify(sample, null, 2));

//     console.log(`Country: ${sample.country}`);
//     console.log(`Attack Type: ${sample.attack_type}`);
//     console.log(`Port: ${sample.port}`);
//     console.log(`Date: ${sample.date}`);
//     console.log(`Source IP: ${sample.src_ip}`);
//     console.log(`Destination IP: ${sample.dst_ip}`);
//     } else {
//         console.log("No data available for analysis.");
//     }
// }
// analyzeRawData();


// findings from raw data analysis:
// ip: The bad guy. (e.g., 52.73.237.2 is an Amazon AWS IP—hackers love hijacking cloud servers).
// attacks: The number of different IP addresses this attacker hit.
// count: The total number of packets or events generated.
// undefined fields: The API didn't give them to us.
// conclusion: The raw data does include attack type, port, date, source and destination IPs, and country information. This should help in further analysis of the threats.





// the following function is to test the locator functionality

const { enrichThreatData } = require('./locator');

async function testLocator() {
    console.log("fetching few data first...");
    const rawData = await fetchThreats();
    
    console.log(`enriching the ${rawData.length} fetched data with geo info...`);



    if(rawData.length >0){
    const richData = enrichThreatData(rawData);
    console.log("Enriched Threat Data:");
    console.log(JSON.stringify(richData, null, 2));

    console.log("summary:");
    console.log(`Total Inputs: ${rawData.length}`);
        console.log(`Geolocated: ${richData.length}`); // Should be close to equal
        console.log(`First Attack Type: ${richData[0].type}`);
        console.log(`Location: ${richData[0].src.city}, ${richData[0].src.country}`);
    } else {
        console.log("No raw data available to enrich.");
    }   
}
testLocator();