import { countedGoals, LEAGUE_CODES } from '@scoreboard/shared';
import { diffMatches } from '../../ingestion/diff-engine';
import { MatchSimulator } from './match-simulator';

const fixedNow = () => new Date('2026-09-23T19:00:00.000Z');
const run = (seed: number, ticks: number) => {
  const sim = new MatchSimulator({ seed, now: fixedNow });
  for (let i = 0; i < ticks; i++) sim.tick();
  return sim.getMatches();
};

describe('MatchSimulator', () => {
  it('is deterministic for a given seed', () => {
    expect(run(42, 50)).toEqual(run(42, 50));
    expect(run(42, 50)).not.toEqual(run(43, 50));
  });

  it('starts with matches in every league at different stages', () => {
    const matches = new MatchSimulator({ seed: 1, now: fixedNow }).getMatches();
    for (const league of LEAGUE_CODES) {
      const statuses = new Set(matches.filter((m) => m.league === league).map((m) => m.status));
      expect(statuses.size).toBeGreaterThan(1);
    }
    expect(matches.every((m) => m.source === 'demo')).toBe(true);
  });

  it('never schedules a team twice in the same round', () => {
    for (const league of LEAGUE_CODES) {
      const teamIds = run(7, 300)
        .filter((m) => m.league === league)
        .flatMap((m) => [m.home.id, m.away.id]);
      expect(new Set(teamIds).size).toBe(teamIds.length);
    }
  });

  it('keeps scores consistent with goals not overturned by VAR, and possession at 100%', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const m of run(seed, 120)) {
        const goals = countedGoals(m.events);
        expect(goals.filter((e) => e.team === 'home')).toHaveLength(m.score.home);
        expect(goals.filter((e) => e.team === 'away')).toHaveLength(m.score.away);
        expect(m.stats!.home.possession + m.stats!.away.possession).toBe(100);
      }
    }
  });

  it('only lets VAR overturn goals of the same team', () => {
    const matches = Array.from({ length: 30 }, (_, i) => run(i + 1, 150)).flat();
    const decisions = matches.flatMap((m) => m.events.filter((e) => e.type === 'VAR').map((e) => ({ m, e })));
    expect(decisions.length).toBeGreaterThan(0);

    for (const { m, e } of decisions) {
      const goal = m.events.find((g) => g.id === e.refId);
      expect(goal).toMatchObject({ type: 'GOAL', team: e.team });
    }
  });

  it('records one momentum value per minute played, within ±100', () => {
    for (const m of run(3, 60).filter((m) => m.status === 'LIVE')) {
      expect(m.momentum).toHaveLength(m.minute!);
      expect(m.momentum!.every((v) => v >= -100 && v <= 100)).toBe(true);
    }
  });

  it('seeds a consistent league table', () => {
    for (const table of new MatchSimulator({ seed: 8, now: fixedNow }).getTables()) {
      const rows = table.rows;
      expect(rows).toHaveLength(20);
      const sum = (key: 'won' | 'lost' | 'goalsFor' | 'goalsAgainst') => rows.reduce((n, r) => n + r[key], 0);
      expect(sum('won')).toBe(sum('lost'));
      expect(sum('goalsFor')).toBe(sum('goalsAgainst'));
      for (const r of rows) expect(r.points).toBe(r.won * 3 + r.drawn);
    }
  });

  it('adds finished matches to the table', () => {
    const sim = new MatchSimulator({ seed: 4, now: fixedNow });
    const playedBefore = sim
      .getTables()
      .flatMap((t) => t.rows)
      .reduce((n, r) => n + r.played, 0);
    const revisionBefore = sim.tablesRevision;

    for (let i = 0; i < 150; i++) sim.tick();

    const playedAfter = sim
      .getTables()
      .flatMap((t) => t.rows)
      .reduce((n, r) => n + r.played, 0);
    expect(sim.tablesRevision).toBeGreaterThan(revisionBefore);
    // Each finished match adds one game to two teams.
    expect(playedAfter - playedBefore).toBe((sim.tablesRevision - revisionBefore) * 2);
  });

  it('replaces finished matches with new fixtures over time', () => {
    const initialIds = new Set(run(5, 0).map((m) => m.id));
    const laterIds = run(5, 200).map((m) => m.id);
    expect(laterIds.some((id) => !initialIds.has(id))).toBe(true);
  });

  it('produces small incremental diffs tick to tick', () => {
    const sim = new MatchSimulator({ seed: 11, now: fixedNow });
    let state = diffMatches(new Map(), sim.getMatches()).next;
    sim.tick();
    const diff = diffMatches(state, sim.getMatches());
    // Every in-play match moves its clock, so it gets exactly one patch.
    expect(diff.patches.length).toBeGreaterThan(0);
    for (const p of diff.patches) expect(p.version).toBe(2);
    state = diff.next;
    expect(state.size).toBe(sim.getMatches().length);
  });
});
