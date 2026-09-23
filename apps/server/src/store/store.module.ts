import { DynamicModule, Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import type { AppConfig } from '../config/configuration';
import { MatchStore } from './match-store.service';
import { MATCH_REPOSITORY, NullMatchRepository } from './match.repository';
import { MatchDocument, MatchSchema, MongoMatchRepository } from './mongo-match.repository';
import {
  MongoResultsRepository,
  NullResultsRepository,
  RESULTS_REPOSITORY,
  ResultsDocument,
  ResultsSchema,
} from './results.repository';

@Global()
@Module({})
export class StoreModule {
  /** Wires MongoDB persistence only when a connection string is configured. */
  static forRoot(config: AppConfig): DynamicModule {
    const exports = [MatchStore, RESULTS_REPOSITORY];

    if (!config.mongoUri) {
      return {
        module: StoreModule,
        providers: [
          { provide: MATCH_REPOSITORY, useClass: NullMatchRepository },
          { provide: RESULTS_REPOSITORY, useClass: NullResultsRepository },
          MatchStore,
        ],
        exports,
      };
    }

    return {
      module: StoreModule,
      imports: [
        MongooseModule.forRoot(config.mongoUri, { serverSelectionTimeoutMS: 5000, retryAttempts: 3 }),
        MongooseModule.forFeature([
          { name: MatchDocument.name, schema: MatchSchema },
          { name: ResultsDocument.name, schema: ResultsSchema },
        ]),
      ],
      providers: [
        { provide: MATCH_REPOSITORY, useClass: MongoMatchRepository },
        { provide: RESULTS_REPOSITORY, useClass: MongoResultsRepository },
        MatchStore,
      ],
      exports,
    };
  }
}
