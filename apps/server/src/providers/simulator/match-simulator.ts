import type {
  LeagueCode,
  LeagueTable,
  Match,
  MatchEvent,
  MatchEventType,
  StandingRow,
  Team,
  TeamStats,
} from '@scoreboard/shared';
import { LEAGUE_CODES } from '@scoreboard/shared';
import { PLAYER_NAMES, TEAMS } from './teams';

type Phase = 'PRE' | 'H1' | 'HT' | 'H2' | 'FT';
type Side = 'home' | 'away';

interface SimMatch {
  match: Match;
  phase: Phase;
  phaseTicks: number;
  stoppage: number;
  subs: Record<Side, number>;
  eventSeq: number;
  /** A goal under VAR review, decided a minute later. */
  pendingVar?: { goalId: string; side: Side };
}

interface TeamRecord {
  team: Team;
  /** Relative quality, roughly 0.75–1.3. Drives the seeded table and in-match chances. */
  strength: number;
  row: StandingRow;
}

export interface SimulatorOptions {
  /** Seed for the PRNG. The same seed always produces the same matches. */
  seed?: number;
  matchesPerLeague?: number;
  /** Wall-clock length of one simulated minute; only used to derive kickoff times. */
  tickMs?: number;
  /** Rounds already played when the demo starts, so the table has some history. */
  playedRounds?: number;
  now?: () => Date;
}

const PRE_TICKS = 8;
const HALF_TIME_TICKS = 6;
const FULL_TIME_LINGER_TICKS = 25;
/** Total ticks from creation to final whistle, used to stagger initial matches. */
const MATCH_TICKS = PRE_TICKS + 45 + HALF_TIME_TICKS + 45;

const GOAL_KINDS: { detail?: string; weight: number; assisted: boolean }[] = [
  { weight: 50, assisted: true },
  { detail: 'Header', weight: 20, assisted: true },
  { detail: 'Long range', weight: 12, assisted: true },
  { detail: 'Penalty', weight: 10, assisted: false },
  { detail: 'Free kick', weight: 8, assisted: false },
];
const VAR_REASONS = ['Offside', 'Handball', 'Foul in the build-up'];

/**
 * A deterministic football simulator for the demo feed. Each `tick()` advances
 * every match by one minute. Finished matches linger, then are replaced by new
 * fixtures, so the feed never runs dry. It also keeps a league table that
 * updates when a match finishes.
 *
 * The simulator knows nothing about diffing or sockets: it produces full match
 * state, exactly like the real API provider, and goes through the same pipeline.
 */
export class MatchSimulator {
  private readonly rng: () => number;
  private readonly runId: string;
  private readonly tickMs: number;
  private readonly now: () => Date;
  private readonly records: Record<LeagueCode, Map<string, TeamRecord>>;
  private sims: SimMatch[] = [];
  private fixtureSeq = 0;
  private tableRevision = 0;

  constructor(options: SimulatorOptions = {}) {
    const seed = options.seed ?? Date.now();
    this.rng = mulberry32(seed);
    this.runId = (seed >>> 0).toString(36);
    this.tickMs = options.tickMs ?? 3000;
    this.now = options.now ?? (() => new Date());
    this.records = this.seedTables(options.playedRounds ?? 6);

    const perLeague = options.matchesPerLeague ?? 4;
    LEAGUE_CODES.forEach((league, leagueIndex) => {
      for (let i = 0; i < perLeague; i++) {
        // Spread matches across the whole match lifecycle so the demo looks busy immediately.
        const progress = (i + leagueIndex * 0.5) / perLeague;
        const offset = Math.floor(progress * (MATCH_TICKS + FULL_TIME_LINGER_TICKS));
        const sim = this.createFixture(league, offset);
        for (let t = 0; t < offset; t++) this.step(sim);
        this.sims.push(sim);
      }
    });
  }

  tick(): void {
    for (const sim of this.sims) this.step(sim);

    this.sims = this.sims.map((sim) =>
      sim.phase === 'FT' && sim.phaseTicks >= FULL_TIME_LINGER_TICKS ? this.createFixture(sim.match.league, 0) : sim,
    );
  }

  /** Returns a deep copy so callers can't mutate simulator state. */
  getMatches(): Match[] {
    return this.sims.map((s) => structuredClone(s.match));
  }

  /** Bumped whenever a table changes, so callers can skip re-sending identical tables. */
  get tablesRevision(): number {
    return this.tableRevision;
  }

  /** Tables of finished matches only; clients add in-play scores on top. */
  getTables(): LeagueTable[] {
    return LEAGUE_CODES.map((league) => ({
      league,
      rows: [...this.records[league].values()].map((r) => ({ ...r.row })),
    }));
  }

  // ---------------------------------------------------------------- table

