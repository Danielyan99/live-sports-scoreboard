import { liveTable, type LeagueTable, type StandingRow, type Team } from '@scoreboard/shared';
import { describe, expect, it } from 'vitest';
import { makeMatch } from '../test/factory';

const team = (id: string, shortName: string): Team => ({ id, name: shortName, shortName, tla: id.toUpperCase() });
const row = (t: Team, points: number, goalsFor = 5, goalsAgainst = 5): StandingRow => ({
  team: t,
  played: 5,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor,
  goalsAgainst,
  points,
});

const ars = team('ars', 'Arsenal');
const che = team('che', 'Chelsea');
const liv = team('liv', 'Liverpool');
const base: LeagueTable = { league: 'PL', rows: [row(liv, 12), row(che, 11), row(ars, 10)] };

describe('liveTable', () => {
  it('ranks the base table when nothing is in play', () => {
    const rows = liveTable(base, []);
    expect(rows.map((r) => [r.team.shortName, r.position, r.basePosition])).toEqual([
      ['Liverpool', 1, 1],
      ['Chelsea', 2, 2],
      ['Arsenal', 3, 3],
    ]);
  });

  it('adds in-play scores on top and reports movement', () => {
    const live = makeMatch({ home: ars, away: liv, score: { home: 2, away: 0 }, status: 'LIVE' });
    const rows = liveTable(base, [live]);

    expect(rows[0]).toMatchObject({ team: { id: 'ars' }, points: 13, position: 1, basePosition: 3, played: 6 });
    expect(rows[0].live).toEqual({ outcome: 'W', matchId: live.id });
    expect(rows.find((r) => r.team.id === 'liv')).toMatchObject({ points: 12, position: 2, live: { outcome: 'L' } });
    const chelsea = rows.find((r) => r.team.id === 'che')!;
    expect(chelsea.position).toBe(3);
    expect(chelsea.live).toBeUndefined();
  });

  it('ignores finished matches (already in the base) and other leagues', () => {
    const finished = makeMatch({ home: ars, away: liv, score: { home: 5, away: 0 }, status: 'FINISHED' });
    const otherLeague = makeMatch({ league: 'PD', home: ars, away: liv, score: { home: 5, away: 0 } });
    expect(liveTable(base, [finished, otherLeague]).map((r) => r.points)).toEqual([12, 11, 10]);
  });

  it('breaks ties on goal difference, then goals scored', () => {
    const tied: LeagueTable = { league: 'PL', rows: [row(ars, 10, 6, 5), row(che, 10, 9, 5), row(liv, 10, 8, 4)] };
    expect(liveTable(tied, []).map((r) => r.team.id)).toEqual(['che', 'liv', 'ars']);
  });
});
