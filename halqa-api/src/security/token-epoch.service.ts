import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Learner, LearnerDocument } from '../persistence/schemas/learner.schema';

/**
 * Token revocation without a session table.
 *
 * Every learner carries a `tokenEpoch`. A token embeds the epoch it was signed
 * with (`ep`); bumping the stored epoch invalidates every token issued before
 * the bump. The lookup is cached briefly so a hot loop does not query Mongo per
 * request, and `bump()` evicts immediately so sign-out takes effect at once.
 */
@Injectable()
export class TokenEpochService {
  private static readonly TTL_MS = 15_000;
  private readonly cache = new Map<string, { epoch: number; at: number }>();

  constructor(@InjectModel(Learner.name) private readonly learners: Model<LearnerDocument>) {}

  /** Current epoch for a learner, or `null` when the learner does not exist. */
  async current(learnerId: string): Promise<number | null> {
    const hit = this.cache.get(learnerId);
    if (hit && Date.now() - hit.at < TokenEpochService.TTL_MS) return hit.epoch;
    const doc = await this.learners.findOne({ _id: learnerId }).select('tokenEpoch').lean().exec();
    if (!doc) {
      this.cache.delete(learnerId);
      return null;
    }
    const epoch = doc.tokenEpoch ?? 0;
    this.cache.set(learnerId, { epoch, at: Date.now() });
    return epoch;
  }

  /** Invalidate every token issued for this learner and return the new epoch. */
  async bump(learnerId: string): Promise<number> {
    const doc = await this.learners
      .findOneAndUpdate({ _id: learnerId }, { $inc: { tokenEpoch: 1 } }, { new: true })
      .select('tokenEpoch')
      .lean()
      .exec();
    if (!doc) return 0;
    const epoch = doc.tokenEpoch ?? 0;
    this.cache.set(learnerId, { epoch, at: Date.now() });
    return epoch;
  }

  /** Test helper: drop the cache so the next read hits the database. */
  forget(learnerId?: string): void {
    if (learnerId) this.cache.delete(learnerId);
    else this.cache.clear();
  }
}
