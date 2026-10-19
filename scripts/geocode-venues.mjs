// Geocode each unique venue in data/timetables.json via OpenStreetMap Nominatim
// and write back coords: { lat, lng } onto every record for that venue.
//
// Usage: node scripts/geocode-venues.mjs
//
// Nominatim usage policy: polite (max ~1 req/sec, descriptive User-Agent).

import { readFileSync, writeFileSync } from 'node:fs';

const UA = 'ADE-App-Bot/1.0 (+https://github.com/theodoroskalfas-maker/ade)';
const FILE = 'data/timetables.json';
const timetables = JSON.parse(readFileSync(FILE, 'utf8'));

// Build the Nominatim query — append ", Amsterdam, Netherlands" so the search
// is biased to the right city. Also strip anything in parentheses (we often
// put the address or a note there) because Nominatim gets confused.
function queryFor(venue) {
  const clean = venue.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return `${clean}, Amsterdam, Netherlands`;
}

async function geocode(venue) {
  const q = encodeURIComponent(queryFor(venue));
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&addressdetails=0`;
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
  if (!r.ok) throw new Error(`${r.status} for ${venue}`);
  const body = await r.json();
  if (!Array.isArray(body) || body.length === 0) return null;
  const { lat, lon } = body[0];
  return { lat: Number(lat), lng: Number(lon) };
}

// Keep coords stable if already present — only look up venues missing coords.
const uniqueVenues = [...new Set(timetables.map((t) => t.venue))];
console.error(`Found ${uniqueVenues.length} unique venues across ${timetables.length} timetables.`);

const coordsByVenue = new Map();
for (const t of timetables) {
  if (t.coords && t.coords.lat && t.coords.lng && !coordsByVenue.has(t.venue)) {
    coordsByVenue.set(t.venue, t.coords);
  }
}

let fetched = 0;
for (const venue of uniqueVenues) {
  if (coordsByVenue.has(venue)) {
    console.error(`  cached: ${venue}`);
    continue;
  }
  try {
    const c = await geocode(venue);
    if (c) {
      coordsByVenue.set(venue, c);
      console.error(`  ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}  ← ${venue}`);
    } else {
      console.error(`  NO HIT: ${venue}`);
    }
  } catch (e) {
    console.error(`  ERROR ${e.message}: ${venue}`);
  }
  fetched++;
  // Rate-limit: ~1 req/sec per Nominatim policy
  await new Promise((r) => setTimeout(r, 1100));
}

// Write coords back onto every record for that venue.
let updated = 0;
for (const t of timetables) {
  const c = coordsByVenue.get(t.venue);
  if (!c) continue;
  if (!t.coords || t.coords.lat !== c.lat || t.coords.lng !== c.lng) {
    t.coords = c;
    updated++;
  }
}

writeFileSync(FILE, JSON.stringify(timetables, null, 2));
console.error(`Done. Fetched: ${fetched}. Records updated: ${updated}.`);
