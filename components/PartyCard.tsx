'use client';

import type { Party } from '@/lib/types';

type Props = {
  party: Party;
  isFav: boolean;
  onToggleFav: (id: string) => void;
};

export default function PartyCard({ party, isFav, onToggleFav }: Props) {
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
        <h3 className="pr-1 text-base font-semibold leading-snug">{party.name}</h3>
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
          {isMappable(party.venue) ? (
            <a
              href={mapUrl(party.venue)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-muted/40 decoration-dotted underline-offset-4 hover:text-white hover:decoration-white/60"
            >
              {party.venue}
            </a>
          ) : (
            party.venue
          )}
        </p>
      )}

      {party.artists && (
        <p className="mt-2 text-xs leading-relaxed text-muted">
          <span className="font-semibold text-muted/70">Line-up: </span>
          {party.artists}
        </p>
      )}

      {party.ticketUrl && (
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={party.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel2 px-3 py-1.5 text-xs font-semibold text-white/90 active:scale-95"
          >
            <span>Tickets & info</span>
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
      )}
    </article>
  );
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
