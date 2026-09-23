import { Injectable } from '@nestjs/common';
import { InjectModel, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Match } from '@scoreboard/shared';
import { Model, Schema as MongooseSchema } from 'mongoose';
import type { MatchRepository } from './match.repository';

const RETENTION_SECONDS = 48 * 3600;

/**
 * One document per match. The full match is kept as a sub-document; a few fields
 * are copied to the top level for querying and for the TTL index.
 */
@Schema({ collection: 'matches', versionKey: false })
export class MatchDocument {
  @Prop({ type: String })
  _id: string;

  @Prop({ index: true })
  league: string;

  @Prop()
  status: string;

  @Prop({ type: Date, expires: RETENTION_SECONDS })
  updatedAt: Date;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  data: Match;
}

export const MatchSchema = SchemaFactory.createForClass(MatchDocument);

@Injectable()
export class MongoMatchRepository implements MatchRepository {
  readonly enabled = true;

  constructor(@InjectModel(MatchDocument.name) private readonly model: Model<MatchDocument>) {}

  async loadRecent(since: Date): Promise<Match[]> {
    const docs = await this.model.find({ updatedAt: { $gte: since } }).lean();
    return docs.map((d) => d.data);
  }

  async findById(id: string): Promise<Match | null> {
    const doc = await this.model.findById(id).lean();
    return doc?.data ?? null;
  }

  async saveMany(matches: Match[]): Promise<void> {
    if (matches.length === 0) return;
    await this.model.bulkWrite(
      matches.map((m) => ({
        replaceOne: {
          filter: { _id: m.id },
          replacement: { _id: m.id, league: m.league, status: m.status, updatedAt: new Date(m.updatedAt), data: m },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }
}
