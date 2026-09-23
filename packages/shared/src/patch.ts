import type { Match, MatchPatch } from './types';

export type ApplyPatchResult =
  | { ok: true; match: Match }
  /** Patch is older than or equal to what we hold — safe to ignore. */
  | { ok: false; reason: 'stale' }
  /** We missed one or more patches — caller should resync this match. */
  | { ok: false; reason: 'gap' };

/**
 * Applies a patch to a match only if it is the exact next version.
 * Shared by the server (cache) and the client (store) so both sides
 * agree on what a patch means.
 */
export function applyPatch(match: Match, patch: MatchPatch): ApplyPatchResult {
  if (patch.version <= match.version) return { ok: false, reason: 'stale' };
  if (patch.version !== match.version + 1) return { ok: false, reason: 'gap' };

  const knownIds = new Set(match.events.map((e) => e.id));
  const newEvents = patch.newEvents.filter((e) => !knownIds.has(e.id));
  const next: Match = {
    ...match,
    ...patch.changes,
    events: newEvents.length ? [...match.events, ...newEvents] : match.events,
    version: patch.version,
  };
  if (patch.momentumAppend?.length) next.momentum = [...(next.momentum ?? []), ...patch.momentumAppend];

  return { ok: true, match: next };
}

export function isInPlay(match: Pick<Match, 'status'>): boolean {
  return match.status === 'LIVE' || match.status === 'PAUSED';
}
