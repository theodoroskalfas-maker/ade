// Parse an unzipped ADE xlsx → data/seed.json.
// Usage:  node scripts/parse-sheet.mjs <unzipped-xlsx-dir> <out.json>
// No deps; we hand-parse the XML since the shape is small and predictable.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
  let artists = '';
  let mode = 'name';
  for (const line of lines) {
    const venueM = line.match(/^venue\s*[:\-–]\s*(.*)$/i);
    const artistsM = line.match(/^(?:artists?|line\s*-?\s*up|lineup|featuring)\s*[:\-–]\s*(.*)$/i);
    if (venueM) { venue = venueM[1].trim(); mode = 'venue'; continue; }
    if (artistsM) { artists = artistsM[1].trim(); mode = 'artists'; continue; }
    if (mode === 'name') name = name ? `${name} ${line}` : line;
    else if (mode === 'venue') venue = venue ? `${venue} ${line}` : line;
    else if (mode === 'artists') artists = artists ? `${artists} ${line}` : line;
  }
  name = name.trim(); venue = venue.trim(); artists = artists.trim();
  if (!name && !venue && !artists) return null;
  return { name, venue, artists };
}

const parties = [];
let idCounter = 1;
for (let row = 3; row <= maxRow; row++) {
  for (const { col, key, label } of DAYS) {
    const ref = `${col}${row}`;
    const cell = cells[ref];
    if (!cell) continue;
    const ev = parseEvent(cell.v);
    if (!ev || !ev.name) continue;
    parties.push({
      id: `s${idCounter++}`,
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

writeFileSync(OUT, JSON.stringify(parties, null, 2));
console.error(
  `wrote ${OUT}: ${parties.length} parties, ${parties.filter((p) => p.free).length} free, ${
    parties.filter((p) => p.ticketUrl).length
  } with ticket URLs`
);
