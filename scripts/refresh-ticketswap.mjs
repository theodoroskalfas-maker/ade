// Populate data/seed.json with direct TicketSwap resale URLs where confident,
// using TicketSwap's own public sitemap.xml (which robots.txt permits).
//
// Pipeline:
//   1. Download sitemap.xml (index) → all event_*.xml shards.
//   2. Filter each event URL to the ADE 2026 date window (Oct 21–26) AND to
//      Amsterdam-region slugs (ade / amsterdam / halfweg / zaandam / …).
//   3. For each party in seed.json, token-match name+venue against the slug
//      of same-date candidates. Precision-first thresholds — a wrong link
//      is worse than no link, so we prefer to miss over guess.
//   4. Write ticketswapUrl back into seed.json in place.
//
// Usage: node scripts/refresh-ticketswap.mjs data/seed.json
// Idempotent: running twice is safe. When no confident match is found we
// clear any stale ticketswapUrl so removed events don't linger.

import { readFileSync, writeFileSync } from 'node:fs';

const seedPath = process.argv[2] ?? 'data/seed.json';
const UA = 'Mozilla/5.0 (compatible; ADE-App-Bot/1.0; +https://github.com/theodoroskalfas-maker/ade)';

const ADE_DATES = new Set([
  '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26',
]);
const DAY_TO_DATE = {
  wed: '2026-10-21', thu: '2026-10-22', fri: '2026-10-23',
  sat: '2026-10-24', sun: '2026-10-25', mon: '2026-10-26',
};
// Restrict to Amsterdam-region ADE events; everything else at these dates
// (Dublin, Paris, Dubai concerts happening the same week) is unrelated.
const AMSTERDAM_HINT =
  /(?:^|-)(?:ade|amsterdam|halfweg|zaandam|amstelveen|haarlem|hilvarenbeek|utrecht)(?:-|$)/;

async function fetchText(url) {
  const r = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'application/xml,text/xml,*/*' },
  });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.text();
}

function locs(xml) {
  const out = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

// URL shape: /(club|festival|…)-tickets/<slug>-YYYY-MM-DD-<id>
function parseEventUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const kind = parts[0].replace(/-tickets$/, '');
    const rest = parts.slice(1).join('/');
    const m = rest.match(/^(.+?)-(\d{4}-\d{2}-\d{2})-([A-Za-z0-9]+)$/);
    if (!m) return null;
    return { url, slug: m[1], date: m[2], id: m[3], kind };
  } catch {
    return null;
  }
}

// ---- Index ----
console.error('Fetching sitemap index…');
const idxXml = await fetchText('https://www.ticketswap.com/sitemap.xml');
const shards = locs(idxXml).filter((u) => /\/sitemap\/(event|alias_event)_\d+\.xml$/.test(u));
console.error(`  ${shards.length} event shards`);

const ade = [];
for (const shard of shards) {
  const xml = await fetchText(shard);
  const urls = locs(xml);
  for (const url of urls) {
    const ev = parseEventUrl(url);
    if (!ev) continue;
    if (!ADE_DATES.has(ev.date)) continue;
    if (!AMSTERDAM_HINT.test(ev.slug)) continue;
    ade.push(ev);
  }
  // Be gentle — small delay between shards.
  await new Promise((r) => setTimeout(r, 250));
}
console.error(`  ${ade.length} ADE-region events found in the target date window`);

// ---- Match ----
const STOP = new Set([
  'ade', '2026', 'amsterdam', 'presents', 'invites', 'featuring', 'feat', 'ft', 'live', 'dj',
  'tba', 'sold', 'out', 'free', 'edition', 'day', 'night', 'party', 'event', 'festival',
  'showcase', 'records', 'the', 'and', 'with', 'for', 'from', 'club', 'tickets', 'ticket',
  'at', 'in', 'on', 'of', 'a', 'an', 'to', 'by', 'x', 'vs', 'b2b', 'special', 'guests',
  'guest', 'presented', 'presenting', 'closing', 'opening', 'ade2026', 'part', 'weekend',
  'weekender', 'kickoff', 'kick', 'off', 'invitation', 'invite',
]);

function tokenize(s) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

function coverage(partyTokens, tsTokens) {
  if (!partyTokens.length) return 0;
  const ts = new Set(tsTokens);
  const hits = partyTokens.filter((t) => ts.has(t)).length;
  return hits / partyTokens.length;
}

const THRESH = 0.6;
const MARGIN = 0.15;

const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const stats = { matched: 0, ambiguous: 0, missed: 0, cleared: 0 };

for (const p of seed) {
  const date = DAY_TO_DATE[p.day];
  if (!date) continue;
  const partyTokens = tokenize(`${p.name} ${p.venue ?? ''}`);
  const hadUrl = !!p.ticketswapUrl;

  if (!partyTokens.length) {
    if (hadUrl) { delete p.ticketswapUrl; stats.cleared++; }
    stats.missed++;
    continue;
  }

  let best = null;
  let secondBest = 0;
  for (const c of ade) {
    if (c.date !== date) continue;
    const s = coverage(partyTokens, tokenize(c.slug));
    if (best == null || s > best.score) {
      secondBest = best?.score ?? 0;
      best = { event: c, score: s };
    } else if (s > secondBest) {
      secondBest = s;
    }
  }

  const confident = best && best.score >= THRESH && (best.score - secondBest) >= MARGIN;
  if (confident) {
    p.ticketswapUrl = best.event.url;
    stats.matched++;
  } else {
    if (hadUrl) { delete p.ticketswapUrl; stats.cleared++; }
    if (best && best.score >= THRESH) stats.ambiguous++;
    else stats.missed++;
  }
}

writeFileSync(seedPath, JSON.stringify(seed, null, 2));
console.error(
  `Matched ${stats.matched}/${seed.length} (${((stats.matched / seed.length) * 100).toFixed(1)}%). ` +
    `Ambiguous: ${stats.ambiguous}. Missed: ${stats.missed}. Stale cleared: ${stats.cleared}.`
);
