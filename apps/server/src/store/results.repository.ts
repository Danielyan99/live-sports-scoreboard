import { Injectable } from '@nestjs/common';
import { InjectModel, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { LeagueResults } from '@scoreboard/shared';
import { Model, Schema as MongooseSchema } from 'mongoose';

export const RESULTS_REPOSITORY = Symbol('RESULTS_REPOSITORY');

/** Caches each league's latest matchday so a restart doesn't need to spend API quota. */
export interface ResultsRepository {
  readonly enabled: boolean;
  loadAll(): Promise<LeagueResults[]>;
  save(results: LeagueResults): Promise<void>;
}

export class NullResultsRepository implements ResultsRepository {
  readonly enabled = false;
  async loadAll(): Promise<LeagueResults[]> {
    return [];
  }
  async save(): Promise<void> {}
}

/** One document per league, replaced on every change. */
@Schema({ collection: 'results', versionKey: false })
export class ResultsDocument {
  @Prop({ type: String })
  _id: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  data: LeagueResults;
}

export const ResultsSchema = SchemaFactory.createForClass(ResultsDocument);

@Injectable()
export class MongoResultsRepository implements ResultsRepository {
  readonly enabled = true;

  constructor(@InjectModel(ResultsDocument.name) private readonly model: Model<ResultsDocument>) {}

  async loadAll(): Promise<LeagueResults[]> {
    const docs = await this.model.find().lean();
    return docs.map((d) => d.data);
  }

  async save(results: LeagueResults): Promise<void> {
    await this.model.replaceOne({ _id: results.league }, { _id: results.league, data: results }, { upsert: true });
  }
}
