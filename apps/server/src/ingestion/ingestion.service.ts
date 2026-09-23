import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import type { Match } from '@scoreboard/shared';
import { isInPlay } from '@scoreboard/shared';
import { APP_CONFIG, type AppConfig } from '../config/configuration';
import { FootballDataClient, RateLimitedError } from '../providers/football-data/football-data.client';
import { MatchSimulator } from '../providers/simulator/match-simulator';
import { MatchStore } from '../store/match-store.service';

/**
 * Drives the data pipeline:  provider → diff engine (in MatchStore) → socket gateway.
 *
 * - While real matches are in play, polls football-data.org every POLL_INTERVAL_MS.
 * - Otherwise runs the simulator, and probes the real API every PROBE_INTERVAL_MS
 *   to switch back automatically as soon as a real match kicks off.
 * Both feeds go through exactly the same diff + push path.
 */
@Injectable()
export class IngestionService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(IngestionService.name);
  private simulator?: MatchSimulator;
  private simTimer?: NodeJS.Timeout;
  private pollTimer?: NodeJS.Timeout;
  private stopped = false;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly client: FootballDataClient,
    private readonly store: MatchStore,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.store.warmStart();

    if (this.config.forceDemo) return this.startDemo('FORCE_DEMO is enabled');
    if (!this.client.enabled) return this.startDemo('No FOOTBALL_DATA_TOKEN configured');

    await this.pollRealFeed();
  }

  onModuleDestroy(): void {
    this.stopped = true;
    clearTimeout(this.pollTimer);
    this.stopDemo();
  }

  private async pollRealFeed(): Promise<void> {
    let nextDelay = this.config.probeIntervalMs;
    try {
      const previous = new Map(
        this.store
          .getAll()
          .filter((m) => m.source === 'live')
          .map((m) => [m.id, m]),
      );
      const matches = await this.client.fetchMatches(previous);
      const inPlay = matches.filter(isInPlay).length;

      if (inPlay > 0) {
        this.stopDemo();
        this.store.setSource('live', `${inPlay} match(es) in play`);
        this.store.ingest(matches);
        nextDelay = this.config.pollIntervalMs;
      } else {
        // Publish final whistles before handing over to the simulator.
        if (this.store.source === 'live') this.store.ingest(matches);
        this.startDemo('No real matches in play right now');
      }
    } catch (err) {
      if (err instanceof RateLimitedError) nextDelay = Math.max(nextDelay, err.retryAfterMs);
      this.logger.warn(`Real feed poll failed: ${(err as Error).message}`);
      // Never leave visitors with an empty board: fall back to the demo if we have nothing live.
      if (this.store.source !== 'live' || this.store.getAll().length === 0) {
        this.startDemo('Live feed unavailable');
      }
    } finally {
      this.scheduleNextPoll(nextDelay);
    }
  }

  private scheduleNextPoll(delayMs: number): void {
    if (this.stopped) return;
    clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => void this.pollRealFeed(), delayMs);
  }

  private startDemo(reason: string): void {
    this.store.setSource('demo', reason);
    if (this.simulator) return;

    const simulator = new MatchSimulator({ tickMs: this.config.simTickMs });
    this.simulator = simulator;
    this.ingest(simulator.getMatches());
    this.store.setTables(simulator.getTables());

    let tablesRevision = simulator.tablesRevision;
    this.simTimer = setInterval(() => {
      simulator.tick();
      this.ingest(simulator.getMatches());
      // Tables change only at full time; push them only then.
      if (simulator.tablesRevision !== tablesRevision) {
        tablesRevision = simulator.tablesRevision;
        this.store.setTables(simulator.getTables());
      }
    }, this.config.simTickMs);
  }

  private stopDemo(): void {
    if (!this.simulator) return;
    clearInterval(this.simTimer);
    this.simTimer = undefined;
    this.simulator = undefined;
    this.store.setTables([]); // The demo table has no meaning next to real matches.
  }

  private ingest(matches: Match[]): void {
    const { added, removed, patches } = this.store.ingest(matches);
    if (added.length || removed.length) {
      this.logger.debug(`+${added.length} −${removed.length} ~${patches.length}`);
    }
  }
}
