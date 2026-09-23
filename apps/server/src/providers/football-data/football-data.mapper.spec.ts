import type { MatchResult } from '@scoreboard/shared';
import { latestMatchday, mapFdMatch, mapFdResult, type FdMatch } from './football-data.mapper';

const NOW = new Date('2026-09-23T20:00:00.000Z');

const raw = (overrides: Partial<FdMatch> = {}): FdMatch => ({
  id: 501,
  utcDate: '2026-09-23T19:30:00.000Z',
  status: 'IN_PLAY',
  competition: { code: 'PL' },
  homeTeam: { id: 57, name: 'Arsenal FC', shortName: 'Arsenal', tla: 'ARS' },
  awayTeam: { id: 61, name: 'Chelsea FC', shortName: 'Chelsea', tla: 'CHE' },
  score: { fullTime: { home: 0, away: 0 } },
  ...overrides,
});

describe('mapFdMatch', () => {
  it('maps the API resource to the domain model', () => {
    expect(mapFdMatch(raw(), undefined, NOW)).toMatchObject({
      id: 'fd-501',
      league: 'PL',
      home: { id: 'fd-57', tla: 'ARS', shortName: 'Arsenal' },
      status: 'LIVE',
      minute: 30, // estimated from kickoff
      source: 'live',
      events: [],
    });
  });

  it('drops competitions and statuses we do not show', () => {
    expect(mapFdMatch(raw({ competition: { code: 'BL1' } }), undefined, NOW)).toBeNull();
    expect(mapFdMatch(raw({ status: 'POSTPONED' }), undefined, NOW)).toBeNull();
  });

  it('derives goal events from score changes, idempotently', () => {
    const first = mapFdMatch(raw(), undefined, NOW)!;
    const second = mapFdMatch(raw({ score: { fullTime: { home: 2, away: 1 } } }), first, NOW)!;

    expect(second.events.map((e) => e.id)).toEqual(['fd-501-goal-home-1', 'fd-501-goal-home-2', 'fd-501-goal-away-1']);

    const third = mapFdMatch(raw({ score: { fullTime: { home: 2, away: 1 } } }), second, NOW)!;
    expect(third.events).toEqual(second.events);
  });

  it('adds half-time and full-time markers on status transitions', () => {
    const live = mapFdMatch(raw(), undefined, NOW)!;
    const ht = mapFdMatch(raw({ status: 'PAUSED' }), live, NOW)!;
    const ft = mapFdMatch(raw({ status: 'FINISHED' }), ht, NOW)!;

    expect(ht.events.map((e) => e.type)).toEqual(['HT']);
    expect(ft.events.map((e) => e.type)).toEqual(['HT', 'FT']);
  });
});

describe('mapFdResult', () => {
  it('maps a finished match with half-time score and referee', () => {
    const result = mapFdResult(
      raw({
        status: 'FINISHED',
        matchday: 7,
        score: { fullTime: { home: 2, away: 3 }, halfTime: { home: 0, away: 1 } },
        referees: [
          { name: 'Assistant One', type: 'ASSISTANT_REFEREE_N1' },
          { name: 'Main Ref', type: 'REFEREE' },
        ],
      }),
    );

    expect(result).toMatchObject({
      id: 'fd-501',
      league: 'PL',
      matchday: 7,
      score: { home: 2, away: 3 },
      halfTime: { home: 0, away: 1 },
      referee: 'Main Ref',
    });
  });

  it('ignores matches that are not finished', () => {
    expect(mapFdResult(raw({ status: 'IN_PLAY' }))).toBeNull();
  });
});

describe('latestMatchday', () => {
  const result = (id: string, matchday: number, kickoff: string) => ({ id, matchday, kickoff }) as MatchResult;

  it('returns the highest matchday, sorted by kickoff', () => {
    const latest = latestMatchday([
      result('a', 6, '2026-09-13T14:00:00Z'),
      result('c', 7, '2026-09-20T19:00:00Z'),
      result('b', 7, '2026-09-19T14:00:00Z'),
    ]);
    expect(latest?.matchday).toBe(7);
    expect(latest?.results.map((r) => r.id)).toEqual(['b', 'c']);
  });

  it('is not taken over by a postponed game from an older round played later', () => {
    const latest = latestMatchday([
      result('rearranged-md3', 3, '2026-09-23T19:00:00Z'),
      result('md7', 7, '2026-09-20T19:00:00Z'),
    ]);
    expect(latest?.matchday).toBe(7);
    expect(latest?.results.map((r) => r.id)).toEqual(['md7']);
  });

  it('returns null with no results', () => {
    expect(latestMatchday([])).toBeNull();
  });
});
