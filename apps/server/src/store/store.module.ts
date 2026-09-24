import { DynamicModule, Global, Logger, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
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

/** The database named in the URI, or "scoreboard" (Atlas's copied string has none, which would mean "test"). */
function databaseName(uri: string): string {
  try {
    return decodeURIComponent(new URL(uri).pathname.slice(1)) || 'scoreboard';
  } catch {
    return 'scoreboard';
  }
}

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
        MongooseModule.forRoot(config.mongoUri, {
          serverSelectionTimeoutMS: 5000,
          dbName: databaseName(config.mongoUri),
          // Connect in the background: an unreachable database must never stop the
          // scoreboard from starting. Reads/writes fail softly and the app runs from memory.
          lazyConnection: true,
          // connectionFactory (unlike onConnectionCreate) also runs for lazy connections.
          connectionFactory: (connection: Connection) => {
            const logger = new Logger('MongoDB');
            connection.on('connected', () => logger.log('Connected'));
            connection.on('disconnected', () => logger.warn('Disconnected; running from memory until it is back'));
            connection.on('error', (err: Error) => logger.error(`Connection error: ${err.message}`));
            // The initial connect runs unawaited; handle its failure here so it can't crash the process.
            connection
              .asPromise()
              .catch((err: Error) =>
                logger.error(`Could not connect (${err.message}). Running from memory; check MONGO_URI.`),
              );
            return connection;
          },
        }),
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
