import seed from '@/data/seed.json';
import { getUserParties } from '@/lib/storage';
import type { Party } from '@/lib/types';
import Client from './client';

export const dynamic = 'force-dynamic'; // always render fresh (user adds show up)

export default async function Home() {
  const userParties = (await getUserParties()) as Party[];
  const all: Party[] = [...(userParties ?? []), ...(seed as Party[])];
  return <Client parties={all} />;
}
