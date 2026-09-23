import { Logger, OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  ClientEvents,
  ServerEvents,
  SOCKET_NAMESPACE,
  isLeagueCode,
  leagueRoom,
  matchRoom,
  type ClientToServerEvents,
  type LeagueCode,
  type Match,
  type ServerToClientEvents,
  type SnapshotPayload,
} from '@scoreboard/shared';
import { Subscription } from 'rxjs';
import type { Namespace, Socket } from 'socket.io';
import { ResultsService } from '../results/results.service';
import { MatchStore, type FeedChange } from '../store/match-store.service';

type LiveNamespace = Namespace<ClientToServerEvents, ServerToClientEvents>;
type LiveSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const MAX_RESYNC_IDS = 50;

/** Reads an array field from an untrusted socket payload. */
function arrayField(payload: unknown, key: string): unknown[] {
  const value = (payload as Record<string, unknown> | null)?.[key];
  return Array.isArray(value) ? value : [];
}

function matchIdField(payload: unknown): string | undefined {
  const value = (payload as Record<string, unknown> | null)?.matchId;
  return typeof value === 'string' && value.length <= 100 ? value : undefined;
}

/**
 * Real-time push over Socket.io.
 *
 * Clients join rooms instead of receiving everything:
 *   league:<code>  – list view, receives added/removed/patch for that league
 *   match:<id>     – detail view, receives patches for one match
 * On subscribe, a client gets a snapshot; after that only patches. If a client
 * notices a version gap it asks for a `resync` of just the affected matches.
 */
@WebSocketGateway({ namespace: SOCKET_NAMESPACE })
export class LiveGateway implements OnGatewayInit, OnGatewayConnection, OnModuleDestroy {
  private readonly logger = new Logger(LiveGateway.name);
  private subscriptions: Subscription[] = [];

  @WebSocketServer()
  private readonly server: LiveNamespace;

  constructor(
    private readonly store: MatchStore,
    private readonly results: ResultsService,
  ) {}

  get connectedClients(): number {
    return this.server?.sockets.size ?? 0;
  }

  afterInit(): void {
    this.subscriptions = [
      this.store.changes$.subscribe((change) => this.publish(change)),
      this.store.mode$.subscribe(({ source, reason }) => this.server.emit(ServerEvents.FeedMode, { source, reason })),
      // Results are small and change rarely, so everyone gets all leagues.
      this.results.changes$.subscribe((leagues) => this.server.emit(ServerEvents.Results, { leagues })),
      // Tables change only at full time, so everyone gets all leagues.
      this.store.tables$.subscribe((tables) => this.server.emit(ServerEvents.Tables, { tables })),
    ];
  }

  onModuleDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  handleConnection(client: LiveSocket): void {
    client.emit(ServerEvents.FeedMode, { source: this.store.source, reason: 'connected' });
    const leagues = this.results.all;
    if (leagues.length) client.emit(ServerEvents.Results, { leagues });
    if (this.store.tables.length) client.emit(ServerEvents.Tables, { tables: this.store.tables });
  }

  @SubscribeMessage(ClientEvents.SubscribeLeagues)
  onSubscribeLeagues(@ConnectedSocket() client: LiveSocket, @MessageBody() payload: unknown): void {
    const leagues = [...new Set(arrayField(payload, 'leagues').filter(isLeagueCode))] as LeagueCode[];

    for (const room of client.rooms) if (room.startsWith('league:')) void client.leave(room);
    leagues.forEach((league) => void client.join(leagueRoom(league)));

    client.emit(ServerEvents.Snapshot, this.snapshot('leagues', this.store.byLeagues(leagues)));
  }

  @SubscribeMessage(ClientEvents.SubscribeMatch)
  async onSubscribeMatch(@ConnectedSocket() client: LiveSocket, @MessageBody() payload: unknown): Promise<void> {
    const matchId = matchIdField(payload);
    if (!matchId) return;

    await client.join(matchRoom(matchId));
    const match = await this.store.findRecent(matchId);
    client.emit(ServerEvents.Snapshot, { ...this.snapshot('matches', match ? [match] : []), requestedIds: [matchId] });
  }

  @SubscribeMessage(ClientEvents.UnsubscribeMatch)
  onUnsubscribeMatch(@ConnectedSocket() client: LiveSocket, @MessageBody() payload: unknown): void {
    const matchId = matchIdField(payload);
    if (matchId) void client.leave(matchRoom(matchId));
  }

  @SubscribeMessage(ClientEvents.Resync)
  onResync(@ConnectedSocket() client: LiveSocket, @MessageBody() payload: unknown): void {
    const ids = arrayField(payload, 'matchIds')
      .filter((id): id is string => typeof id === 'string')
      .slice(0, MAX_RESYNC_IDS);
    const found = ids.map((id) => this.store.get(id)).filter((m): m is Match => m !== undefined);

    this.logger.debug(`Resync for ${client.id}: ${found.length}/${ids.length} match(es)`);
    // Ids that are no longer tracked are simply absent; the client drops them.
    client.emit(ServerEvents.Snapshot, { ...this.snapshot('matches', found), requestedIds: ids });
  }

  /** Fans a feed change out to the rooms that care about it. */
  private publish({ added, removed, patches }: FeedChange): void {
    for (const match of added) {
      this.server.to(leagueRoom(match.league)).emit(ServerEvents.MatchAdded, match);
    }
    for (const patch of patches) {
      // Socket.io de-duplicates across rooms, so a client in both rooms gets the patch once.
      this.server.to([leagueRoom(patch.league), matchRoom(patch.matchId)]).emit(ServerEvents.MatchPatch, patch);
    }
    for (const match of removed) {
      this.server
        .to([leagueRoom(match.league), matchRoom(match.id)])
        .emit(ServerEvents.MatchRemoved, { matchId: match.id, league: match.league });
    }
  }

  private snapshot(scope: SnapshotPayload['scope'], matches: Match[]): SnapshotPayload {
    return { scope, matches, source: this.store.source, serverTime: new Date().toISOString() };
  }
}
