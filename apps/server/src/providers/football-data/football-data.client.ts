import { Inject, Injectable, Logger } from '@nestjs/common';
import type { LeagueCode, Match, MatchResult } from '@scoreboard/shared';
import { LEAGUE_CODES } from '@scoreboard/shared';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { mapFdMatch, mapFdResult, type FdMatchesResponse } from './football-data.mapper';

const BASE_URL = 'https://api.football-data.org/v4';

export class RateLimitedError extends Error {
  constructor(readonly retryAfterMs: number) {
    super(`football-data.org rate limit reached, retry in ${Math.round(retryAfterMs / 1000)}s`);
  }
}

/**
 * Fetches today's Premier League + La Liga matches from football-data.org.
 * One request covers both leagues, which keeps us far below the free-tier limit.
 */
@Injectable()
export class FootballDataClient {
  private readonly logger = new Logger(FootballDataClient.name);
  private blockedUntil = 0;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  get enabled(): boolean {
    return Boolean(this.config.footballDataToken);
  }

  async fetchMatches(previous: ReadonlyMap<string, Match>, now = new Date()): Promise<Match[]> {
    // Use a window around "today" in UTC so late kick-offs in other time zones are included.
    const from = new Date(now.getTime() - 12 * 3600_000).toISOString().slice(0, 10);
    const to = new Date(now.getTime() + 12 * 3600_000).toISOString().slice(0, 10);
    const body = await this.get(`/matches?competitions=${LEAGUE_CODES.join(',')}&dateFrom=${from}&dateTo=${to}`);

    return body.matches
      .map((raw) => mapFdMatch(raw, previous.get(`fd-${raw.id}`), now))
      .filter((m): m is Match => m !== null);
  }

  /** Every finished match of the current season for one league (~70 KB, cheap on quota: one request). */
  async fetchResults(league: LeagueCode): Promise<MatchResult[]> {
    const body = await this.get(`/competitions/${league}/matches?status=FINISHED`);
    return body.matches.map(mapFdResult).filter((r): r is MatchResult => r !== null);
  }

  private async get(path: string): Promise<FdMatchesResponse> {
    if (!this.enabled) throw new Error('FOOTBALL_DATA_TOKEN is not configured');
    if (Date.now() < this.blockedUntil) throw new RateLimitedError(this.blockedUntil - Date.now());

    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'X-Auth-Token': this.config.footballDataToken! },
      signal: AbortSignal.timeout(10_000),
    });

    this.trackQuota(res);

    if (res.status === 429) {
      const resetSeconds = Number(res.headers.get('x-requestcounter-reset')) || 60;
      this.blockedUntil = Date.now() + resetSeconds * 1000;
      throw new RateLimitedError(resetSeconds * 1000);
    }
    if (!res.ok) throw new Error(`football-data.org responded ${res.status}: ${await res.text()}`);

    return (await res.json()) as FdMatchesResponse;
  }

  /** Reads the quota headers and pauses proactively before the API starts returning 429s. */
  private trackQuota(res: Response): void {
    const remaining = Number(res.headers.get('x-requests-available-minute'));
    const resetSeconds = Number(res.headers.get('x-requestcounter-reset'));
    if (!Number.isFinite(remaining)) return;

    this.logger.debug(`football-data.org quota: ${remaining} requests left this minute`);
    if (remaining <= 1 && Number.isFinite(resetSeconds)) {
      this.blockedUntil = Date.now() + resetSeconds * 1000;
      this.logger.warn(`Quota nearly exhausted, pausing real-feed polling for ${resetSeconds}s`);
    }
  }
}
