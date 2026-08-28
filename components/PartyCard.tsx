'use client';

import type { Party } from '@/lib/types';

type Props = {
  party: Party;
  index: number; // 1-based position within the current view (day / search / faves)
  isFav: boolean;
  onToggleFav: (id: string) => void;
  onFilter: (query: string) => void;
};

export default function PartyCard({ party, index, isFav, onToggleFav, onFilter }: Props) {
  const artistTokens = party.artists ? tokenizeArtists(party.artists) : [];

  return (
    <article
      className={
        'relative rounded-2xl border p-4 shadow-sm transition ' +
        (party.free
          ? 'border-accent2/40 bg-accent2/[0.06]'
          : 'border-line bg-panel hover:border-muted/40')
      }
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="pr-1 text-base font-semibold leading-snug">
          <span className="mr-1 text-muted/70 tabular-nums">{index}.</span>
          {party.name}
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {party.free && (
            <span className="rounded-full bg-accent2/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent2">
              Free
            </span>
          )}
          {party.source === 'user' && (
            <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
              Added
            </span>
          )}
          <button
            type="button"
            onClick={() => onToggleFav(party.id)}
            aria-pressed={isFav}
            aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
            className={
              'ml-0.5 grid h-8 w-8 place-items-center rounded-full border text-base transition active:scale-90 ' +
              (isFav
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-line bg-panel2 text-muted hover:text-white')
            }
          >
            {isFav ? '♥' : '♡'}
          </button>
        </div>
      </div>

      {party.venue && (
        <p className="mt-1 text-sm text-muted">
          <span className="text-muted/70">📍 </span>
          <button
            type="button"
            onClick={() => onFilter(party.venue!)}
            className="text-left underline decoration-muted/40 decoration-dotted underline-offset-4 hover:text-white hover:decoration-white/60"
          >
            {party.venue}
          </button>
        </p>
      )}

      {artistTokens.length > 0 && (
        <p className="mt-2 text-xs leading-relaxed text-muted">
          <span className="font-semibold text-muted/70">Line-up: </span>
          {artistTokens.map((t, i) => (
            <span key={`${t.query}-${i}`}>
              <button
                type="button"
                onClick={() => onFilter(t.query)}
                className="underline decoration-muted/30 decoration-dotted underline-offset-2 hover:text-white hover:decoration-white/70"
                title={`Show all parties with ${t.query}`}
              >
                {t.display}
              </button>
              {i < artistTokens.length - 1 ? ', ' : ''}
            </span>
          ))}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {party.ticketUrl && (
          <a
            href={party.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel2 px-3 py-1.5 text-xs font-semibold text-white/90 active:scale-95"
          >
            <span>Tickets & info</span>
            <span aria-hidden>↗</span>
          </a>
        )}
        <a
          href={party.ticketswapUrl ?? ticketswapSearchUrl(party.name)}
          target="_blank"
          rel="noopener noreferrer"
          title={
            party.ticketswapUrl
              ? 'Open this event on TicketSwap (resale)'
              : 'Search for resale tickets on TicketSwap'
          }
          className={
            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold active:scale-95 ' +
            (party.ticketswapUrl
              ? 'border-accent/60 bg-accent/15 text-white'
              : 'border-line bg-panel2 text-white/90')
          }
        >
          <span>TicketSwap{party.ticketswapUrl ? '' : ' (search)'}</span>
          <span aria-hidden>↗</span>
        </a>
        {party.venue && isMappable(party.venue) && (
          <a
            href={mapUrl(party.venue)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel2 px-3 py-1.5 text-xs font-semibold text-white/90 active:scale-95"
          >
            <span>Map</span>
            <span aria-hidden>↗</span>
          </a>
        )}
      </div>
    </article>
  );
}

// Fallback: TicketSwap's own search page with the party name pre-filled.
// Used only when we couldn't resolve to a direct event URL via the sitemap
// matcher (see scripts/refresh-ticketswap.mjs).
function ticketswapSearchUrl(name: string): string {
  const cleaned = name.replace(/\s*\([^)]*\)\s*$/g, '').trim() || name;
  return `https://www.ticketswap.com/search?query=${encodeURIComponent(cleaned)}`;
}

// All parties are in Amsterdam — append it to the query for a cleaner Maps hit.
function mapUrl(venue: string): string {
  const q = encodeURIComponent(`${venue} Amsterdam`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

// Skip pseudo-venues we don't want to send to Maps.
function isMappable(venue: string): boolean {
  const v = venue.trim().toLowerCase();
  if (!v) return false;
  if (v === 'tba' || v === 'tbd' || v.startsWith('tba ') || v.endsWith(' tba')) return false;
  if (v.startsWith('on a boat') || v.startsWith('secret')) return false;
  return true;
}

// Break a line-up string into individual, clickable tokens.
// Split points: comma, ampersand, " and ", " b2b ", " vs ", " x " (with spaces on both sides).
// For the click *query* we strip trailing parentheticals like "(DE)", "(live)" so
// "JakoJako (DE)" also matches parties that list a plain "JakoJako".
function tokenizeArtists(raw: string): { display: string; query: string }[] {
  return raw
    .split(/,|&|\s+b2b\s+|\s+and\s+|\s+vs\s+|\s+x\s+/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && p.length <= 80)
    .map((display) => {
      const cleaned = display.replace(/\s*\([^)]*\)\s*$/g, '').trim();
      return { display, query: cleaned || display };
    });
}
