export const LEAGUES = {
  PL: { code: 'PL', name: 'Premier League', country: 'England' },
  PD: { code: 'PD', name: 'La Liga', country: 'Spain' },
} as const;

export type LeagueCode = keyof typeof LEAGUES;
export const LEAGUE_CODES = Object.keys(LEAGUES) as LeagueCode[];

export function isLeagueCode(value: unknown): value is LeagueCode {
  return typeof value === 'string' && value in LEAGUES;
}

export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'PAUSED' | 'FINISHED';

/** Where a match came from: the real football-data.org feed or the built-in simulator. */
export type FeedSource = 'live' | 'demo';

export interface Team {
  id: string;
  name: string;
  shortName: string;
  /** Three-letter abbreviation, e.g. "ARS". */
  tla: string;
  crest?: string;
}

export interface Score {
  home: number;
  away: number;
}

export type MatchEventType =
  | 'GOAL'
  | 'YELLOW'
  | 'RED'
  | 'SUB'
  | 'KICKOFF'
  | 'HT'
  | 'FT'
  /** A near miss: woodwork, big save, cleared off the line. */
  | 'CHANCE'
  /** A VAR decision. `refId` points at the goal it overturned. */
  | 'VAR';

export interface MatchEvent {
  /** Stable id so the diff engine can tell which events are new. */
  id: string;
  type: MatchEventType;
  minute: number;
  team?: 'home' | 'away';
  player?: string;
  /** Free text, e.g. "Penalty" or "Hit the post". */
  detail?: string;
  /** Goals only. */
  assist?: string;
  /** VAR only: the event this decision refers to. Events are append-only, so a disallowed goal stays in the list. */
  refId?: string;
}

export interface TeamStats {
  possession: number;
  shots: number;
  shotsOnTarget: number;
  corners: number;
  fouls: number;
}

export interface MatchStats {
  home: TeamStats;
  away: TeamStats;
}

export interface Match {
  id: string;
  league: LeagueCode;
  home: Team;
  away: Team;
  score: Score;
  status: MatchStatus;
  /** Match clock in minutes; null before kick-off. */
  minute: number | null;
  kickoff: string;
  events: MatchEvent[];
  stats?: MatchStats;
  /**
   * Attack momentum, one value per played minute, from -100 (away pressure)
   * to 100 (home pressure). Append-only, so patches carry just the new minutes.
   */
  momentum?: number[];
  /** Incremented by the server on every real change. Clients use it to detect gaps. */
  version: number;
  source: FeedSource;
  updatedAt: string;
}

/** The mutable part of a match that a patch can change. `momentum` here means a full replacement. */
export type MatchChanges = Partial<Pick<Match, 'score' | 'status' | 'minute' | 'stats' | 'momentum'>>;

/**
 * A minimal update for one match. `version` is the match version *after*
 * the patch is applied, so a client holding `version - 1` can apply it safely.
 */
export interface MatchPatch {
  matchId: string;
  league: LeagueCode;
  version: number;
  changes: MatchChanges;
  newEvents: MatchEvent[];
  /** Momentum values to append (the usual case, instead of resending the whole array). */
  momentumAppend?: number[];
}

/** Returns the goal events that have not been overturned by VAR. */
export function countedGoals(events: readonly MatchEvent[]): MatchEvent[] {
  const overturned = new Set(events.filter((e) => e.type === 'VAR' && e.refId).map((e) => e.refId));
  return events.filter((e) => e.type === 'GOAL' && !overturned.has(e.id));
}

export interface StandingRow {
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

/**
 * League table *excluding* matches in play. Clients add in-play scores on top
 * to show a live table, so the table only needs pushing when a match finishes.
 */
export interface LeagueTable {
  league: LeagueCode;
  rows: StandingRow[];
}

/** A finished real match. The free data tier has scores only, so no events or stats. */
export interface MatchResult {
  id: string;
  league: LeagueCode;
  matchday: number;
  kickoff: string;
  home: Team;
  away: Team;
  score: Score;
  halfTime: Score | null;
  referee?: string;
}

/** The latest completed (or in-progress) matchday of one league. */
export interface LeagueResults {
  league: LeagueCode;
  matchday: number;
  results: MatchResult[];
  fetchedAt: string;
}
