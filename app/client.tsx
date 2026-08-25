'use client';

import { useMemo, useState } from 'react';
import { DAYS, type DayKey, type Party } from '@/lib/types';
import { useFavorites } from '@/lib/useFavorites';
import PartyCard from '@/components/PartyCard';
import AddPartyDialog from '@/components/AddPartyDialog';

type Props = { parties: Party[] };

// A "view" is what the user is looking at: a specific day, or all favorites,
// or (implicitly, when there's a search query) results across every day.
type View = DayKey | 'faves';

export default function Client({ parties }: Props) {
  const [view, setView] = useState<View>('wed');
  const [q, setQ] = useState('');
  const [freeOnly, setFreeOnly] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const { isFav, toggle, count: favCount } = useFavorites();

  const qTrimmed = q.trim().toLowerCase();
  const searching = qTrimmed.length > 0;

  // Total counts per day (unfiltered) — for the tab pills.
  const dayCounts = useMemo(() => {
    const c: Record<DayKey, number> = { wed: 0, thu: 0, fri: 0, sat: 0, sun: 0, mon: 0 };
    for (const p of parties) c[p.day]++;
    return c;
  }, [parties]);

  // Apply the search + free-only filters first, then decide the scope.
  const filtered = useMemo(() => {
    return parties.filter((p) => {
      if (freeOnly && !p.free) return false;
      if (qTrimmed) {
        const hay = `${p.name} ${p.venue ?? ''} ${p.artists ?? ''}`.toLowerCase();
        if (!hay.includes(qTrimmed)) return false;
      }
      return true;
    });
  }, [parties, qTrimmed, freeOnly]);

  // Scope:
  // - Searching  → show matches from ALL days, grouped by day
  // - Faves      → show only favorited parties (across all days), grouped by day
  // - Otherwise  → show the selected day only
  const groups = useMemo(() => {
    let base = filtered;
    if (!searching && view === 'faves') base = base.filter((p) => isFav(p.id));
    if (!searching && view !== 'faves') base = base.filter((p) => p.day === view);

    const sorted = [...base].sort((a, b) => {
      if (a.source !== b.source) return a.source === 'user' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    // Group by day preserving DAYS order.
    const byDay = new Map<DayKey, Party[]>();
    for (const d of DAYS) byDay.set(d.key, []);
    for (const p of sorted) byDay.get(p.day)!.push(p);
    return DAYS
      .map((d) => ({ day: d, list: byDay.get(d.key)! }))
      .filter((g) => g.list.length > 0);
  }, [filtered, searching, view, isFav]);

  const totalShown = groups.reduce((n, g) => n + g.list.length, 0);
  const showGrouped = searching || view === 'faves';

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-line bg-night/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
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

        {/* Day tabs + Faves */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
          {DAYS.map((d) => {
            const active = !searching && d.key === view;
            return (
              <button
                key={d.key}
                onClick={() => setView(d.key)}
                className={
                  'flex shrink-0 flex-col items-center rounded-2xl border px-4 py-2 text-left transition ' +
                  (active
                    ? 'border-accent bg-accent/10'
                    : 'border-line bg-panel hover:border-muted/50')
                }
              >
                <span className={'text-xs ' + (active ? 'text-accent' : 'text-muted')}>
                  {d.short}
                </span>
                <span className="text-sm font-semibold">{d.date}</span>
                <span className="mt-0.5 text-[10px] text-muted">{dayCounts[d.key]}</span>
              </button>
            );
          })}
          <button
            onClick={() => setView('faves')}
            className={
              'flex shrink-0 flex-col items-center rounded-2xl border px-4 py-2 text-left transition ' +
              (!searching && view === 'faves'
                ? 'border-accent bg-accent/10'
                : 'border-line bg-panel hover:border-muted/50')
            }
          >
            <span
              className={
                'text-xs ' + (!searching && view === 'faves' ? 'text-accent' : 'text-muted')
              }
            >
              ♥
            </span>
            <span className="text-sm font-semibold">Faves</span>
            <span className="mt-0.5 text-[10px] text-muted">{favCount}</span>
          </button>
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-2 px-4 pb-3">
          <div className="relative flex-1">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search all days (e.g. Armin, Shelter…)"
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
        </div>

        {/* Contextual status line */}
        {(searching || view === 'faves') && (
          <div className="px-4 pb-2 text-xs text-muted">
            {searching ? (
              <>
                {totalShown} match{totalShown === 1 ? '' : 'es'} across the week for{' '}
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
        {totalShown === 0 ? (
          <EmptyState searching={searching} isFavesView={view === 'faves' && !searching} />
        ) : showGrouped ? (
          <div className="grid gap-6">
            {groups.map((g) => (
              <section key={g.day.key}>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
                  {g.day.short} · {g.day.date} · {g.list.length}
                </h2>
                <ul className="grid gap-3">
                  {g.list.map((p) => (
                    <li key={p.id}>
                      <PartyCard party={p} isFav={isFav(p.id)} onToggleFav={toggle} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <ul className="grid gap-3">
            {groups[0]!.list.map((p) => (
              <li key={p.id}>
                <PartyCard party={p} isFav={isFav(p.id)} onToggleFav={toggle} />
              </li>
            ))}
          </ul>
        )}
      </main>

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

function EmptyState({ searching, isFavesView }: { searching: boolean; isFavesView: boolean }) {
  return (
    <div className="mt-16 text-center text-muted">
      {searching ? (
        <>
          <p>No parties match that search.</p>
          <p className="mt-1 text-xs">Try a different name, venue, or artist.</p>
        </>
      ) : isFavesView ? (
        <>
          <p>No favorites yet.</p>
          <p className="mt-1 text-xs">Tap the ♡ on a party to save it here.</p>
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
