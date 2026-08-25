// Parse an unzipped ADE xlsx → data/seed.json.
// Usage:  node scripts/parse-sheet.mjs <unzipped-xlsx-dir> <out.json>
// No deps; we hand-parse the XML since the shape is small and predictable.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// Content-hashed id so a sheet insertion doesn't shift every downstream party's
// id — that would silently invalidate users' saved favorites (stored by id
// in localStorage). Same (day, name, venue) always yields the same id.
function stableId(day, name, venue) {
  const h = createHash('sha1').update(`${day}::${name}::${venue || ''}`).digest('hex').slice(0, 10);
  return `s_${h}`;
}

const ROOT = resolve(process.argv[2] ?? 'ade_unzipped');
const OUT = process.argv[3] ?? 'data/seed.json';

const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

// ---- shared strings ----
const ssXml = read('xl/sharedStrings.xml');
const strings = [];
const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
let m;
while ((m = siRe.exec(ssXml))) {
  const body = m[1];
  const parts = [];
  const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
  let t;
  while ((t = tRe.exec(body))) parts.push(t[1]);
  strings.push(
    parts
      .join('')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
  );
}

// ---- styles: which xf indexes reference the FFFF2CC (yellow) fill = FREE ----
const stylesXml = read('xl/styles.xml');
const fillsBlock = stylesXml.match(/<fills\b[^>]*>([\s\S]*?)<\/fills>/)?.[1] ?? '';
const fills = [];
const fillRe = /<fill\b[^>]*>([\s\S]*?)<\/fill>/g;
while ((m = fillRe.exec(fillsBlock))) {
  const fg = m[1].match(/<fgColor[^>]*rgb="([^"]+)"/)?.[1] ?? null;
  fills.push(fg);
}
const freeFillIdx = fills.findIndex((c) => c && c.toUpperCase() === 'FFFFF2CC');

const cellXfsBlock = stylesXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? '';
const xfIsFree = [];
const xfRe = /<xf\b([^/]*?)(?:\/>|>[\s\S]*?<\/xf>)/g;
while ((m = xfRe.exec(cellXfsBlock))) {
  const attrs = m[1];
  const fillId = Number(attrs.match(/fillId="(\d+)"/)?.[1] ?? -1);
  xfIsFree.push(fillId === freeFillIdx);
}

// ---- hyperlink rId -> URL ----
const relsXml = read('xl/worksheets/_rels/sheet1.xml.rels');
const rid2url = {};
const relRe = /<Relationship\s+Id="([^"]+)"[^>]*Target="([^"]+)"/g;
while ((m = relRe.exec(relsXml))) rid2url[m[1]] = m[2].replace(/&amp;/g, '&');

// ---- sheet: cells + per-cell hyperlinks ----
const sheetXml = read('xl/worksheets/sheet1.xml');

const cellHref = {};
const hyperlinksBlock = sheetXml.match(/<hyperlinks\b[^>]*>([\s\S]*?)<\/hyperlinks>/)?.[1] ?? '';
const hlRe = /<hyperlink\s+([^/]*?)\/>/g;
while ((m = hlRe.exec(hyperlinksBlock))) {
  const attrs = m[1];
  const ref = attrs.match(/ref="([^"]+)"/)?.[1];
  const rid = attrs.match(/r:id="([^"]+)"/)?.[1];
  if (ref && rid && rid2url[rid]) cellHref[ref] = rid2url[rid];
}

const cells = {};
const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^/]*?)\/>/g;
while ((m = cellRe.exec(sheetXml))) {
  const attrs = m[1] ?? m[3] ?? '';
  const inner = m[2] ?? '';
  const ref = attrs.match(/r="([^"]+)"/)?.[1];
  if (!ref) continue;
  const t = attrs.match(/t="([^"]+)"/)?.[1] ?? 'n';
  const s = Number(attrs.match(/s="(\d+)"/)?.[1] ?? 0);
  let v = null;
  const vRaw = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
  const isRe = inner.match(/<is>([\s\S]*?)<\/is>/)?.[1];
  if (t === 's' && vRaw != null) v = strings[Number(vRaw)] ?? '';
  else if (t === 'inlineStr' && isRe) {
    const parts = [];
    const tRe2 = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let t2;
    while ((t2 = tRe2.exec(isRe))) parts.push(t2[1]);
    v = parts.join('');
  } else if (vRaw != null) v = vRaw;
  if (v == null || v === '') continue;
  cells[ref] = { v, free: !!xfIsFree[s], href: cellHref[ref] };
}

