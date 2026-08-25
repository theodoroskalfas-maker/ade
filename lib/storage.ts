// Storage abstraction for user-added parties.
// Uses Vercel KV in production (when KV_REST_API_URL is set).
// Falls back to a JSON file on disk for local dev — no setup required.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Party } from './types';

const KEY = 'user-parties';
const useKV = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

// ---- File fallback (dev) ----
const FILE_PATH = path.join(process.cwd(), '.data', 'user-parties.json');

async function readFromFile(): Promise<Party[]> {
  try {
    const raw = await fs.readFile(FILE_PATH, 'utf8');
    return JSON.parse(raw) as Party[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeToFile(parties: Party[]): Promise<void> {
  await fs.mkdir(path.dirname(FILE_PATH), { recursive: true });
  await fs.writeFile(FILE_PATH, JSON.stringify(parties, null, 2));
}

// ---- KV (prod) ----
async function readFromKV(): Promise<Party[]> {
  const { kv } = await import('@vercel/kv');
  const parties = (await kv.get<Party[]>(KEY)) ?? [];
  return parties;
}

async function writeToKV(parties: Party[]): Promise<void> {
  const { kv } = await import('@vercel/kv');
  await kv.set(KEY, parties);
}

// ---- Public API ----
export async function getUserParties(): Promise<Party[]> {
  return useKV ? readFromKV() : readFromFile();
}

export async function addUserParty(party: Party): Promise<Party[]> {
  const current = await getUserParties();
  const next = [party, ...current];
  if (useKV) await writeToKV(next);
  else await writeToFile(next);
  return next;
}

export async function deleteUserParty(id: string): Promise<Party[]> {
  const current = await getUserParties();
  const next = current.filter((p) => p.id !== id);
  if (useKV) await writeToKV(next);
  else await writeToFile(next);
  return next;
}

export function storageBackend(): 'kv' | 'file' {
  return useKV ? 'kv' : 'file';
}
