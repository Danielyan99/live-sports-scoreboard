import type { Match, MatchStats } from '@scoreboard/shared';
import { makeMatch } from '../test-utils/match.factory';
import { diffMatches, isEmptyDiff } from './diff-engine';

const NOW = new Date('2026-09-23T20:00:00.000Z');
const toMap = (...matches: Match[]) => new Map(matches.map((m) => [m.id, m]));

const stats = (homeShots: number): MatchStats => ({
  home: { possession: 55, shots: homeShots, shotsOnTarget: 2, corners: 3, fouls: 5 },
  away: { possession: 45, shots: 4, shotsOnTarget: 1, corners: 1, fouls: 7 },
});

describe('diffMatches', () => {
  it('produces an empty diff when nothing changed', () => {
    const m = makeMatch({ version: 7, stats: stats(5) });
    const diff = diffMatches(toMap(m), [{ ...m, version: 0, stats: stats(5) }], NOW);

    expect(isEmptyDiff(diff)).toBe(true);
    // Unchanged matches keep their identity and version.
    expect(diff.next.get(m.id)).toBe(m);
  });

  it('ignores provider-supplied versions and timestamps', () => {
    const m = makeMatch({ version: 3 });
    const diff = diffMatches(toMap(m), [{ ...m, version: 99, updatedAt: 'whatever' }], NOW);
    expect(isEmptyDiff(diff)).toBe(true);
  });

  it('emits a patch with only the score when a goal is scored', () => {
    const m = makeMatch({ version: 4 });
    const diff = diffMatches(toMap(m), [{ ...m, score: { home: 1, away: 0 } }], NOW);

    expect(diff.patches).toEqual([
      { matchId: m.id, league: 'PL', version: 5, changes: { score: { home: 1, away: 0 } }, newEvents: [] },
    ]);
    expect(diff.next.get(m.id)).toMatchObject({
      version: 5,
      score: { home: 1, away: 0 },
      updatedAt: NOW.toISOString(),
    });
  });

  it('combines several field changes into one patch and one version bump', () => {
    const m = makeMatch({ version: 1, minute: 45, status: 'LIVE' });
    const diff = diffMatches(toMap(m), [{ ...m, minute: 46, status: 'PAUSED', stats: stats(3) }], NOW);

    expect(diff.patches).toHaveLength(1);
    expect(diff.patches[0].version).toBe(2);
    expect(diff.patches[0].changes).toEqual({ minute: 46, status: 'PAUSED', stats: stats(3) });
  });

  it('detects a stats change by value, not by reference', () => {
    const m = makeMatch({ stats: stats(5) });
    expect(diffMatches(toMap(m), [{ ...m, stats: stats(5) }], NOW).patches).toHaveLength(0);
    expect(diffMatches(toMap(m), [{ ...m, stats: stats(6) }], NOW).patches[0].changes).toEqual({ stats: stats(6) });
  });

  it('sends only events the client has not seen yet', () => {
    const kickoff = { id: 'e1', type: 'KICKOFF' as const, minute: 0 };
    const goal = { id: 'e2', type: 'GOAL' as const, minute: 12, team: 'home' as const, player: 'Saka' };
    const m = makeMatch({ events: [kickoff] });

    const diff = diffMatches(toMap(m), [{ ...m, events: [kickoff, goal], score: { home: 1, away: 0 } }], NOW);

    expect(diff.patches[0].newEvents).toEqual([goal]);
    expect(diff.next.get(m.id)!.events).toEqual([kickoff, goal]);
  });

  it('reports new matches as added with version 1', () => {
    const fresh = makeMatch({ version: 0 });
    const diff = diffMatches(new Map(), [fresh], NOW);

    expect(diff.added).toEqual([{ ...fresh, version: 1, updatedAt: NOW.toISOString() }]);
    expect(diff.patches).toHaveLength(0);
  });

  it('reports matches missing from the feed as removed', () => {
    const stays = makeMatch();
    const goes = makeMatch();
    const diff = diffMatches(toMap(stays, goes), [stays], NOW);

    expect(diff.removed).toEqual([goes]);
    expect(diff.next.has(goes.id)).toBe(false);
  });

  it('handles added, removed and patched matches in one pass', () => {
    const patched = makeMatch();
    const removed = makeMatch();
    const added = makeMatch();
    const diff = diffMatches(toMap(patched, removed), [{ ...patched, minute: 11 }, added], NOW);

    expect(diff.added.map((m) => m.id)).toEqual([added.id]);
    expect(diff.removed.map((m) => m.id)).toEqual([removed.id]);
    expect(diff.patches.map((p) => p.matchId)).toEqual([patched.id]);
    expect([...diff.next.keys()].sort()).toEqual([patched.id, added.id].sort());
  });

  it('sends only the new momentum minutes as an append', () => {
    const m = makeMatch({ momentum: [10, -20] });
    const diff = diffMatches(toMap(m), [{ ...m, momentum: [10, -20, 35] }], NOW);

    expect(diff.patches[0]).toMatchObject({ changes: {}, momentumAppend: [35] });
    expect(diff.next.get(m.id)!.momentum).toEqual([10, -20, 35]);
  });

  it('does not patch when momentum is unchanged', () => {
    const m = makeMatch({ momentum: [10, -20] });
    expect(isEmptyDiff(diffMatches(toMap(m), [{ ...m, momentum: [10, -20] }], NOW))).toBe(true);
  });

  it('replaces momentum wholesale if history was rewritten', () => {
    const m = makeMatch({ momentum: [10, -20] });
    const diff = diffMatches(toMap(m), [{ ...m, momentum: [5, -20, 30] }], NOW);

    expect(diff.patches[0].changes.momentum).toEqual([5, -20, 30]);
    expect(diff.patches[0].momentumAppend).toBeUndefined();
  });

  it('does not mutate the previous state', () => {
    const m = makeMatch();
    const prev = toMap(m);
    const snapshot = JSON.stringify([...prev]);
    diffMatches(prev, [{ ...m, score: { home: 2, away: 2 } }], NOW);
    expect(JSON.stringify([...prev])).toBe(snapshot);
  });
});
