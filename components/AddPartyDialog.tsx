'use client';

import { useState } from 'react';
import { DAYS, type DayKey } from '@/lib/types';

type Props = {
  defaultDay: DayKey;
  onClose: () => void;
  onAdded: () => void;
};

export default function AddPartyDialog({ defaultDay, onClose, onAdded }: Props) {
  const [name, setName] = useState('');
  const [day, setDay] = useState<DayKey>(defaultDay);
  const [venue, setVenue] = useState('');
  const [artists, setArtists] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');
  const [free, setFree] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) {
      setErr('Party name is required.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/parties', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          day,
          venue: venue.trim() || null,
          artists: artists.trim() || null,
          ticketUrl: ticketUrl.trim() || null,
          free,
          passcode: passcode || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      onAdded();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-panel p-5 pb-safe sm:rounded-3xl sm:pb-5"
        style={{ maxHeight: '90vh' }}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Add a party</h2>
            <p className="text-xs text-muted">
              Shared with everyone who visits — please double-check details.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full border border-line bg-panel2 px-2.5 py-0.5 text-lg leading-none text-muted"
          >
            ×
          </button>
        </div>

        <div className="grid gap-3">
          <Field label="Party name *">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={140}
              className="w-full rounded-xl border border-line bg-panel2 px-3 py-2 text-sm focus:border-accent focus:outline-none"
              placeholder="e.g. Late Night at Shelter"
            />
          </Field>

          <Field label="Day">
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {DAYS.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setDay(d.key)}
                  className={
                    'shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold ' +
                    (day === d.key
                      ? 'border-accent bg-accent/20 text-white'
                      : 'border-line bg-panel2 text-muted')
                  }
                >
                  {d.short} {d.date.replace('Oct ', '')}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Venue">
            <input
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              maxLength={140}
              className="w-full rounded-xl border border-line bg-panel2 px-3 py-2 text-sm focus:border-accent focus:outline-none"
              placeholder="e.g. Shelter"
            />
          </Field>

          <Field label="Line-up / artists">
            <textarea
              value={artists}
              onChange={(e) => setArtists(e.target.value)}
              rows={2}
              maxLength={1000}
              className="w-full rounded-xl border border-line bg-panel2 px-3 py-2 text-sm focus:border-accent focus:outline-none"
              placeholder="Comma-separated names"
            />
          </Field>

          <Field label="Ticket / info URL">
            <input
              value={ticketUrl}
              onChange={(e) => setTicketUrl(e.target.value)}
              type="url"
              maxLength={500}
              className="w-full rounded-xl border border-line bg-panel2 px-3 py-2 text-sm focus:border-accent focus:outline-none"
              placeholder="https://…"
            />
          </Field>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={free}
              onChange={(e) => setFree(e.target.checked)}
              className="h-4 w-4 accent-accent2"
            />
            Free party
          </label>

          <Field label="Passcode (leave empty if not required)">
            <input
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              type="password"
              autoComplete="off"
              className="w-full rounded-xl border border-line bg-panel2 px-3 py-2 text-sm focus:border-accent focus:outline-none"
              placeholder=""
            />
          </Field>

          {err && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {err}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-2 w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white shadow-lg shadow-accent/20 active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? 'Adding…' : 'Add party'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">{label}</div>
      {children}
    </label>
  );
}
