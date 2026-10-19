'use client';

import { useMemo, useState } from 'react';
import type { Party, Timetable, TimetableSlot } from '@/lib/types';

type Props = {
  tt: Timetable;
  // Optional: the matching party in seed.json, if we found one. When present we
  // can show its ticket link / FREE badge without duplicating that data in the
  // timetable record itself.
  matchedParty?: Party;
  // "Live clock" iso string ("YYYY-MM-DDTHH:MM") used to highlight the current
  // and next slots. Only set when today is inside ADE week — otherwise we skip
  // the highlighting entirely (no colour noise when it's not useful).
  nowIsoLocal?: string;
};

export default function TimetableCard({ tt, matchedParty, nowIsoLocal }: Props) {
  const [open, setOpen] = useState(false);

  const totalSlots = useMemo(
    () => tt.rooms.reduce((n, r) => n + r.slots.length, 0),
    [tt]
  );
  const totalActs = totalSlots || tt.lineup?.length || 0;

  const nowMinutes = nowIsoLocal && nowIsoLocal.startsWith(tt.date)
    ? toMinutes(nowIsoLocal.slice(11, 16))
    : null;

  // Compute per-room "live" state only when it matters (we're inside the date).
  const liveByRoom = useMemo(() => {
    if (nowMinutes == null) return null;
    return tt.rooms.map((room) => {
      const sorted = [...room.slots].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
      let nowIdx = -1;
      let nextIdx = -1;
      for (let i = 0; i < sorted.length; i++) {
        const s = sorted[i];
        // Night slots wrap past midnight — compare in minutes with wrap handling.
        const [startM, endM] = windowMinutes(s.start, s.end);
        const n = normaliseWrap(nowMinutes, startM);
        if (n >= startM && n < endM) nowIdx = i;
        else if (n < startM && (nextIdx === -1 || startM < toMinutes(sorted[nextIdx].start))) nextIdx = i;
      }
      return { sorted, nowIdx, nextIdx };
    });
  }, [tt, nowMinutes]);

  const ticketUrl = tt.ticketUrl ?? matchedParty?.ticketUrl ?? null;
  const ticketswapUrl = matchedParty?.ticketswapUrl;

  return (
    <article className="rounded-2xl border border-line bg-panel p-4 shadow-sm transition">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-snug">{tt.name}</h3>
          <p className="mt-1 text-sm text-muted">
            <span className="text-muted/70">📍 </span>
            {tt.venue}
          </p>
          <p className="mt-1 text-xs text-muted">
            {tt.window ? <span className="tabular-nums">{tt.window}</span> : <span>Set times TBA</span>}
            <span className="mx-2 text-muted/40">·</span>
            <span>{totalActs} {totalActs === 1 ? 'act' : 'acts'}</span>
            {tt.rooms.length > 1 && (
              <>
                <span className="mx-2 text-muted/40">·</span>
                <span>{tt.rooms.length} rooms</span>
              </>
            )}
          </p>
        </div>
        <span
          aria-hidden
          className={
            'ml-1 mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-muted transition ' +
            (open ? 'rotate-180 bg-panel2' : '')
          }
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="mt-4 border-t border-line pt-4">
          {tt.rooms.length > 0 ? (
            <div
              className={
                'grid gap-5 ' + (tt.rooms.length > 1 ? 'sm:grid-cols-2' : 'grid-cols-1')
              }
            >
              {tt.rooms.map((room, i) => (
                <div key={room.name}>
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-accent">
                    {room.name}
                  </h4>
                  <ul className="grid gap-1.5">
                    {(liveByRoom?.[i]?.sorted ?? room.slots).map((slot, j) => {
                      const isNow = liveByRoom?.[i]?.nowIdx === j;
                      const isNext = liveByRoom?.[i]?.nextIdx === j;
                      return <SlotRow key={`${slot.start}-${j}`} slot={slot} isNow={isNow} isNext={isNext} />;
                    })}
                  </ul>
                </div>
              ))}
            </div>
          ) : tt.lineup && tt.lineup.length > 0 ? (
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
                Line-up {tt.window ? '(set times TBA)' : ''}
              </h4>
              <ul className="grid gap-1.5">
                {tt.lineup.map((artist) => (
                  <li key={artist} className="rounded-lg border border-line bg-panel2 px-3 py-2 text-sm">
                    {artist}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted">No set times published yet.</p>
          )}

          {tt.note && (
            <p className="mt-4 rounded-lg border border-line bg-panel2 px-3 py-2 text-xs text-muted">
              {tt.note}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {ticketUrl && (
              <a
                href={ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel2 px-3 py-1.5 text-xs font-semibold text-white/90 active:scale-95"
              >
                <span>Tickets & info</span>
                <span aria-hidden>↗</span>
              </a>
            )}
            {ticketswapUrl && (
              <a
                href={ticketswapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/60 bg-accent/15 px-3 py-1.5 text-xs font-semibold text-white active:scale-95"
              >
                <span>TicketSwap</span>
                <span aria-hidden>↗</span>
              </a>
            )}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tt.venue + ' Amsterdam')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel2 px-3 py-1.5 text-xs font-semibold text-white/90 active:scale-95"
            >
              <span>Map</span>
              <span aria-hidden>↗</span>
            </a>
            <a
              href={fromHotelUrl(tt.venue)}
              target="_blank"
              rel="noopener noreferrer"
              title="Live transit directions from Hyatt Regency Amsterdam"
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent2/60 bg-accent2/15 px-3 py-1.5 text-xs font-semibold text-accent2 active:scale-95"
            >
              <span>🚆 From hotel</span>
              <span aria-hidden>↗</span>
            </a>
            <a
              href={routeToNearestUrl(tt.venue, "McDonald's")}
              target="_blank"
              rel="noopener noreferrer"
              title="Walking route to the nearest McDonald's — shows distance and time"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel2 px-3 py-1.5 text-xs font-semibold text-white/90 active:scale-95"
            >
              <span>🍟 McDonald&apos;s</span>
              <span aria-hidden>↗</span>
            </a>
            <a
              href={routeToNearestUrl(tt.venue, 'Starbucks')}
              target="_blank"
              rel="noopener noreferrer"
              title="Walking route to the nearest Starbucks — shows distance and time"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel2 px-3 py-1.5 text-xs font-semibold text-white/90 active:scale-95"
            >
              <span>☕ Starbucks</span>
              <span aria-hidden>↗</span>
            </a>
          </div>
        </div>
      )}
    </article>
  );
}

function SlotRow({ slot, isNow, isNext }: { slot: TimetableSlot; isNow: boolean; isNext: boolean }) {
  return (
    <li
      className={
        'flex items-baseline gap-3 rounded-lg border px-3 py-2 text-sm transition ' +
        (isNow
          ? 'border-accent bg-accent/15'
          : isNext
            ? 'border-accent/40 bg-accent/[0.04]'
            : 'border-line bg-panel2')
      }
    >
      <span className="shrink-0 tabular-nums text-xs text-muted">
        {slot.start}
        <span className="text-muted/50">–</span>
        {slot.end}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{slot.artist}</span>
      {isNow && (
        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          Now
        </span>
      )}
      {isNext && !isNow && (
        <span className="shrink-0 rounded-full border border-accent/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
          Next
        </span>
      )}
    </li>
  );
}

// Transit directions from where the user is staying this week.
// Hardcoded for now — if someone else uses this app it's trivial to lift into
// a localStorage-backed setting, but a single pinned origin keeps the UI quiet.
const HOTEL_ORIGIN = 'Hyatt Regency Amsterdam, Weesperzijde 150, Amsterdam';

function fromHotelUrl(venue: string): string {
  const origin = encodeURIComponent(HOTEL_ORIGIN);
  const dest = encodeURIComponent(`${venue} Amsterdam`);
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=transit`;
}

// Walking directions from the venue to the nearest branch of a chain.
// Google Maps resolves a generic destination like "McDonald's" or "Starbucks"
// to the closest matching place from the origin, and the result screen shows
// distance + walk time up front — way more useful than a list of search hits.
function routeToNearestUrl(venue: string, chain: string): string {
  const origin = encodeURIComponent(`${venue} Amsterdam`);
  const dest = encodeURIComponent(chain);
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=walking`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// A slot like 23:30-01:00 crosses midnight. Return [startM, endM] with endM
// always greater than startM by adding 24h to end when it would otherwise be
// before start.
function windowMinutes(start: string, end: string): [number, number] {
  const s = toMinutes(start);
  let e = toMinutes(end);
  if (e <= s) e += 24 * 60;
  return [s, e];
}

// When "now" is in the early hours (e.g. 02:00) but a slot starts the previous
// evening (23:30 with end 01:00+1d), we need to normalise "now" to the same day.
// If now is earlier than start AND we're in the small hours, treat now as +24h.
function normaliseWrap(nowM: number, startM: number): number {
  if (nowM < startM && nowM < 6 * 60) return nowM + 24 * 60;
  return nowM;
}
