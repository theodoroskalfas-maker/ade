export type DayKey = 'wed' | 'thu' | 'fri' | 'sat' | 'sun' | 'mon';

export type Party = {
  id: string;
  day: DayKey;
  dayLabel: string;
  name: string;
  venue: string | null;
  artists: string | null;
  ticketUrl: string | null;
  // Direct TicketSwap resale link when the offline matcher found a confident
  // sitemap match. When absent, the UI falls back to a TicketSwap search link.
  ticketswapUrl?: string;
  free: boolean;
  source: 'sheet' | 'user';
  addedAt?: string;
};

export const DAYS: { key: DayKey; label: string; short: string; date: string; iso: string }[] = [
  { key: 'wed', label: 'Wednesday', short: 'Wed', date: 'Oct 21', iso: '2026-10-21' },
  { key: 'thu', label: 'Thursday', short: 'Thu', date: 'Oct 22', iso: '2026-10-22' },
  { key: 'fri', label: 'Friday', short: 'Fri', date: 'Oct 23', iso: '2026-10-23' },
  { key: 'sat', label: 'Saturday', short: 'Sat', date: 'Oct 24', iso: '2026-10-24' },
  { key: 'sun', label: 'Sunday', short: 'Sun', date: 'Oct 25', iso: '2026-10-25' },
  { key: 'mon', label: 'Monday', short: 'Mon', date: 'Oct 26', iso: '2026-10-26' },
];

// ---- Timetables ----

export type TimetableSlot = {
  start: string; // "HH:MM" — 24h local time
  end: string;   // "HH:MM"
  artist: string;
};

export type TimetableRoom = {
  name: string;
  slots: TimetableSlot[];
};

export type Timetable = {
  id: string;
  name: string;
  venue: string;
  day: DayKey;
  date: string;      // "YYYY-MM-DD"
  // Human-readable overall time window ("22:00-06:00"). Useful when per-slot
  // times aren't known yet (then rooms[] is empty and lineup[] has the A-Z names).
  window?: string;
  rooms: TimetableRoom[];
  lineup?: string[]; // fallback when the organiser only published an unordered A-Z list
  ticketUrl?: string;
  note?: string;
};

