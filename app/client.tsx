'use client';

import { useEffect, useMemo, useState } from 'react';
import { DAYS, type DayKey, type Party, type Timetable } from '@/lib/types';
import { useFavorites } from '@/lib/useFavorites';
import { matchTimetablesToParties, matchPartiesToTimetables } from '@/lib/timetableMatch';
import PartyCard from '@/components/PartyCard';
import TimetableCard from '@/components/TimetableCard';
import AddPartyDialog from '@/components/AddPartyDialog';

type Props = { parties: Party[]; timetables: Timetable[] };

type View = DayKey | 'faves';
type Mode = 'parties' | 'timetables';

export default function Client({ parties, timetables }: Props) {
  const [mode, setMode] = useState<Mode>('parties');
  const [view, setView] = useState<View>('wed');
  const [q, setQ] = useState('');
  const [freeOnly, setFreeOnly] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const { isFav, toggle, count: favCount } = useFavorites();

  // Live clock for "Now Playing" highlighting in Timetables mode. Only computed
  // during ADE week (21-26 Oct 2026) — outside that window we skip entirely so
  // the UI isn't noisy with highlights that aren't actionable.
  const nowIsoLocal = useLiveClockDuringADE();

  const qTrimmed = q.trim().toLowerCase();
  const searching = qTrimmed.length > 0;

  // Counts per day — show the right number depending on mode.
  const dayCounts = useMemo(() => {
    const c: Record<DayKey, number> = { wed: 0, thu: 0, fri: 0, sat: 0, sun: 0, mon: 0 };
    if (mode === 'parties') for (const p of parties) c[p.day]++;
    else for (const t of timetables) c[t.day]++;
    return c;
  }, [parties, timetables, mode]);

  // Match timetables ↔ parties once per render.
  const ttByParty = useMemo(
    () => matchPartiesToTimetables(timetables, parties),
    [timetables, parties]
  );
  const partyByTt = useMemo(
    () => matchTimetablesToParties(timetables, parties),
    [timetables, parties]
  );

  // ---- Parties mode: existing filter + group logic ----
  const filteredParties = useMemo(() => {
    return parties.filter((p) => {
      if (freeOnly && !p.free) return false;
      if (qTrimmed) {
        const hay = `${p.name} ${p.venue ?? ''} ${p.artists ?? ''}`.toLowerCase();
        if (!hay.includes(qTrimmed)) return false;
      }
      return true;
    });
  }, [parties, qTrimmed, freeOnly]);

  const partyGroups = useMemo(() => {
    let base = filteredParties;
    if (!searching && view === 'faves') base = base.filter((p) => isFav(p.id));
    if (!searching && view !== 'faves') base = base.filter((p) => p.day === view);
    const sorted = [...base].sort((a, b) => {
      if (a.source !== b.source) return a.source === 'user' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    const byDay = new Map<DayKey, Party[]>();
    for (const d of DAYS) byDay.set(d.key, []);
    for (const p of sorted) byDay.get(p.day)!.push(p);
    return DAYS.map((d) => ({ day: d, list: byDay.get(d.key)! })).filter((g) => g.list.length > 0);
  }, [filteredParties, searching, view, isFav]);

  // ---- Timetables mode ----
  const timetableList = useMemo(() => {
    const base = timetables.filter((t) => {
      if (!searching) return view === 'faves' ? false : t.day === view; // Faves tab is party-only
      // When searching, match across all days: name/venue/room-artist/lineup
      const hay = (
        t.name + ' ' + t.venue + ' ' +
        t.rooms.flatMap((r) => r.slots.map((s) => s.artist)).join(' ') + ' ' +
        (t.lineup?.join(' ') ?? '')
      ).toLowerCase();
      return hay.includes(qTrimmed);
    });
    // Sort by start-time ascending for the day; untimed timetables go last.
    return base.sort((a, b) => {
      const aw = a.window?.split('-')[0] ?? '99:99';
      const bw = b.window?.split('-')[0] ?? '99:99';
      return aw.localeCompare(bw);
    });
  }, [timetables, searching, view, qTrimmed]);

  const totalShown = mode === 'parties'
    ? partyGroups.reduce((n, g) => n + g.list.length, 0)
    : timetableList.length;
  const showGrouped = mode === 'parties' && (searching || view === 'faves');

  function applyFilter(query: string) {
    setQ(query);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-line bg-night/90 backdrop-blur">
        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight">
              ADE <span className="text-accent">2026</span>
            </h1>
            <p className="text-xs text-muted">Happy 30th, Amsterdam.</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-accent/20 active:scale-95"
          >
            + Add
          </button>
        </div>

        {/* Mode toggle */}
        <div className="px-4 pb-2">
          <div className="inline-flex rounded-xl border border-line bg-panel p-0.5 text-xs font-semibold">
            <ModeTab active={mode === 'parties'} onClick={() => setMode('parties')}>
              📋 Parties
              <span className="ml-1.5 rounded-full bg-black/30 px-1.5 py-0.5 text-[10px] text-muted">
                {parties.length}
              </span>
            </ModeTab>
            <ModeTab active={mode === 'timetables'} onClick={() => setMode('timetables')}>
              ⏰ Timetables
              <span className="ml-1.5 rounded-full bg-black/30 px-1.5 py-0.5 text-[10px] text-muted">
                {timetables.length}
              </span>
            </ModeTab>
          </div>
        </div>

        {/* Day tabs + (Parties-only) Faves */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
          {DAYS.map((d) => {
            const active = !searching && d.key === view;
            return (
              <button
                key={d.key}
                onClick={() => setView(d.key)}
                className={
                  'flex shrink-0 flex-col items-center rounded-2xl border px-4 py-2 text-left transition ' +
                  (active ? 'border-accent bg-accent/10' : 'border-line bg-panel hover:border-muted/50')
                }
              >
                <span className={'text-xs ' + (active ? 'text-accent' : 'text-muted')}>{d.short}</span>
                <span className="text-sm font-semibold">{d.date}</span>
                <span className="mt-0.5 text-[10px] text-muted">{dayCounts[d.key]}</span>
              </button>
            );
          })}
          {mode === 'parties' && (
            <button
              onClick={() => setView('faves')}
              className={
                'flex shrink-0 flex-col items-center rounded-2xl border px-4 py-2 text-left transition ' +
                (!searching && view === 'faves'
                  ? 'border-accent bg-accent/10'
                  : 'border-line bg-panel hover:border-muted/50')
              }
            >
              <span className={'text-xs ' + (!searching && view === 'faves' ? 'text-accent' : 'text-muted')}>♥</span>
              <span className="text-sm font-semibold">Faves</span>
              <span className="mt-0.5 text-[10px] text-muted">{favCount}</span>
            </button>
          )}
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-2 px-4 pb-3">
          <div className="relative flex-1">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                mode === 'parties'
                  ? 'Search all days (e.g. Armin, Shelter…)'
                  : 'Search timetables (artist, venue, event…)'
              }
              className="w-full rounded-xl border border-line bg-panel py-2 pl-3 pr-8 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full px-2 text-lg leading-none text-muted hover:text-white"
              >
                ×
              </button>
            )}
          </div>
          {mode === 'parties' && (
            <button
              onClick={() => setFreeOnly((v) => !v)}
              className={
                'shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition ' +
                (freeOnly
                  ? 'border-accent2 bg-accent2/20 text-accent2'
                  : 'border-line bg-panel text-muted')
              }
              aria-pressed={freeOnly}
            >
              Free only
            </button>
          )}
        </div>

        {/* Status line */}
        {(searching || (mode === 'parties' && view === 'faves')) && (
          <div className="px-4 pb-2 text-xs text-muted">
            {searching ? (
              <>
                {totalShown} match{totalShown === 1 ? '' : 'es'}{' '}
                in {mode === 'parties' ? 'parties' : 'timetables'} for{' '}
                <span className="text-white">“{q.trim()}”</span>
              </>
            ) : (
              <>
                {totalShown} favorited part{totalShown === 1 ? 'y' : 'ies'} — saved on this device
              </>
            )}
          </div>
        )}
      </header>

      {/* List */}
      <main className="pb-safe px-4 pt-3">
        {mode === 'parties' ? (
          totalShown === 0 ? (
            <EmptyState mode="parties" searching={searching} isFavesView={view === 'faves' && !searching} />
          ) : showGrouped ? (
            <div className="grid gap-6">
              {partyGroups.map((g) => (
                <section key={g.day.key}>
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
                    {g.day.short} · {g.day.date} · {g.list.length}
                  </h2>
                  <ul className="grid gap-3">
                    {g.list.map((p, i) => (
                      <li key={p.id}>
                        <PartyCard
                          party={p}
                          index={i + 1}
                          isFav={isFav(p.id)}
                          onToggleFav={toggle}
                          onFilter={applyFilter}
                          timetable={ttByParty.get(p.id)}
                          onOpenTimetable={() => {
                            setMode('timetables');
                            setView(p.day);
                            if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <ul className="grid gap-3">
              {partyGroups[0]!.list.map((p, i) => (
                <li key={p.id}>
                  <PartyCard
                    party={p}
                    index={i + 1}
                    isFav={isFav(p.id)}
                    onToggleFav={toggle}
                    onFilter={applyFilter}
                    timetable={ttByParty.get(p.id)}
                    onOpenTimetable={() => {
                      setMode('timetables');
                      setView(p.day);
                      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  />
                </li>
              ))}
            </ul>
          )
        ) : (
          /* Timetables mode */
          totalShown === 0 ? (
            <EmptyState mode="timetables" searching={searching} isFavesView={false} />
          ) : (
            <ul className="grid gap-3">
              {timetableList.map((tt) => (
                <li key={tt.id}>
                  <TimetableCard tt={tt} matchedParty={partyByTt.get(tt.id)} nowIsoLocal={nowIsoLocal ?? undefined} />
                </li>
              ))}
            </ul>
          )
        )}
      </main>

      {/* Footer */}
      <footer className="mt-8 border-t border-line px-4 py-6 text-center text-xs text-muted">
        <p className="tabular-nums">
          <span className="text-white">{parties.length}</span> parties ·{' '}
          <span className="text-accent2">{parties.filter((p) => p.free).length}</span> free ·{' '}
          <span className="text-white">{timetables.length}</span> timetables · 6 days
        </p>
        <p className="mt-1">Wed 21 · Thu 22 · Fri 23 · Sat 24 · Sun 25 · Mon 26 Oct</p>
        <p className="mt-3 text-[10px] text-muted/70">
          Data adapted from a community sheet · Follow{' '}
          <a
            href="https://www.instagram.com/reverseskydivingclub"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted underline-offset-2 hover:text-white"
          >
            @reverseskydivingclub
          </a>
        </p>
      </footer>

      {showAdd && (
        <AddPartyDialog
          defaultDay={view === 'faves' ? 'wed' : view}
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

function ModeTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-lg px-3 py-1.5 transition ' +
        (active ? 'bg-accent text-white shadow' : 'text-muted hover:text-white')
      }
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function EmptyState({
  mode,
  searching,
  isFavesView,
}: {
  mode: Mode;
  searching: boolean;
  isFavesView: boolean;
}) {
  return (
    <div className="mt-16 text-center text-muted">
      {searching ? (
        <>
          <p>No {mode} match that search.</p>
          <p className="mt-1 text-xs">Try a different term.</p>
        </>
      ) : isFavesView ? (
        <>
          <p>No favorites yet.</p>
          <p className="mt-1 text-xs">Tap the ♡ on a party to save it here.</p>
        </>
      ) : mode === 'timetables' ? (
        <>
          <p>No timetables for this day yet.</p>
          <p className="mt-1 text-xs">More get added as organisers publish set times.</p>
        </>
      ) : (
        <>
          <p>No parties match.</p>
          <p className="mt-1 text-xs">Try clearing the filter.</p>
        </>
      )}
    </div>
  );
}

// Returns an ISO-ish local string "YYYY-MM-DDTHH:MM" updated once a minute,
// but only during ADE week (21-26 Oct 2026). Outside that window returns null
// so the UI knows to skip Now/Next highlighting entirely.
function useLiveClockDuringADE(): string | null {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  const d = now.getDate();
  // Oct 21-26 2026 (month index 9). Include a 1-hour grace at either edge so
  // late-night sets near midnight on Mon 26 still light up.
  if (y !== 2026 || m !== 9 || d < 21 || d > 26) {
    void tick; // satisfy exhaustive deps intent
    return null;
  }
  const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(
    now.getHours()
  ).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return iso;
}
