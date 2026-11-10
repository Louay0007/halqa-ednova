import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { buildCacheKey, CacheKeyInput } from '../../domain/cache-key';
import { CacheEntry, CacheEntryDocument } from '../../persistence/schemas/ai.schema';

export interface CacheHit<T = Record<string, unknown>> {
  value: T;
  cites: string[];
}

/**
 * Semantic cache (plan §6.5). Key = sha1(normalise(intent)+level+lang+
 * sorted(chunkIds)+ladderState); TTL via expiresAt index (session-scoped for
 * answers, long-lived for probes/glossary).
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@InjectModel(CacheEntry.name) private readonly cache: Model<CacheEntryDocument>) {}

  keyOf(input: CacheKeyInput): string {
    return buildCacheKey(input);
  }

  async get<T = Record<string, unknown>>(key: string): Promise<CacheHit<T> | null> {
    const doc = await this.cache.findOne({ _id: key }).lean().exec();
    if (!doc || new Date(doc.expiresAt) <= new Date()) return null;
    await this.cache.updateOne({ _id: key }, { $inc: { hits: 1 } }).exec();
    return { value: doc.value as T, cites: doc.cites ?? [] };
  }

  async set(key: string, value: Record<string, unknown>, cites: string[], ttlS: number, tier = 'C'): Promise<void> {
    await this.cache
      .updateOne(
        { _id: key },
        {
          $set: {
            _id: key,
            value,
            cites,
            tier,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + ttlS * 1000),
          },
        },
        { upsert: true },
      )
      .exec();
  }
}
