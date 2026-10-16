// Pair each Timetable with its best matching Party by (day + fuzzy name/venue
// token overlap). Same scoring philosophy as the TicketSwap matcher — precision
// first, so a wrong link doesn't surface. Runs at request time on both arrays.

import type { Party, Timetable } from './types';

const STOP = new Set([
  'ade', '2026', 'amsterdam', 'presents', 'invites', 'featuring', 'feat', 'ft', 'live', 'dj',
  'tba', 'sold', 'out', 'free', 'edition', 'day', 'night', 'party', 'event', 'festival',
  'showcase', 'records', 'the', 'and', 'with', 'for', 'from', 'club', 'tickets', 'ticket',
  'at', 'in', 'on', 'of', 'a', 'an', 'to', 'by', 'x', 'vs', 'b2b', 'special', 'guests',
  'guest', 'presented', 'presenting', 'closing', 'opening', 'part', 'weekend', 'weekender',
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

function coverage(a: string[], b: string[]): number {
  if (!a.length) return 0;
  const bs = new Set(b);
  return a.filter((t) => bs.has(t)).length / a.length;
}

export function matchTimetablesToParties(
  timetables: Timetable[],
  parties: Party[]
): Map<string, Party | undefined> {
  const result = new Map<string, Party | undefined>();
  for (const tt of timetables) {
    const ttTokens = tokenize(`${tt.name} ${tt.venue}`);
    let best: { party: Party; score: number } | null = null;
    for (const p of parties) {
      if (p.day !== tt.day) continue;
      const s = coverage(ttTokens, tokenize(`${p.name} ${p.venue ?? ''}`));
      if (!best || s > best.score) best = { party: p, score: s };
    }
    result.set(tt.id, best && best.score >= 0.55 ? best.party : undefined);
  }
  return result;
}

// The inverse: for a given party id, is there a timetable we should link to?
export function matchPartiesToTimetables(
  timetables: Timetable[],
  parties: Party[]
): Map<string, Timetable | undefined> {
  const ttByParty = new Map<string, Timetable | undefined>();
  const ttMatches = matchTimetablesToParties(timetables, parties);
  for (const [ttId, p] of ttMatches) {
    if (!p) continue;
    const tt = timetables.find((t) => t.id === ttId)!;
    // If multiple timetables map to the same party (e.g. Luminosity Day + Night),
    // keep the first one — the UI shows a count rather than details.
    if (!ttByParty.has(p.id)) ttByParty.set(p.id, tt);
  }
  return ttByParty;
}
