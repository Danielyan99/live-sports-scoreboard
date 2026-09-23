import type { Match } from '@scoreboard/shared';

export function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    league: 'PL',
    home: { id: 'h', name: 'Arsenal FC', shortName: 'Arsenal', tla: 'ARS' },
    away: { id: 'a', name: 'Chelsea FC', shortName: 'Chelsea', tla: 'CHE' },
    score: { home: 0, away: 0 },
    status: 'LIVE',
    minute: 10,
    kickoff: '2026-09-23T19:00:00.000Z',
    events: [],
    version: 1,
    source: 'demo',
    updatedAt: '2026-09-23T19:10:00.000Z',
    ...overrides,
  };
}
