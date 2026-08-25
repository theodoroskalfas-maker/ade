import { NextResponse } from 'next/server';
import { addUserParty, getUserParties, storageBackend } from '@/lib/storage';
import { DAYS, type DayKey, type Party } from '@/lib/types';

export const dynamic = 'force-dynamic';

const VALID_DAYS = new Set(DAYS.map((d) => d.key));

function safeStr(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function safeUrl(v: unknown): string | null {
  const t = safeStr(v, 500);
  if (!t) return null;
  try {
    const u = new URL(t);
    if (!/^https?:$/.test(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export async function GET() {
  const parties = await getUserParties();
  return NextResponse.json({ parties, backend: storageBackend() });
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  // Passcode check (if configured on the server).
  const required = process.env.ADD_PASSCODE;
  if (required) {
    if (body?.passcode !== required) {
      return NextResponse.json({ error: 'Wrong or missing passcode.' }, { status: 401 });
    }
  }

  const name = safeStr(body?.name, 140);
  if (!name) {
    return NextResponse.json({ error: 'Party name is required.' }, { status: 400 });
  }
  const day = typeof body?.day === 'string' && VALID_DAYS.has(body.day as DayKey)
    ? (body.day as DayKey)
    : null;
  if (!day) {
    return NextResponse.json({ error: 'Invalid day.' }, { status: 400 });
  }

  const dayLabel = DAYS.find((d) => d.key === day)!;
  const party: Party = {
    id: `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    day,
    dayLabel: `${dayLabel.short} ${dayLabel.date.replace('Oct ', '')}`,
    name,
    venue: safeStr(body?.venue, 140),
    artists: safeStr(body?.artists, 1000),
    ticketUrl: safeUrl(body?.ticketUrl),
    free: !!body?.free,
    source: 'user',
    addedAt: new Date().toISOString(),
  };

  const all = await addUserParty(party);
  return NextResponse.json({ ok: true, party, count: all.length });
}
