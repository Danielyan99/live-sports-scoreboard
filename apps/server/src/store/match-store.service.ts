import { Inject, Injectable, Logger } from '@nestjs/common';
import type { FeedSource, LeagueCode, LeagueTable, Match } from '@scoreboard/shared';
import { isInPlay } from '@scoreboard/shared';
import { Subject } from 'rxjs';
import { diffMatches, isEmptyDiff, type DiffResult } from '../ingestion/diff-engine';
import { MATCH_REPOSITORY, type MatchRepository } from './match.repository';

export type FeedChange = Omit<DiffResult, 'next'>;

export interface FeedModeChange {
  source: FeedSource;
  reason: string;
}

/**
 * The single source of truth for current match state.
 *
 * Hot state lives in memory so snapshots and REST reads never touch the network.
 * Changes are published on `changes$`; the socket gateway subscribes to it.
 * Real (non-demo) matches are also written to MongoDB so a restart can warm-start
 * without spending API quota, and recently finished matches stay queryable.
 */
@Injectable()
export class MatchStore {
  private readonly logger = new Logger(MatchStore.name);
  private matches = new Map<string, Match>();
  private currentSource: FeedSource = 'demo';
  private currentTables: LeagueTable[] = [];

  readonly changes$ = new Subject<FeedChange>();
  readonly mode$ = new Subject<FeedModeChange>();
  readonly tables$ = new Subject<LeagueTable[]>();

  constructor(@Inject(MATCH_REPOSITORY) private readonly repository: MatchRepository) {}

  get source(): FeedSource {
    return this.currentSource;
  }

  /** Base league tables (finished matches only). Demo feed only; empty otherwise. */
  get tables(): LeagueTable[] {
    return this.currentTables;
  }

  setTables(tables: LeagueTable[]): void {
    if (tables.length === 0 && this.currentTables.length === 0) return;
    this.currentTables = tables;
    this.tables$.next(tables);
  }

  async warmStart(maxAgeMs = 3 * 3600_000): Promise<void> {
    if (!this.repository.enabled) return;
    try {
      const recent = await this.repository.loadRecent(new Date(Date.now() - maxAgeMs));
      this.matches = new Map(recent.filter((m) => m.source === 'live').map((m) => [m.id, m]));
      if ([...this.matches.values()].some(isInPlay)) this.currentSource = 'live';
      this.logger.log(`Warm start: restored ${this.matches.size} match(es) from MongoDB`);
    } catch (err) {
      this.logger.error(`Warm start failed, starting empty: ${(err as Error).message}`);
    }
  }

  /** Diffs a full provider snapshot against current state and publishes the result. */
  ingest(incoming: Match[], now = new Date()): FeedChange {
    const { next, ...change } = diffMatches(this.matches, incoming, now);
    this.matches = next;

    if (!isEmptyDiff(change)) {
      this.changes$.next(change);
      this.persist(change);
    }
    return change;
  }

  setSource(source: FeedSource, reason: string): void {
    if (source === this.currentSource) return;
    this.currentSource = source;
    this.logger.log(`Feed mode → ${source} (${reason})`);
    this.mode$.next({ source, reason });
  }

  getAll(): Match[] {
    return [...this.matches.values()];
  }

  byLeagues(leagues: readonly LeagueCode[]): Match[] {
    return this.getAll().filter((m) => leagues.includes(m.league));
  }

  get(id: string): Match | undefined {
    return this.matches.get(id);
  }

  /** Current match, or a recently finished one from MongoDB. */
  async findRecent(id: string): Promise<Match | undefined> {
    return this.matches.get(id) ?? (await this.repository.findById(id).catch(() => null)) ?? undefined;
  }

  private persist(change: FeedChange): void {
    if (!this.repository.enabled) return;
    const changed = [...change.added, ...change.patches.map((p) => this.matches.get(p.matchId)!)].filter(
      (m) => m && m.source === 'live',
    );
    this.repository
      .saveMany(changed)
      .catch((err) => this.logger.error(`Failed to persist ${changed.length} match(es): ${err.message}`));
  }
}