  /** Plays a few random rounds between all teams so the demo table starts with a believable spread. */
  private seedTables(rounds: number): Record<LeagueCode, Map<string, TeamRecord>> {
    const records = {} as Record<LeagueCode, Map<string, TeamRecord>>;

    for (const league of LEAGUE_CODES) {
      const map = new Map<string, TeamRecord>();
      for (const team of TEAMS[league]) {
        map.set(team.id, {
          team,
          strength: 0.75 + this.rng() * 0.55,
          row: { team, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 },
        });
      }

      for (let round = 0; round < rounds; round++) {
        const order = this.shuffle([...map.values()]);
        for (let i = 0; i + 1 < order.length; i += 2) {
          const [home, away] = [order[i], order[i + 1]];
          const homeGoals = this.poisson(1.45 * (home.strength / away.strength));
          const awayGoals = this.poisson(1.15 * (away.strength / home.strength));
          recordResult(home.row, homeGoals, awayGoals);
          recordResult(away.row, awayGoals, homeGoals);
        }
      }
      records[league] = map;
    }
    return records;
  }

  private finishMatch(sim: SimMatch): void {
    const { league, home, away, score } = sim.match;
    const table = this.records[league];
    recordResult(table.get(home.id)!.row, score.home, score.away);
    recordResult(table.get(away.id)!.row, score.away, score.home);
    this.tableRevision += 1;
  }

  // -------------------------------------------------------------- matches

  private createFixture(league: LeagueCode, alreadyElapsedTicks: number): SimMatch {
    const busy = new Set(
      this.sims.filter((s) => s.match.league === league).flatMap((s) => [s.match.home.id, s.match.away.id]),
    );
    const available = TEAMS[league].filter((t) => !busy.has(t.id));
    const home = this.pick(available);
    const away = this.pick(available.filter((t) => t.id !== home.id));

    this.fixtureSeq += 1;
    const kickoff = new Date(this.now().getTime() + (PRE_TICKS - alreadyElapsedTicks) * this.tickMs);

    return {
      match: {
        id: `demo-${this.runId}-${this.fixtureSeq}`,
        league,
        home,
        away,
        score: { home: 0, away: 0 },
        status: 'SCHEDULED',
        minute: null,
        kickoff: kickoff.toISOString(),
        events: [],
        stats: { home: emptyStats(50), away: emptyStats(50) },
        momentum: [],
        version: 0,
        source: 'demo',
        updatedAt: this.now().toISOString(),
      },
      phase: 'PRE',
      phaseTicks: 0,
      stoppage: this.int(1, 5),
      subs: { home: 0, away: 0 },
      eventSeq: 0,
    };
  }

  private step(sim: SimMatch): void {
    const m = sim.match;
    sim.phaseTicks += 1;
    if (sim.phase !== 'PRE' && sim.phase !== 'FT') this.resolveVar(sim);

    switch (sim.phase) {
      case 'PRE':
        if (sim.phaseTicks >= PRE_TICKS) {
          this.enter(sim, 'H1');
          m.status = 'LIVE';
          m.minute = 1;
          this.addEvent(sim, 'KICKOFF', 0);
          this.playMinute(sim);
        }
        break;

      case 'H1':
        if (m.minute! >= 45) {
          this.enter(sim, 'HT');
          m.status = 'PAUSED';
          this.addEvent(sim, 'HT', 45);
        } else {
          m.minute! += 1;
          this.playMinute(sim);
        }
        break;

      case 'HT':
        if (sim.phaseTicks >= HALF_TIME_TICKS) {
          this.enter(sim, 'H2');
          m.status = 'LIVE';
          m.minute = 46;
          this.addEvent(sim, 'KICKOFF', 45, { detail: 'Second half' });
          this.playMinute(sim);
        }
        break;

      case 'H2':
        if (m.minute! >= 90 + sim.stoppage) {
          this.enter(sim, 'FT');
          m.status = 'FINISHED';
          this.addEvent(sim, 'FT', m.minute!);
          this.finishMatch(sim);
        } else {
          m.minute! += 1;
          this.playMinute(sim);
        }
        break;

      case 'FT':
        break;
    }
  }

  private enter(sim: SimMatch, phase: Phase): void {
    sim.phase = phase;
    sim.phaseTicks = 0;
  }

