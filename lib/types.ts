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

export const DAYS: { key: DayKey; label: string; short: string; date: string }[] = [
  { key: 'wed', label: 'Wednesday', short: 'Wed', date: 'Oct 21' },
  { key: 'thu', label: 'Thursday', short: 'Thu', date: 'Oct 22' },
  { key: 'fri', label: 'Friday', short: 'Fri', date: 'Oct 23' },
  { key: 'sat', label: 'Saturday', short: 'Sat', date: 'Oct 24' },
  { key: 'sun', label: 'Sunday', short: 'Sun', date: 'Oct 25' },
  { key: 'mon', label: 'Monday', short: 'Mon', date: 'Oct 26' },
];
