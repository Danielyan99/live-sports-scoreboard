import {
  applyPatch,
  LEAGUE_CODES,
  type FeedSource,
  type LeagueCode,
  type LeagueResults,
  type LeagueTable,
  type Match,
  type MatchPatch,
  type SnapshotPayload,
} from '@scoreboard/shared';
import { create } from 'zustand';

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting';

export interface WireEntry {
  id: number;
  at: number;
  direction: 'in' | 'out';
  event: string;
  bytes: number;
  summary: string;
}

const WIRE_LOG_LIMIT = 40;

export interface MatchState {
  matches: Record<string, Match>;
  /** Leagues the socket is subscribed to (the league filter). */
  leagues: LeagueCode[];
  /** Match open in the detail view, kept even if its league isn't subscribed. */
  watchedMatchId: string | null;
  /** Ids the server told us it doesn't know (for the detail view's "not found" state). */
  missing: Record<string, true>;
  listLoaded: boolean;
  connection: ConnectionStatus;
  source: FeedSource;
  wire: WireEntry[];
  wireTotals: { messages: number; bytes: number };
  /** Latest real matchday per league; empty until the server has fetched them. */
  results: LeagueResults[];
  /** Base league tables from the demo feed; empty when the real feed is live. */
  tables: LeagueTable[];

  applySnapshot(snapshot: SnapshotPayload): void;
  /** Returns "gap" when a patch was skipped, so the caller can request a resync. */
  applyPatch(patch: MatchPatch): 'applied' | 'stale' | 'gap' | 'unknown';
  addMatch(match: Match): void;
  removeMatch(matchId: string): void;
  setLeagues(leagues: LeagueCode[]): void;
  setWatchedMatch(matchId: string | null): void;
  setConnection(status: ConnectionStatus): void;
  setSource(source: FeedSource): void;
  setResults(results: LeagueResults[]): void;
  setTables(tables: LeagueTable[]): void;
  logWire(direction: WireEntry['direction'], event: string, payload: unknown, summary: string): void;
}

let wireSeq = 0;

export const initialState = {
  matches: {},
  leagues: [...LEAGUE_CODES],
  watchedMatchId: null,
  missing: {},
  listLoaded: false,
  connection: 'connecting' as ConnectionStatus,
  source: 'demo' as FeedSource,
  wire: [],
  wireTotals: { messages: 0, bytes: 0 },
  results: [] as LeagueResults[],
  tables: [] as LeagueTable[],
} satisfies Partial<MatchState>;

export const useMatchStore = create<MatchState>()((set, get) => ({
  ...initialState,

  applySnapshot(snapshot) {
    set((state) => {
      const matches: Record<string, Match> =
        snapshot.scope === 'leagues' ? keepWatched(state.matches, state.watchedMatchId) : { ...state.matches };
      const missing = { ...state.missing };

      for (const match of snapshot.matches) {
        const current = matches[match.id];
        // A snapshot may race with patches; never go backwards.
        if (!current || match.version >= current.version) matches[match.id] = match;
        delete missing[match.id];
      }

      const returned = new Set(snapshot.matches.map((m) => m.id));
      for (const id of snapshot.requestedIds ?? []) {
        if (!returned.has(id)) {
          delete matches[id];
          missing[id] = true;
        }
      }

      return {
        matches,
        missing,
        source: snapshot.source,
        listLoaded: state.listLoaded || snapshot.scope === 'leagues',
      };
    });
  },

  applyPatch(patch) {
    const current = get().matches[patch.matchId];
    if (!current) return 'unknown';

    const result = applyPatch(current, patch);
    if (!result.ok) return result.reason;

    set((state) => ({ matches: { ...state.matches, [patch.matchId]: result.match } }));
    return 'applied';
  },

  addMatch(match) {
    set((state) => {
      const current = state.matches[match.id];
      if (current && current.version >= match.version) return state;
      return { matches: { ...state.matches, [match.id]: match } };
    });
  },

  removeMatch(matchId) {
    set((state) => {
      if (!state.matches[matchId]) return state;
      const { [matchId]: _removed, ...rest } = state.matches;
      return { matches: rest };
    });
  },

  setLeagues(leagues) {
    set({ leagues });
  },

  setWatchedMatch(watchedMatchId) {
    set({ watchedMatchId });
  },

  setConnection(connection) {
    set({ connection });
  },

  setSource(source) {
    set({ source });
  },

  setResults(results) {
    set({ results });
  },

  setTables(tables) {
    set({ tables });
  },

  logWire(direction, event, payload, summary) {
    const bytes = new TextEncoder().encode(JSON.stringify(payload)).length;
    set((state) => ({
      wire: [{ id: ++wireSeq, at: Date.now(), direction, event, bytes, summary }, ...state.wire].slice(
        0,
        WIRE_LOG_LIMIT,
      ),
      wireTotals: { messages: state.wireTotals.messages + 1, bytes: state.wireTotals.bytes + bytes },
    }));
  },
}));

function keepWatched(matches: Record<string, Match>, watchedId: string | null): Record<string, Match> {
  const watched = watchedId ? matches[watchedId] : undefined;
  return watched ? { [watched.id]: watched } : {};
}
