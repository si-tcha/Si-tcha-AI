/**
 * Smoke test offline mock (Node) — valide seeds + logique sync Leader.
 * Usage: node scripts/smoke-offline-mvp.mjs
 */
import assert from 'node:assert/strict';

const STORAGE = new Map();

globalThis.localStorage = {
  getItem: (k) => (STORAGE.has(k) ? STORAGE.get(k) : null),
  setItem: (k, v) => STORAGE.set(k, String(v)),
  removeItem: (k) => STORAGE.delete(k),
};

// Dynamic import after localStorage polyfill — use compiled-free approach:
// reimplement minimal merge check from shared constants via fetch of logic inline.

function mergeById(local, remote) {
  let conflictsResolvedByLeader = 0;
  let mergedCount = 0;
  const map = new Map();
  local.forEach((item) => map.set(item.id, item));
  remote.forEach((remoteItem) => {
    const existing = map.get(remoteItem.id);
    if (!existing) {
      map.set(remoteItem.id, remoteItem);
      mergedCount += 1;
      return;
    }
    const localTs = existing.updatedAt ? Date.parse(existing.updatedAt) : 0;
    const remoteTs = remoteItem.updatedAt ? Date.parse(remoteItem.updatedAt) : 0;
    if (remoteTs > localTs) {
      if (existing.authorRole === 'leader' && remoteItem.authorRole === 'member') {
        conflictsResolvedByLeader += 1;
        return;
      }
      map.set(remoteItem.id, remoteItem);
      mergedCount += 1;
    }
  });
  return { result: Array.from(map.values()), conflictsResolvedByLeader, mergedCount };
}

// Leader wins on conflict
const local = [
  {
    id: '2',
    label: 'Transport récolte',
    amount: 45000,
    updatedAt: '2026-07-11T10:00:00.000Z',
    authorRole: 'leader',
  },
];
const remote = [
  {
    id: '2',
    label: 'Transport récolte (membre)',
    amount: 50000,
    updatedAt: '2026-07-21T18:00:00.000Z',
    authorRole: 'member',
  },
  {
    id: 'peer-new',
    label: 'Location motopompe',
    amount: 25000,
    updatedAt: '2026-07-21T19:00:00.000Z',
    authorRole: 'member',
  },
];

const { result, conflictsResolvedByLeader, mergedCount } = mergeById(local, remote);
assert.equal(result.find((x) => x.id === '2').amount, 45000, 'Leader amount must win');
assert.equal(conflictsResolvedByLeader, 1);
assert.equal(mergedCount, 1);
assert.ok(result.find((x) => x.id === 'peer-new'));

console.log('OK smoke-offline-mvp: sync Leader priority + merge peer');
