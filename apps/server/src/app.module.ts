import { DynamicModule, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from './config/configuration';
import { IngestionService } from './ingestion/ingestion.service';
import { MatchesController } from './matches/matches.controller';
import { FootballDataClient } from './providers/football-data/football-data.client';
import { LiveGateway } from './realtime/live.gateway';
import { ResultsService } from './results/results.service';
import { StoreModule } from './store/store.module';

@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [StoreModule.forRoot(config)],
      controllers: [MatchesController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        FootballDataClient,
        IngestionService,
        ResultsService,
        LiveGateway,
      ],
    };
  }
}
