import type { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Test } from '@nestjs/testing';
import {
  ClientEvents,
  ServerEvents,
  SOCKET_NAMESPACE,
  type LeagueResults,
  type LeagueTable,
  type Match,
  type MatchPatch,
  type ResultsPayload,
  type SnapshotPayload,
  type TablesPayload,
} from '@scoreboard/shared';
import type { AddressInfo } from 'node:net';
import { Subject } from 'rxjs';
import { io, type Socket } from 'socket.io-client';
import { makeMatch } from '../test-utils/match.factory';
import { ResultsService } from '../results/results.service';
import { MatchStore } from '../store/match-store.service';
import { MATCH_REPOSITORY, NullMatchRepository } from '../store/match.repository';
import { LiveGateway } from './live.gateway';

function next<T>(socket: Socket, event: string, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** Collects every payload of an event so we can assert on what did NOT arrive. */
function record<T>(socket: Socket, event: string): T[] {
  const received: T[] = [];
  socket.on(event, (payload: T) => received.push(payload));
  return received;
}

const settle = () => new Promise((r) => setTimeout(r, 150));

describe('LiveGateway', () => {
  let app: INestApplication;
  let store: MatchStore;
  let results: { all: LeagueResults[]; changes$: Subject<LeagueResults[]> };
  let url: string;
  const clients: Socket[] = [];

  let plMatch: Match;
  let pdMatch: Match;

  beforeEach(async () => {
    results = { all: [], changes$: new Subject<LeagueResults[]>() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        LiveGateway,
        MatchStore,
        { provide: MATCH_REPOSITORY, useClass: NullMatchRepository },
        { provide: ResultsService, useValue: results },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new IoAdapter(app));
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    url = `http://localhost:${port}${SOCKET_NAMESPACE}`;

    store = moduleRef.get(MatchStore);
    plMatch = makeMatch({ league: 'PL' });
    pdMatch = makeMatch({ league: 'PD' });
    store.ingest([plMatch, pdMatch]);
  });

  afterEach(async () => {
    clients.splice(0).forEach((c) => c.disconnect());
    await app.close();
  });

  async function connect(): Promise<Socket> {
    const socket = io(url, { transports: ['websocket'], forceNew: true });
    clients.push(socket);
    // The server greets every connection with the current feed mode.
    await next(socket, ServerEvents.FeedMode);
    return socket;
  }

  async function subscribeLeagues(socket: Socket, leagues: string[]): Promise<SnapshotPayload> {
    const snapshot = next<SnapshotPayload>(socket, ServerEvents.Snapshot);
    socket.emit(ClientEvents.SubscribeLeagues, { leagues });
    return snapshot;
  }

  it('sends the feed mode on connect', async () => {
    const socket = io(url, { transports: ['websocket'], forceNew: true });
    clients.push(socket);
    await expect(next(socket, ServerEvents.FeedMode)).resolves.toMatchObject({ source: 'demo' });
  });

  it('sends a snapshot of only the subscribed leagues', async () => {
    const socket = await connect();
    const snapshot = await subscribeLeagues(socket, ['PL', 'NOT_A_LEAGUE']);

    expect(snapshot.scope).toBe('leagues');
    expect(snapshot.matches.map((m) => m.id)).toEqual([plMatch.id]);
  });

  it('routes patches only to clients subscribed to that league', async () => {
    const plFan = await connect();
    const pdFan = await connect();
    await subscribeLeagues(plFan, ['PL']);
    await subscribeLeagues(pdFan, ['PD']);
    const pdPatches = record<MatchPatch>(pdFan, ServerEvents.MatchPatch);

    const patch = next<MatchPatch>(plFan, ServerEvents.MatchPatch);
    store.ingest([{ ...plMatch, score: { home: 1, away: 0 } }, pdMatch]);

    await expect(patch).resolves.toMatchObject({
      matchId: plMatch.id,
      version: 2,
      changes: { score: { home: 1, away: 0 } },
    });
    await settle();
    expect(pdPatches).toHaveLength(0);
  });

  it('delivers a patch once to a client in both the league and match rooms', async () => {
    const socket = await connect();
    await subscribeLeagues(socket, ['PL']);
    const detail = next(socket, ServerEvents.Snapshot);
    socket.emit(ClientEvents.SubscribeMatch, { matchId: plMatch.id });
    await detail;

    const patches = record<MatchPatch>(socket, ServerEvents.MatchPatch);
    store.ingest([{ ...plMatch, minute: 11 }, pdMatch]);
    await settle();

    expect(patches).toHaveLength(1);
  });

  it('streams a single match to a detail-only subscriber', async () => {
    const socket = await connect();
    const snapshot = next<SnapshotPayload>(socket, ServerEvents.Snapshot);
    socket.emit(ClientEvents.SubscribeMatch, { matchId: pdMatch.id });
    expect((await snapshot).matches.map((m) => m.id)).toEqual([pdMatch.id]);

    const patch = next<MatchPatch>(socket, ServerEvents.MatchPatch);
    store.ingest([plMatch, { ...pdMatch, status: 'PAUSED' }]);
    await expect(patch).resolves.toMatchObject({ matchId: pdMatch.id, changes: { status: 'PAUSED' } });
  });

  it('announces added and removed matches to the league room', async () => {
    const socket = await connect();
    await subscribeLeagues(socket, ['PL']);
    const newMatch = makeMatch({ league: 'PL' });

    const added = next<Match>(socket, ServerEvents.MatchAdded);
    const removed = next(socket, ServerEvents.MatchRemoved);
    store.ingest([newMatch, pdMatch]);

    await expect(added).resolves.toMatchObject({ id: newMatch.id, version: 1 });
    await expect(removed).resolves.toEqual({ matchId: plMatch.id, league: 'PL' });
  });

  it('answers a resync with current state and echoes the requested ids', async () => {
    const socket = await connect();
    store.ingest([{ ...plMatch, score: { home: 3, away: 1 } }, pdMatch]);

    const snapshot = next<SnapshotPayload>(socket, ServerEvents.Snapshot);
    socket.emit(ClientEvents.Resync, { matchIds: [plMatch.id, 'gone'] });

    await expect(snapshot).resolves.toMatchObject({
      scope: 'matches',
      matches: [{ id: plMatch.id, version: 2, score: { home: 3, away: 1 } }],
      requestedIds: [plMatch.id, 'gone'],
    });
  });

  it('sends recent results on connect and pushes updates', async () => {
    const matchday = (n: number): LeagueResults => ({ league: 'PL', matchday: n, results: [], fetchedAt: '' });
    results.all = [matchday(5)];

    const socket = io(url, { transports: ['websocket'], forceNew: true });
    clients.push(socket);
    await expect(next<ResultsPayload>(socket, ServerEvents.Results)).resolves.toEqual({ leagues: [matchday(5)] });

    const update = next<ResultsPayload>(socket, ServerEvents.Results);
    results.changes$.next([matchday(6)]);
    await expect(update).resolves.toEqual({ leagues: [matchday(6)] });
  });

  it('sends league tables on connect and when they change', async () => {
    const table = (points: number): LeagueTable => ({
      league: 'PL',
      rows: [{ team: plMatch.home, played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 2, goalsAgainst: 0, points }],
    });
    store.setTables([table(3)]);

    const socket = io(url, { transports: ['websocket'], forceNew: true });
    clients.push(socket);
    await expect(next<TablesPayload>(socket, ServerEvents.Tables)).resolves.toEqual({ tables: [table(3)] });

    const update = next<TablesPayload>(socket, ServerEvents.Tables);
    store.setTables([table(6)]);
    await expect(update).resolves.toEqual({ tables: [table(6)] });
  });

  it('broadcasts feed mode changes to everyone', async () => {
    const socket = await connect();
    const mode = next(socket, ServerEvents.FeedMode);
    store.setSource('live', '2 match(es) in play');
    await expect(mode).resolves.toEqual({ source: 'live', reason: '2 match(es) in play' });
  });
});
