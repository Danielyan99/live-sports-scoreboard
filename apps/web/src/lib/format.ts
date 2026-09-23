import { isInPlay, type Match } from '@scoreboard/shared';

/** Scoreboard clock text: 67', 90+3', HT, FT, or kickoff time. */
export function formatClock(match: Pick<Match, 'status' | 'minute' | 'kickoff'>): string {
  switch (match.status) {
    case 'PAUSED':
      return 'HT';
    case 'FINISHED':
      return 'FT';
    case 'LIVE': {
      const m = match.minute ?? 0;
      return m > 90 ? `90+${m - 90}'` : `${m}'`;
    }
    default:
      return formatKickoff(match.kickoff);
  }
}

export function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}

const STATUS_ORDER: Record<Match['status'], number> = { LIVE: 0, PAUSED: 0, SCHEDULED: 1, FINISHED: 2 };

/** In-play first, then upcoming by kickoff, then finished. Stable by kickoff and id. */
export function sortMatches(matches: Match[]): Match[] {
  return [...matches].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.kickoff.localeCompare(b.kickoff) || a.id.localeCompare(b.id),
  );
}

export function countInPlay(matches: Match[]): number {
  return matches.filter(isInPlay).length;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
