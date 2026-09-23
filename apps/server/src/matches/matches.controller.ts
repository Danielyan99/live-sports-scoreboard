import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { isLeagueCode, LEAGUE_CODES, type LeagueResults, type Match } from '@scoreboard/shared';
import { LiveGateway } from '../realtime/live.gateway';
import { ResultsService } from '../results/results.service';
import { MatchStore } from '../store/match-store.service';

/**
 * Plain REST reads. The web app uses sockets; these are handy for debugging,
 * health checks and anyone who wants to curl the current state.
 */
@Controller()
export class MatchesController {
  constructor(
    private readonly store: MatchStore,
    private readonly gateway: LiveGateway,
    private readonly results: ResultsService,
  ) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      source: this.store.source,
      matches: this.store.getAll().length,
      clients: this.gateway.connectedClients,
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  @Get('api/matches')
  list(@Query('league') league?: string): { source: string; matches: Match[] } {
    const leagues = isLeagueCode(league) ? [league] : LEAGUE_CODES;
    return { source: this.store.source, matches: this.store.byLeagues(leagues) };
  }

  @Get('api/results')
  recentResults(): { leagues: LeagueResults[] } {
    return { leagues: this.results.all };
  }

  @Get('api/matches/:id')
  async get(@Param('id') id: string): Promise<Match> {
    const match = await this.store.findRecent(id);
    if (!match) throw new NotFoundException(`Match ${id} not found`);
    return match;
  }
}
