import { beforeEach, describe, expect, it } from 'vitest';
import { makeMatch } from '../test/factory';
import { initialState, useMatchStore } from './matchStore';

const store = () => useMatchStore.getState();
const snapshot = (matches: ReturnType<typeof makeMatch>[], extra = {}) => ({
  scope: 'leagues' as const,
  matches,
  source: 'demo' as const,
  serverTime: new Date().toISOString(),
  ...extra,
});

describe('matchStore', () => {
  beforeEach(() => useMatchStore.setState(initialState));

  it('applies the next version of a patch', () => {
    store().applySnapshot(snapshot([makeMatch({ version: 3 })]));

    const result = store().applyPatch({
      matchId: 'm1',
      league: 'PL',
      version: 4,
      changes: { score: { home: 1, away: 0 }, minute: 11 },
      newEvents: [{ id: 'g1', type: 'GOAL', minute: 11, team: 'home' }],
    });

    expect(result).toBe('applied');
    expect(store().matches.m1).toMatchObject({ version: 4, score: { home: 1, away: 0 }, minute: 11 });
    expect(store().matches.m1.events).toHaveLength(1);
  });

  it('detects a version gap and leaves state untouched', () => {
    store().applySnapshot(snapshot([makeMatch({ version: 3 })]));
    const result = store().applyPatch({
      matchId: 'm1',
      league: 'PL',
      version: 5,
      changes: { minute: 12 },
      newEvents: [],
    });

    expect(result).toBe('gap');
    expect(store().matches.m1.version).toBe(3);
  });

  it('ignores stale patches and patches for unknown matches', () => {
    store().applySnapshot(snapshot([makeMatch({ version: 3 })]));
    expect(store().applyPatch({ matchId: 'm1', league: 'PL', version: 3, changes: {}, newEvents: [] })).toBe('stale');
    expect(store().applyPatch({ matchId: 'nope', league: 'PL', version: 1, changes: {}, newEvents: [] })).toBe(
      'unknown',
    );
  });

  it('replaces the list on a league snapshot but keeps the watched match', () => {
    store().applySnapshot(snapshot([makeMatch({ id: 'a' }), makeMatch({ id: 'b', league: 'PD' })]));
    store().setWatchedMatch('b');
    store().applySnapshot(snapshot([makeMatch({ id: 'c' })]));

    expect(Object.keys(store().matches).sort()).toEqual(['b', 'c']);
  });

  it('never moves a match backwards when a snapshot races a patch', () => {
    store().applySnapshot(snapshot([makeMatch({ version: 5, minute: 50 })]));
    store().applySnapshot(snapshot([makeMatch({ version: 4, minute: 49 })], { scope: 'matches' }));
    expect(store().matches.m1).toMatchObject({ version: 5, minute: 50 });
  });

  it('marks requested ids missing from a resync as gone', () => {
    store().applySnapshot(snapshot([makeMatch({ id: 'a' }), makeMatch({ id: 'b' })]));
    store().applySnapshot(
      snapshot([makeMatch({ id: 'a', version: 2 })], { scope: 'matches', requestedIds: ['a', 'b'] }),
    );

    expect(store().matches.b).toBeUndefined();
    expect(store().missing.b).toBe(true);
    expect(store().matches.a.version).toBe(2);
  });
});
