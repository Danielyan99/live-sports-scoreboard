import type { Match, MatchChanges, MatchEvent, MatchPatch, MatchStats, Score, TeamStats } from '@scoreboard/shared';

export interface DiffResult {
  /** Matches that were not in the previous state (version starts at 1). */
  added: Match[];
  /** Matches that disappeared from the feed. */
  removed: Match[];
  /** Minimal patches for matches whose tracked fields actually changed. */
  patches: MatchPatch[];
  /** The full next state, with versions and timestamps assigned. */
  next: Map<string, Match>;
}

/**
 * Compares the previous known state with a fresh set of matches from a provider
 * and produces the smallest set of changes to broadcast.
 *
 * - Providers never set versions; the diff engine owns them. A match's version is
 *   bumped exactly once per diff, and only if something observable changed.
 * - Only fields that clients render live are compared (score, status, minute, stats).
 *   Static data (teams, kickoff) is sent once in the "added" payload.
 * - Events are append-only: a patch carries just the events whose ids are new.
 *
 * Pure function: no I/O, no clock unless passed in, so it is trivially testable.
 */
export function diffMatches(
  prev: ReadonlyMap<string, Match>,
  incoming: readonly Match[],
  now: Date = new Date(),
): DiffResult {
  const timestamp = now.toISOString();
  const next = new Map<string, Match>();
  const added: Match[] = [];
  const patches: MatchPatch[] = [];

  for (const fresh of incoming) {
    const old = prev.get(fresh.id);

    if (!old) {
      const match: Match = { ...fresh, version: 1, updatedAt: timestamp };
      next.set(match.id, match);
      added.push(match);
      continue;
    }

    const changes = diffFields(old, fresh);
    const newEvents = diffEvents(old.events, fresh.events);
    const momentum = diffMomentum(old.momentum, fresh.momentum);
    if (momentum.kind === 'replace') changes.momentum = momentum.values;
    const momentumAppend = momentum.kind === 'append' ? momentum.values : undefined;

    if (Object.keys(changes).length === 0 && newEvents.length === 0 && !momentumAppend) {
      next.set(old.id, old);
      continue;
    }

    const version = old.version + 1;
    next.set(old.id, {
      ...old,
      ...changes,
      events: newEvents.length ? [...old.events, ...newEvents] : old.events,
      ...(momentumAppend && { momentum: [...(old.momentum ?? []), ...momentumAppend] }),
      version,
      updatedAt: timestamp,
    });
    const patch: MatchPatch = { matchId: old.id, league: old.league, version, changes, newEvents };
    if (momentumAppend) patch.momentumAppend = momentumAppend;
    patches.push(patch);
  }

  const removed = [...prev.values()].filter((m) => !next.has(m.id));

  return { added, removed, patches, next };
}

export function isEmptyDiff(diff: Pick<DiffResult, 'added' | 'removed' | 'patches'>): boolean {
  return diff.added.length === 0 && diff.removed.length === 0 && diff.patches.length === 0;
}

function diffFields(old: Match, fresh: Match): MatchChanges {
  const changes: MatchChanges = {};
  if (!scoreEqual(old.score, fresh.score)) changes.score = fresh.score;
  if (old.status !== fresh.status) changes.status = fresh.status;
  if (old.minute !== fresh.minute) changes.minute = fresh.minute;
  if (!statsEqual(old.stats, fresh.stats)) changes.stats = fresh.stats;
  return changes;
}

type MomentumDiff = { kind: 'none' } | { kind: 'append' | 'replace'; values: number[] };

/**
 * Momentum only ever grows, so the usual diff is "these new minutes". If the old
 * array is not a prefix of the new one (which shouldn't happen), fall back to
 * sending the whole thing.
 */
function diffMomentum(old: readonly number[] = [], fresh: readonly number[] = []): MomentumDiff {
  const isPrefix = old.length <= fresh.length && old.every((v, i) => v === fresh[i]);
  if (!isPrefix) return { kind: 'replace', values: [...fresh] };
  if (fresh.length === old.length) return { kind: 'none' };
  return { kind: 'append', values: fresh.slice(old.length) };
}

function diffEvents(oldEvents: readonly MatchEvent[], freshEvents: readonly MatchEvent[]): MatchEvent[] {
  if (freshEvents.length === 0) return [];
  const known = new Set(oldEvents.map((e) => e.id));
  return freshEvents.filter((e) => !known.has(e.id));
}

function scoreEqual(a: Score, b: Score): boolean {
  return a.home === b.home && a.away === b.away;
}

const STAT_KEYS: (keyof TeamStats)[] = ['possession', 'shots', 'shotsOnTarget', 'corners', 'fouls'];

function statsEqual(a: MatchStats | undefined, b: MatchStats | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return STAT_KEYS.every((k) => a.home[k] === b.home[k] && a.away[k] === b.away[k]);
}
