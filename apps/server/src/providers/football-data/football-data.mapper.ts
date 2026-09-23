import type { LeagueCode, Match, MatchEvent, MatchResult, MatchStatus, Team } from '@scoreboard/shared';
import { isLeagueCode } from '@scoreboard/shared';

/** The subset of the football-data.org v4 match resource we rely on. */
export interface FdTeam {
  id: number;
  name: string;
  shortName?: string;
  tla?: string;
  crest?: string;
}

export interface FdMatch {
  id: number;
  utcDate: string;
  status: string;
  minute?: number | string | null;
  matchday?: number | null;
  referees?: { name: string; type?: string }[];
  competition: { code: string };
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  score: {
    fullTime: { home: number | null; away: number | null };
    halfTime?: { home: number | null; away: number | null };
  };
}

export interface FdMatchesResponse {
  matches: FdMatch[];
}

const STATUS_MAP: Record<string, MatchStatus | undefined> = {
  SCHEDULED: 'SCHEDULED',
  TIMED: 'SCHEDULED',
  IN_PLAY: 'LIVE',
  PAUSED: 'PAUSED',
  FINISHED: 'FINISHED',
  AWARDED: 'FINISHED',
  // POSTPONED, SUSPENDED, CANCELLED are dropped: nothing to show live.
};

/**
 * Converts a football-data.org match into our domain model.
 *
 * The free tier doesn't include goal scorers, bookings or stats, so events are
 * derived by comparing with the previous state: a score increase becomes a GOAL
 * event, and status transitions become KICKOFF / HT / FT markers.
 */
export function mapFdMatch(raw: FdMatch, previous: Match | undefined, now: Date): Match | null {
  const status = STATUS_MAP[raw.status];
  const league = raw.competition?.code;
  if (!status || !isLeagueCode(league)) return null;

  const id = `fd-${raw.id}`;
  const score = { home: raw.score.fullTime.home ?? 0, away: raw.score.fullTime.away ?? 0 };
  const minute = resolveMinute(raw, status, now);

  return {
    id,
    league: league as LeagueCode,
    home: mapTeam(raw.homeTeam),
    away: mapTeam(raw.awayTeam),
    score,
    status,
    minute,
    kickoff: raw.utcDate,
    events: deriveEvents(id, previous, score, status, minute ?? 0),
    version: 0,
    source: 'live',
    updatedAt: now.toISOString(),
  };
}

/** Converts a finished football-data.org match into a result row. */
export function mapFdResult(raw: FdMatch): MatchResult | null {
  const league = raw.competition?.code;
  if (STATUS_MAP[raw.status] !== 'FINISHED' || !isLeagueCode(league)) return null;
  const { fullTime, halfTime } = raw.score;
  if (fullTime.home === null || fullTime.away === null) return null;

  return {
    id: `fd-${raw.id}`,
    league,
    matchday: raw.matchday ?? 0,
    kickoff: raw.utcDate,
    home: mapTeam(raw.homeTeam),
    away: mapTeam(raw.awayTeam),
    score: { home: fullTime.home, away: fullTime.away },
    halfTime:
      halfTime && halfTime.home !== null && halfTime.away !== null
        ? { home: halfTime.home, away: halfTime.away }
        : null,
    referee: raw.referees?.find((r) => r.type === 'REFEREE')?.name,
  };
}

/**
 * Picks the latest round from a season of results: the highest matchday with at
 * least one finished match. A postponed game from an older round, played midweek,
 * doesn't take over the section.
 */
export function latestMatchday(results: MatchResult[]): { matchday: number; results: MatchResult[] } | null {
  if (results.length === 0) return null;
  const matchday = Math.max(...results.map((r) => r.matchday));
  return {
    matchday,
    results: results
      .filter((r) => r.matchday === matchday)
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.id.localeCompare(b.id)),
  };
}

function mapTeam(t: FdTeam): Team {
  return {
    id: `fd-${t.id}`,
    name: t.name,
    shortName: t.shortName ?? t.name,
    tla: t.tla ?? t.name.slice(0, 3).toUpperCase(),
    crest: t.crest,
  };
}

/**
 * Uses the API's minute when available; otherwise estimates it from kickoff time
 * (assuming a ~15 min half-time break). Good enough for a live indicator.
 */
function resolveMinute(raw: FdMatch, status: MatchStatus, now: Date): number | null {
  if (status === 'SCHEDULED') return null;
  if (status === 'FINISHED') return 90;
  if (status === 'PAUSED') return 45;

  const reported = typeof raw.minute === 'string' ? parseInt(raw.minute, 10) : raw.minute;
  if (typeof reported === 'number' && Number.isFinite(reported)) return reported;

  const elapsed = Math.floor((now.getTime() - new Date(raw.utcDate).getTime()) / 60_000);
  if (elapsed <= 45) return Math.max(1, elapsed);
  return Math.min(90, Math.max(46, elapsed - 15));
}

function deriveEvents(
  matchId: string,
  previous: Match | undefined,
  score: { home: number; away: number },
  status: MatchStatus,
  minute: number,
): MatchEvent[] {
  const events = previous ? [...previous.events] : [];
  if (!previous) return events;

  // "The nth goal of this side" is a stable id, so re-deriving the same goal is idempotent.
  for (const side of ['home', 'away'] as const) {
    for (let n = previous.score[side] + 1; n <= score[side]; n++) {
      events.push({ id: `${matchId}-goal-${side}-${n}`, type: 'GOAL', minute, team: side });
    }
  }

  if (previous.status !== status) {
    const marker =
      previous.status === 'SCHEDULED' && status === 'LIVE'
        ? ({ type: 'KICKOFF', minute: 0 } as const)
        : status === 'PAUSED'
          ? ({ type: 'HT', minute: 45 } as const)
          : status === 'FINISHED'
            ? ({ type: 'FT', minute } as const)
            : null;
    if (marker) events.push({ id: `${matchId}-${marker.type.toLowerCase()}`, ...marker });
  }

  return events;
}
