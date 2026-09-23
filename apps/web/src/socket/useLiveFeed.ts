import {
  ClientEvents,
  ServerEvents,
  type ClientToServerEvents,
  type FeedModePayload,
  type ResultsPayload,
  type Match,
  type MatchPatch,
  type MatchRemovedPayload,
  type SnapshotPayload,
  type TablesPayload,
} from '@scoreboard/shared';
import { useEffect } from 'react';
import { alertFor, useAlertStore } from '../state/alertStore';
import { useMatchStore } from '../state/matchStore';
import { socket } from './client';

const RESYNC_BATCH_MS = 100;

/** Emits a client event and records it in the wire inspector. */
export function send<E extends keyof ClientToServerEvents>(
  event: E,
  payload: Parameters<ClientToServerEvents[E]>[0],
): void {
  useMatchStore.getState().logWire('out', event, payload, JSON.stringify(payload));
  (socket.emit as (event: string, payload: unknown) => void)(event, payload);
}

const label = (m: Match | undefined) => (m ? `${m.home.tla}–${m.away.tla}` : '?');

/**
 * Binds the socket to the store. Mount once, at the app root.
 *
 * Handles (re)subscription after every (re)connect, applies patches, and
 * batches resync requests when a version gap is detected.
 */
export function useLiveFeed(): void {
  useEffect(() => {
    const store = useMatchStore.getState;
    const pendingResync = new Set<string>();
    let resyncTimer: ReturnType<typeof setTimeout> | undefined;

    const requestResync = (matchId: string) => {
      pendingResync.add(matchId);
      resyncTimer ??= setTimeout(() => {
        send(ClientEvents.Resync, { matchIds: [...pendingResync] });
        pendingResync.clear();
        resyncTimer = undefined;
      }, RESYNC_BATCH_MS);
    };

    const onConnect = () => {
      store().setConnection('live');
      // A fresh snapshot after every (re)connect repairs anything missed while offline.
      send(ClientEvents.SubscribeLeagues, { leagues: store().leagues });
      const watched = store().watchedMatchId;
      if (watched) send(ClientEvents.SubscribeMatch, { matchId: watched });
    };

    const onDisconnect = () => store().setConnection('reconnecting');

    const onSnapshot = (payload: SnapshotPayload) => {
      store().logWire('in', ServerEvents.Snapshot, payload, `${payload.scope} · ${payload.matches.length} match(es)`);
      store().applySnapshot(payload);
    };

    const onPatch = (patch: MatchPatch) => {
      const fields = Object.keys(patch.changes);
      if (patch.newEvents.length) fields.push(`+${patch.newEvents.length} event`);
      if (patch.momentumAppend?.length) fields.push(`+${patch.momentumAppend.length} momentum`);
      store().logWire(
        'in',
        ServerEvents.MatchPatch,
        patch,
        `${label(store().matches[patch.matchId])} v${patch.version} · ${fields.join(', ')}`,
      );

      const result = store().applyPatch(patch);
      if (result === 'gap' || result === 'unknown') requestResync(patch.matchId);

      // Goal and VAR alerts come only from patches, never from snapshots, so a
      // page load or reconnect doesn't replay old goals.
      if (result === 'applied') {
        const match = store().matches[patch.matchId];
        for (const event of patch.newEvents) {
          const alert = alertFor(match, event);
          if (alert) useAlertStore.getState().push(alert);
        }
      }
    };

    const onAdded = (match: Match) => {
      store().logWire('in', ServerEvents.MatchAdded, match, label(match));
      store().addMatch(match);
    };

    const onRemoved = (payload: MatchRemovedPayload) => {
      store().logWire('in', ServerEvents.MatchRemoved, payload, label(store().matches[payload.matchId]));
      if (payload.matchId !== store().watchedMatchId) store().removeMatch(payload.matchId);
    };

    const onFeedMode = (payload: FeedModePayload) => {
      store().logWire('in', ServerEvents.FeedMode, payload, `${payload.source} · ${payload.reason}`);
      store().setSource(payload.source);
    };

    const onResults = (payload: ResultsPayload) => {
      const summary = payload.leagues.map((l) => `${l.league} md${l.matchday} · ${l.results.length}`).join(', ');
      store().logWire('in', ServerEvents.Results, payload, summary);
      store().setResults(payload.leagues);
    };

    const onTables = (payload: TablesPayload) => {
      const summary = payload.tables.map((t) => `${t.league} · ${t.rows.length} teams`).join(', ') || 'cleared';
      store().logWire('in', ServerEvents.Tables, payload, summary);
      store().setTables(payload.tables);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on(ServerEvents.Snapshot, onSnapshot);
    socket.on(ServerEvents.MatchPatch, onPatch);
    socket.on(ServerEvents.MatchAdded, onAdded);
    socket.on(ServerEvents.MatchRemoved, onRemoved);
    socket.on(ServerEvents.FeedMode, onFeedMode);
    socket.on(ServerEvents.Results, onResults);
    socket.on(ServerEvents.Tables, onTables);
    socket.connect();

    // Re-subscribe whenever the league filter changes.
    const unsubscribeLeagues = useMatchStore.subscribe((state, prev) => {
      if (state.leagues !== prev.leagues && socket.connected) {
        send(ClientEvents.SubscribeLeagues, { leagues: state.leagues });
      }
    });

    return () => {
      unsubscribeLeagues();
      clearTimeout(resyncTimer);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off(ServerEvents.Snapshot, onSnapshot);
      socket.off(ServerEvents.MatchPatch, onPatch);
      socket.off(ServerEvents.MatchAdded, onAdded);
      socket.off(ServerEvents.MatchRemoved, onRemoved);
      socket.off(ServerEvents.FeedMode, onFeedMode);
      socket.off(ServerEvents.Results, onResults);
      socket.off(ServerEvents.Tables, onTables);
      socket.disconnect();
    };
  }, []);
}

/** Subscribes the socket to one match for as long as the calling component is mounted. */
export function useWatchMatch(matchId: string | undefined): void {
  useEffect(() => {
    if (!matchId) return;
    const store = useMatchStore.getState;
    store().setWatchedMatch(matchId);
    if (socket.connected) send(ClientEvents.SubscribeMatch, { matchId });

    return () => {
      if (socket.connected) send(ClientEvents.UnsubscribeMatch, { matchId });
      store().setWatchedMatch(null);
      // Drop the match if the list view isn't subscribed to its league.
      const match = store().matches[matchId];
      if (match && !store().leagues.includes(match.league)) store().removeMatch(matchId);
    };
  }, [matchId]);
}