  /**
   * Rolls the dice for one minute of play and records one momentum value.
   * Rates are tuned slightly above real football to keep the demo lively.
   */
  private playMinute(sim: SimMatch): void {
    const m = sim.match;
    const stats = m.stats!;
    const minute = m.minute!;
    const table = this.records[m.league];
    const strength = { home: table.get(m.home.id)!.strength, away: table.get(m.away.id)!.strength };

    // Possession drifts as a random walk, pulled towards what the strength gap suggests.
    const target = clamp(50 + (strength.home - strength.away) * 30, 36, 64);
    const pull = this.chance(0.35) ? Math.sign(target - stats.home.possession) : 0;
    const possession = clamp(stats.home.possession + this.int(-2, 2) + pull, 30, 70);
    stats.home.possession = possession;
    stats.away.possession = 100 - possession;

    let momentum = (possession - 50) * 1.6 + this.int(-12, 12);

    for (const side of ['home', 'away'] as const) {
      const s = stats[side];
      const other = side === 'home' ? 'away' : 'home';
      const sign = side === 'home' ? 1 : -1;
      const pressure = (s.possession / 50) * Math.sqrt(strength[side] / strength[other]) * (side === 'home' ? 1.1 : 1);

      if (this.chance(0.13 * pressure)) {
        s.shots += 1;
        momentum += 22 * sign;
        if (this.chance(0.4)) {
          s.shotsOnTarget += 1;
          if (this.chance(0.3)) {
            momentum += 45 * sign;
            this.scoreGoal(sim, side, minute);
          } else if (this.chance(0.2)) {
            this.addEvent(sim, 'CHANCE', minute, { team: side, player: this.player(m.league), detail: 'Big save' });
          }
        } else if (this.chance(0.09)) {
          const detail = this.pick(['Hit the post', 'Hit the bar', 'Cleared off the line']);
          this.addEvent(sim, 'CHANCE', minute, { team: side, player: this.player(m.league), detail });
          momentum += 15 * sign;
        }
      }
      if (this.chance(0.05 * pressure)) s.corners += 1;
      if (this.chance(0.12)) {
        s.fouls += 1;
        if (this.chance(0.15)) this.addEvent(sim, 'YELLOW', minute, { team: side, player: this.player(m.league) });
        else if (this.chance(0.008)) this.addEvent(sim, 'RED', minute, { team: side, player: this.player(m.league) });
      }
      if (minute >= 58 && sim.subs[side] < 5 && this.chance(0.09)) {
        sim.subs[side] += 1;
        this.addEvent(sim, 'SUB', minute, {
          team: side,
          player: this.player(m.league),
          detail: `for ${this.player(m.league)}`,
        });
      }
    }

    m.momentum!.push(Math.round(clamp(momentum, -100, 100)));
  }

  private scoreGoal(sim: SimMatch, side: Side, minute: number): void {
    const m = sim.match;
    const kind = this.weighted(GOAL_KINDS);
    const scorer = this.player(m.league);
    const assist =
      kind.assisted && this.chance(0.75) ? this.pick(PLAYER_NAMES[m.league].filter((p) => p !== scorer)) : undefined;

    m.score = { ...m.score, [side]: m.score[side] + 1 };
    const goal = this.addEvent(sim, 'GOAL', minute, { team: side, player: scorer, detail: kind.detail, assist });

    // Now and then the goal goes to VAR and is overturned a minute later.
    if (!sim.pendingVar && kind.detail !== 'Penalty' && this.chance(0.08)) {
      sim.pendingVar = { goalId: goal.id, side };
    }
  }

  private resolveVar(sim: SimMatch): void {
    const pending = sim.pendingVar;
    if (!pending) return;
    sim.pendingVar = undefined;

    const m = sim.match;
    m.score = { ...m.score, [pending.side]: Math.max(0, m.score[pending.side] - 1) };
    this.addEvent(sim, 'VAR', m.minute ?? 45, {
      team: pending.side,
      refId: pending.goalId,
      detail: `Goal disallowed · ${this.pick(VAR_REASONS)}`,
    });
  }

  private addEvent(sim: SimMatch, type: MatchEventType, minute: number, extra: Partial<MatchEvent> = {}): MatchEvent {
    sim.eventSeq += 1;
    const event: MatchEvent = { id: `${sim.match.id}-e${sim.eventSeq}`, type, minute };
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined) (event as unknown as Record<string, unknown>)[key] = value;
    }
    sim.match.events.push(event);
    return event;
  }

  // -------------------------------------------------------------- random

  private player(league: LeagueCode): string {
    return this.pick(PLAYER_NAMES[league]);
  }

  private chance(p: number): boolean {
    return this.rng() < p;
  }

  private int(min: number, max: number): number {
    return min + Math.floor(this.rng() * (max - min + 1));
  }

  private pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.rng() * items.length)];
  }

  private weighted<T extends { weight: number }>(items: readonly T[]): T {
    let roll = this.rng() * items.reduce((sum, i) => sum + i.weight, 0);
    for (const item of items) if ((roll -= item.weight) < 0) return item;
    return items[items.length - 1];
  }

  private shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  /** Knuth's method; fine for the small means used here. */
  private poisson(mean: number): number {
    const limit = Math.exp(-mean);
    let k = 0;
    let p = 1;
    do {
      k += 1;
      p *= this.rng();
    } while (p > limit);
    return k - 1;
  }
}

function recordResult(row: StandingRow, scored: number, conceded: number): void {
  row.played += 1;
  row.goalsFor += scored;
  row.goalsAgainst += conceded;
  if (scored > conceded) {
    row.won += 1;
    row.points += 3;
  } else if (scored === conceded) {
    row.drawn += 1;
    row.points += 1;
  } else {
    row.lost += 1;
  }
}

function emptyStats(possession: number): TeamStats {
  return { possession, shots: 0, shotsOnTarget: 0, corners: 0, fouls: 0 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Small, fast, seedable PRNG (public domain). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
