const fs = require('fs');
const data = JSON.parse(fs.readFileSync('recording.json', 'utf8'));

console.log("Root keys:", Object.keys(data));
// Safari timeline files usually have an array or an object with specific records.
let records = data;
if (!Array.isArray(data)) {
    // sometimes it's nested
    if (data.recording && data.recording.events) records = data.recording.events;
    else if (data.events) records = data.events;
    else {
        // Just print some keys to figure out the structure
        for(let k in data) {
            console.log(k, typeof data[k], Array.isArray(data[k]) ? data[k].length : '');
        }
    }
}

if (Array.isArray(records)) {
    console.log("Total records:", records.length);
    const gcEvents = records.filter(e => JSON.stringify(e).toLowerCase().includes('garbage'));
    const compositeEvents = records.filter(e => JSON.stringify(e).toLowerCase().includes('composite'));
    
    console.log("Found GC events:", gcEvents.length);
    console.log("Found Composite events:", compositeEvents.length);
    
    if (gcEvents.length > 0) {
        console.log("Sample GC event:", JSON.stringify(gcEvents[0], null, 2));
    }
    if (compositeEvents.length > 0) {
        console.log("Sample Composite event:", JSON.stringify(compositeEvents[0], null, 2));
    }
}
