import type { Match } from '@scoreboard/shared';

export const MATCH_REPOSITORY = Symbol('MATCH_REPOSITORY');

/** Persistence for recent real matches. Optional: the app runs fine without it. */
export interface MatchRepository {
  readonly enabled: boolean;
  loadRecent(since: Date): Promise<Match[]>;
  findById(id: string): Promise<Match | null>;
  saveMany(matches: Match[]): Promise<void>;
}

/** Used when MONGO_URI isn't set: everything lives in memory only. */
export class NullMatchRepository implements MatchRepository {
  readonly enabled = false;
  async loadRecent(): Promise<Match[]> {
    return [];
  }
  async findById(): Promise<Match | null> {
    return null;
  }
  async saveMany(): Promise<void> {}
}
