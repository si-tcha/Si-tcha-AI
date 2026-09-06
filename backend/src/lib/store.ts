import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { AppData } from '../domain/types.js';
import { seedData } from '../data/seed.js';

const dataFile = resolve(process.cwd(), process.env.DATA_FILE ?? 'data/sitcha.local.json');

let cache: AppData | null = null;

async function persist(data: AppData) {
  await mkdir(dirname(dataFile), { recursive: true });
  await writeFile(dataFile, JSON.stringify(data, null, 2), 'utf8');
}

export async function readStore(): Promise<AppData> {
  if (cache) return cache;

  try {
    const raw = await readFile(dataFile, 'utf8');
    cache = JSON.parse(raw) as AppData;
    return cache;
  } catch {
    cache = structuredClone(seedData);
    await persist(cache);
    return cache;
  }
}

export async function updateStore(mutator: (data: AppData) => void | AppData): Promise<AppData> {
  const current = await readStore();
  const next = mutator(current) ?? current;
  cache = next;
  await persist(next);
  return next;
}

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizePhone(phone: string) {
  return phone.replace(/\s+/g, '').trim();
}
