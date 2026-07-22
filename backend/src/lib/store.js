import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { seedData } from '../data/seed';
const dataFile = resolve(process.cwd(), process.env.DATA_FILE ?? 'data/sitcha.local.json');
let cache = null;
async function persist(data) {
    await mkdir(dirname(dataFile), { recursive: true });
    await writeFile(dataFile, JSON.stringify(data, null, 2), 'utf8');
}
export async function readStore() {
    if (cache)
        return cache;
    try {
        const raw = await readFile(dataFile, 'utf8');
        cache = JSON.parse(raw);
        return cache;
    }
    catch {
        cache = structuredClone(seedData);
        await persist(cache);
        return cache;
    }
}
export async function updateStore(mutator) {
    const current = await readStore();
    const next = mutator(current) ?? current;
    cache = next;
    await persist(next);
    return next;
}
export function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
export function normalizePhone(phone) {
    return phone.replace(/\s+/g, '').trim();
}
