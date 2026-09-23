import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import type { LeagueCode, LeagueResults, MatchResult } from '@scoreboard/shared';
import { LEAGUE_CODES } from '@scoreboard/shared';
import { Subject, type Subscription } from 'rxjs';
import { APP_CONFIG, type AppConfig } from '../config/configuration';
import { FootballDataClient } from '../providers/football-data/football-data.client';
import { latestMatchday } from '../providers/football-data/football-data.mapper';
import { MatchStore } from '../store/match-store.service';
import { RESULTS_REPOSITORY, type ResultsRepository } from '../store/results.repository';

/** football-data.org takes a moment to mark a match FINISHED after the whistle. */
const REFRESH_AFTER_FULL_TIME_MS = 3 * 60_000;

/**
 * Keeps the latest real matchday's results for each league.
 *
 * Results change rarely, so they're refreshed on a slow timer (one request per
 * league every RESULTS_REFRESH_MS) and shortly after a live real match finishes.
 * Clients get them pushed over the socket, like everything else.
 */
@Injectable()
export class ResultsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ResultsService.name);
  private readonly byLeague = new Map<LeagueCode, LeagueResults>();
  private timer?: NodeJS.Timeout;
  private readonly followUps = new Map<LeagueCode, NodeJS.Timeout>();
  private storeSubscription?: Subscription;

  readonly changes$ = new Subject<LeagueResults[]>();

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly client: FootballDataClient,
    private readonly store: MatchStore,
    @Inject(RESULTS_REPOSITORY) private readonly repository: ResultsRepository,
  ) {}

  /** In league order; leagues without data are omitted. */
  get all(): LeagueResults[] {
    return LEAGUE_CODES.map((code) => this.byLeague.get(code)).filter((r): r is LeagueResults => r !== undefined);
  }

  onApplicationBootstrap(): void {
    if (!this.client.enabled) return; // Results are real data only; the demo feed doesn't invent them.

    // Don't hold up server start-up on the network.
    void this.warmUp();
    this.timer = setInterval(() => void this.refreshAll(), this.config.resultsRefreshMs);

    // When a real match reaches full time, pick up the new result soon rather than in 30 minutes.
    this.storeSubscription = this.store.changes$.subscribe(({ patches }) => {
      for (const patch of patches) {
        if (patch.changes.status === 'FINISHED' && this.store.get(patch.matchId)?.source === 'live') {
          this.scheduleFollowUp(patch.league);
        }
      }
    });
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
    this.followUps.forEach(clearTimeout);
    this.storeSubscription?.unsubscribe();
  }

  private async warmUp(): Promise<void> {
    await this.loadCached();
    if (this.byLeague.size) this.changes$.next(this.all);

    // Refresh leagues whose cache is missing or old, one after another to spread quota use.
    for (const league of LEAGUE_CODES) {
      const cached = this.byLeague.get(league);
      const age = cached ? Date.now() - Date.parse(cached.fetchedAt) : Infinity;
      if (age >= this.config.resultsRefreshMs) await this.refresh(league);
    }
  }

  private async refreshAll(): Promise<void> {
    for (const league of LEAGUE_CODES) await this.refresh(league);
  }

  private async refresh(league: LeagueCode): Promise<void> {
    try {
      const latest = latestMatchday(await this.client.fetchResults(league));
      if (!latest) return;

      const next: LeagueResults = { league, ...latest, fetchedAt: new Date().toISOString() };
      const previous = this.byLeague.get(league);
      this.byLeague.set(league, next);

      if (previous && previous.matchday === next.matchday && sameResults(previous.results, next.results)) {
        // Nothing changed for clients; just remember that the cache is fresh.
        await this.repository.save(next).catch(() => undefined);
        return;
      }

      this.logger.log(`${league} results: matchday ${next.matchday}, ${next.results.length} match(es)`);
      this.changes$.next(this.all);
      await this.repository.save(next).catch((err) => this.logger.error(`Failed to cache results: ${err.message}`));
    } catch (err) {
      this.logger.warn(`Could not refresh ${league} results: ${(err as Error).message}`);
    }
  }

  private scheduleFollowUp(league: LeagueCode): void {
    clearTimeout(this.followUps.get(league));
    this.followUps.set(
      league,
      setTimeout(() => void this.refresh(league), REFRESH_AFTER_FULL_TIME_MS),
    );
  }

  private async loadCached(): Promise<void> {
    if (!this.repository.enabled) return;
    try {
      for (const cached of await this.repository.loadAll()) this.byLeague.set(cached.league, cached);
      if (this.byLeague.size) this.logger.log(`Loaded cached results for ${[...this.byLeague.keys()].join(', ')}`);
    } catch (err) {
      this.logger.warn(`Could not load cached results: ${(err as Error).message}`);
    }
  }
}

function sameResults(a: MatchResult[], b: MatchResult[]): boolean {
  return (
    a.length === b.length &&
    a.every((r, i) => r.id === b[i].id && r.score.home === b[i].score.home && r.score.away === b[i].score.away)
  );
}
