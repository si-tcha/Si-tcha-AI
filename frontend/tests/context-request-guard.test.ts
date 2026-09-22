import { describe, expect, it } from 'vitest';
import {
  ContextBoundValue,
  ContextRequestGuard,
  valueForContext,
} from '../src/utils/contextRequestGuard';

const A = 'seller:301:1';
const B = 'seller:302:2';

describe('ContextRequestGuard — isolation des écrans privés Bloc 4', () => {
  it('masque immédiatement A lorsque authLoading commence', () => {
    const guard = new ContextRequestGuard();
    const state: ContextBoundValue<string[]> = { contextKey: A, value: ['parcelle A'] };
    guard.setContext(A);

    guard.setContext(null);

    expect(valueForContext(state, null, [])).toEqual([]);
  });

  it('ignore loadParcels A si B devient actif avant sa réponse', () => {
    const guard = new ContextRequestGuard();
    guard.setContext(A);
    const requestA = guard.begin(A);

    guard.setContext(B);

    expect(guard.isCurrent(requestA)).toBe(false);
  });

  it('conserve B lorsque sa réponse arrive avant la réponse tardive de A', () => {
    const guard = new ContextRequestGuard();
    let state: ContextBoundValue<string[]> = { contextKey: null, value: [] };
    guard.setContext(A);
    const requestA = guard.begin(A);
    guard.setContext(B);
    const requestB = guard.begin(B);

    if (guard.isCurrent(requestB)) state = { contextKey: B, value: ['parcelle B'] };
    if (guard.isCurrent(requestA)) state = { contextKey: A, value: ['parcelle A'] };

    expect(valueForContext(state, B, [])).toEqual(['parcelle B']);
  });

  it('une seconde requête du même contexte invalide la première sur le même canal', () => {
    const guard = new ContextRequestGuard();
    guard.setContext(B);
    const requestA = guard.begin(B, 'parcels-load');
    const requestB = guard.begin(B, 'parcels-load');

    expect(guard.isCurrent(requestB)).toBe(true);
    expect(guard.isCurrent(requestA)).toBe(false);
  });

  it('une ancienne closure A ne peut pas invalider la requête B courante', () => {
    const guard = new ContextRequestGuard();
    guard.setContext(B);
    const requestB = guard.begin(B, 'parcels-load');

    const staleRequestA = guard.begin(A, 'parcels-load');

    expect(guard.isCurrent(staleRequestA)).toBe(false);
    expect(guard.isCurrent(requestB)).toBe(true);
  });

  it.each(['historique Agronome', 'réponse Gemini', 'création ou modification de parcelle'])(
    'rejette un résultat A tardif pour %s après connexion de B',
    () => {
      const guard = new ContextRequestGuard();
      guard.setContext(A);
      const requestA = guard.begin(A);
      guard.setContext(B);

      expect(guard.isCurrent(requestA)).toBe(false);
    },
  );
});
