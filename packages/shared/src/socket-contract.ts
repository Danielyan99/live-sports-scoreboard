import type { FeedSource, LeagueCode, LeagueResults, LeagueTable, Match, MatchPatch } from './types';

export const SOCKET_NAMESPACE = '/live';

/** Client → server event names. */
export const ClientEvents = {
  SubscribeLeagues: 'subscribe:leagues',
  SubscribeMatch: 'subscribe:match',
  UnsubscribeMatch: 'unsubscribe:match',
  Resync: 'resync',
} as const;

/** Server → client event names. */
export const ServerEvents = {
  Snapshot: 'snapshot',
  MatchPatch: 'match:patch',
  MatchAdded: 'match:added',
  MatchRemoved: 'match:removed',
  FeedMode: 'feed:mode',
  Results: 'results',
  Tables: 'tables',
} as const;

export interface SubscribeLeaguesPayload {
  leagues: LeagueCode[];
}

export interface MatchIdPayload {
  matchId: string;
}

export interface ResyncPayload {
  matchIds: string[];
}

export interface SnapshotPayload {
  /** "leagues" replaces the whole list; "matches" upserts only the given matches (resync / detail). */
  scope: 'leagues' | 'matches';
  matches: Match[];
  /**
   * For scope "matches": the ids the client asked for. Any id missing from
   * `matches` is no longer tracked by the server and should be dropped.
   */
  requestedIds?: string[];
  source: FeedSource;
  serverTime: string;
}

/** Sent on connect and whenever the recent results change. Covers every league. */
export interface ResultsPayload {
  leagues: LeagueResults[];
}

/** Base league tables (demo feed only). Empty when the real feed is live. */
export interface TablesPayload {
  tables: LeagueTable[];
}

export interface MatchRemovedPayload {
  matchId: string;
  league: LeagueCode;
}

export interface FeedModePayload {
  source: FeedSource;
  reason: string;
}

/** Typed maps for socket.io's generic Server/Socket types. */
export interface ServerToClientEvents {
  [ServerEvents.Snapshot]: (payload: SnapshotPayload) => void;
  [ServerEvents.MatchPatch]: (payload: MatchPatch) => void;
  [ServerEvents.MatchAdded]: (payload: Match) => void;
  [ServerEvents.MatchRemoved]: (payload: MatchRemovedPayload) => void;
  [ServerEvents.FeedMode]: (payload: FeedModePayload) => void;
  [ServerEvents.Results]: (payload: ResultsPayload) => void;
  [ServerEvents.Tables]: (payload: TablesPayload) => void;
}

export interface ClientToServerEvents {
  [ClientEvents.SubscribeLeagues]: (payload: SubscribeLeaguesPayload) => void;
  [ClientEvents.SubscribeMatch]: (payload: MatchIdPayload) => void;
  [ClientEvents.UnsubscribeMatch]: (payload: MatchIdPayload) => void;
  [ClientEvents.Resync]: (payload: ResyncPayload) => void;
}

export const leagueRoom = (league: LeagueCode) => `league:${league}`;
export const matchRoom = (matchId: string) => `match:${matchId}`;