// Layout: row 1 = title. Row 2 = day headers. Row 3+ = one event per cell.
const DAYS = [
  { col: 'A', label: 'Wed 21', key: 'wed' },
  { col: 'B', label: 'Thu 22', key: 'thu' },
  { col: 'C', label: 'Fri 23', key: 'fri' },
  { col: 'D', label: 'Sat 24', key: 'sat' },
  { col: 'E', label: 'Sun 25', key: 'sun' },
  { col: 'F', label: 'Mon 26', key: 'mon' },
];

let maxRow = 0;
for (const ref of Object.keys(cells)) {
  const r = Number(ref.match(/\d+/)[0]);
  if (r > maxRow) maxRow = r;
}

function parseEvent(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length);
  if (!lines.length) return null;

  let name = '';
  let venue = '';
  const artistParts = [];
  // 'name' → still collecting the event name (before we hit Venue:/Artists:)
  // 'post-venue' → we've captured Venue; unlabeled lines afterwards are ignored
  //               (this is what keeps stray "Restroom Artists:" blocks from
  //                being glued onto the venue string)
  // 'artists' → currently inside an artists block; unlabeled lines continue it
  let mode = 'name';

  // Matches "Venue: X" — venue must be the whole line (single-line convention).
  const venueRe = /^venue\s*[:\-–]\s*(.*)$/i;
  // Matches any artist-section header, even when prefixed with a room/label:
  //   "Artists: …"       "Line-up: …"       "Featuring: …"
  //   "Main Room Artists: …"    "Shelter Artists (Main Room): …"
  const artistsRe =
    /(?:^|\b)(?:artists?|line\s*-?\s*up|lineup|featuring)\b[^:\-–\n]{0,40}[:\-–]\s*(.*)$/i;

  for (const line of lines) {
    const venueM = line.match(venueRe);
    if (venueM) {
      venue = venueM[1].trim();
      mode = 'post-venue';
      continue;
    }
    const artistsM = line.match(artistsRe);
    if (artistsM) {
      artistParts.push(artistsM[1].trim());
      mode = 'artists';
      continue;
    }
    if (mode === 'name') {
      name = name ? `${name} ${line}` : line;
    } else if (mode === 'artists') {
      // continuation of the current artists block
      if (artistParts.length) {
        artistParts[artistParts.length - 1] = `${artistParts[artistParts.length - 1]} ${line}`;
      } else {
        artistParts.push(line);
      }
    }
    // mode === 'post-venue' with an unlabeled line → drop it (avoids venue pollution)
  }

  name = name.trim();
  venue = venue.trim();
  const artists = artistParts.map((a) => a.trim()).filter(Boolean).join('; ');
  if (!name && !venue && !artists) return null;
  return { name, venue, artists };
}

const parties = [];
for (let row = 3; row <= maxRow; row++) {
  for (const { col, key, label } of DAYS) {
    const ref = `${col}${row}`;
    const cell = cells[ref];
    if (!cell) continue;
    const ev = parseEvent(cell.v);
    if (!ev || !ev.name) continue;
    parties.push({
      id: stableId(key, ev.name, ev.venue),
      day: key,
      dayLabel: label,
      name: ev.name,
      venue: ev.venue || null,
      artists: ev.artists || null,
      ticketUrl: cell.href || null,
      free: cell.free,
      source: 'sheet',
    });
  }
}

// Dedupe by id: if two rows collapse onto the same stable id (usually the
// sheet has a genuine duplicate), keep the entry with the most information.
// "Score" = artists filled + ticketUrl filled + free flag + venue length.
function score(p) {
  return (p.artists ? 2 : 0) + (p.ticketUrl ? 1 : 0) + (p.free ? 0 : 0) + (p.venue?.length ?? 0);
}
const byId = new Map();
let collisions = 0;
for (const p of parties) {
  const existing = byId.get(p.id);
  if (!existing) {
    byId.set(p.id, p);
  } else {
    collisions++;
    if (score(p) > score(existing)) byId.set(p.id, p);
  }
}
const deduped = [...byId.values()];

writeFileSync(OUT, JSON.stringify(deduped, null, 2));
console.error(
  `wrote ${OUT}: ${deduped.length} parties (${collisions} duplicate${
    collisions === 1 ? '' : 's'
  } merged), ${deduped.filter((p) => p.free).length} free, ${
    deduped.filter((p) => p.ticketUrl).length
  } with ticket URLs`
);
