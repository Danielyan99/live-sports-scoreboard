import { isInPlay } from './patch';
import type { LeagueTable, Match, StandingRow } from './types';

export interface LiveStandingRow extends StandingRow {
  position: number;
  /** Position in the table before in-play matches are counted. */
  basePosition: number;
  goalDifference: number;
  /** Set while the team is playing: the result if the match ended now. */
  live?: { outcome: 'W' | 'D' | 'L'; matchId: string };
}

/**
 * Projects a live table: the base table (finished matches only) plus the current
 * score of every in-play match. Sorted by points, goal difference, goals for, name.
 */
export function liveTable(base: LeagueTable, matches: readonly Match[]): LiveStandingRow[] {
  const basePositions = new Map(sortRows(base.rows).map((row, i) => [row.team.id, i + 1]));
  const rows = new Map(base.rows.map((row) => [row.team.id, { ...row } as LiveStandingRow]));

  for (const match of matches) {
    if (match.league !== base.league || !isInPlay(match)) continue;
    applyResult(rows.get(match.home.id), match.score.home, match.score.away, match.id);
    applyResult(rows.get(match.away.id), match.score.away, match.score.home, match.id);
  }

  return sortRows([...rows.values()]).map((row, i) => ({
    ...row,
    goalDifference: row.goalsFor - row.goalsAgainst,
    position: i + 1,
    basePosition: basePositions.get(row.team.id) ?? i + 1,
  }));
}

function applyResult(row: LiveStandingRow | undefined, scored: number, conceded: number, matchId: string): void {
  if (!row) return;
  const outcome = scored > conceded ? 'W' : scored === conceded ? 'D' : 'L';
  row.played += 1;
  row.goalsFor += scored;
  row.goalsAgainst += conceded;
  row.won += outcome === 'W' ? 1 : 0;
  row.drawn += outcome === 'D' ? 1 : 0;
  row.lost += outcome === 'L' ? 1 : 0;
  row.points += outcome === 'W' ? 3 : outcome === 'D' ? 1 : 0;
  row.live = { outcome, matchId };
}

export function sortRows<T extends StandingRow>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
      b.goalsFor - a.goalsFor ||
      a.team.shortName.localeCompare(b.team.shortName),
  );
}
