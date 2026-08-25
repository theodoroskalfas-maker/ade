'use client';

import { useCallback, useEffect, useState } from 'react';

// LocalStorage-backed favorites — per-device, no account needed.
// We store a plain string[] of party ids and expose set-like helpers.

const KEY = 'ade2026:favorites';

function readFromStorage(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

function writeToStorage(ids: Set<string>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    // ignore quota / private-mode errors
  }
}

export function useFavorites() {
  // Start empty so SSR + first client render agree; hydrate from storage after mount.
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setIds(readFromStorage());
    setReady(true);

    // Sync across tabs — nice for laptop + phone-mirror workflow.
    function onStorage(e: StorageEvent) {
      if (e.key === KEY) setIds(readFromStorage());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeToStorage(next);
      return next;
    });
  }, []);

  const isFav = useCallback((id: string) => ids.has(id), [ids]);

  return { ids, isFav, toggle, ready, count: ids.size };
}
