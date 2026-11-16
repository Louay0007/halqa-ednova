import { Err } from '../../common/http-errors';
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { APP_CONFIG } from '../../core/config/config.module';
import type { AppConfig } from '../../core/config/app-config';
import { AVATAR_KEYS } from '../../domain/ids';
import { signToken } from '../../security/tokens';
import { TokenEpochService } from '../../security/token-epoch.service';
import { Learner, LearnerDocument } from '../../persistence/schemas/learner.schema';

export interface LearnerView {
  id: string;
  nickname: string;
  avatarKey: string;
  context: string;
}

/**
 * AuthService — passport-free session tokens (plan D9). No password, no
 * sign-up, no PII: nickname + neutral avatar + context → HMAC token.
 * DNA completion (LearningService) writes the passport separately.
 *
 * Every read of the caller's own record goes through the id the guard verified,
 * never through a body field or a raw header re-check.
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @InjectModel(Learner.name) private readonly learners: Model<LearnerDocument>,
    private readonly epochs: TokenEpochService,
  ) {}

  async session(nickname: string, avatarKey: string, context: string): Promise<{ token: string; learner: LearnerView }> {
    const clean = nickname.slice(0, 24).trim();
    if (!clean) throw Err.bad('NICKNAME_EMPTY');
    const avatar = AVATAR_KEYS.includes(avatarKey as never) ? avatarKey : AVATAR_KEYS[clean.length % AVATAR_KEYS.length];
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const count = await this.learners.countDocuments().exec();
      const candidate = `L-${String(count + 1 + attempt).padStart(2, '0')}`;
      try {
        const doc = await this.learners.create({ _id: candidate, nickname: clean, avatarKey: avatar, context, lastSeenAt: new Date() });
        const token = signToken({ sub: doc._id, role: 'learner', ep: 0 }, this.cfg.TOKEN_SECRET);
        return { token, learner: { id: doc._id, nickname: clean, avatarKey: avatar, context } };
      } catch (e) {
        if ((e as { code?: number }).code !== 11000) throw e;
      }
    }
    throw new Error('LEARNER_ALLOC_FAILED');
  }

  async me(learnerId: string): Promise<{ learner: LearnerView; passport: unknown }> {
    const doc = await this.learners.findOne({ _id: learnerId }).lean().exec();
    if (!doc) throw Err.missing(`LEARNER_NOT_FOUND:${learnerId}`);
    return {
      learner: { id: doc._id, nickname: doc.nickname, avatarKey: doc.avatarKey, context: doc.context },
      passport: doc.passport ?? null,
    };
  }

  /** Only fields a learner may set about themselves — no ids, no passport. */
  async update(learnerId: string, patch: { avatarKey?: string; context?: string }): Promise<LearnerView> {
    const set: Record<string, unknown> = { lastSeenAt: new Date() };
    if (patch.avatarKey !== undefined) {
      if (!AVATAR_KEYS.includes(patch.avatarKey as never)) throw Err.bad(`AVATAR_UNKNOWN:${patch.avatarKey}`);
      set.avatarKey = patch.avatarKey;
    }
    if (patch.context !== undefined) set.context = patch.context;
    const doc = await this.learners.findOneAndUpdate({ _id: learnerId }, { $set: set }, { new: true }).lean().exec();
    if (!doc) throw Err.missing(`LEARNER_NOT_FOUND:${learnerId}`);
    return { id: doc._id, nickname: doc.nickname, avatarKey: doc.avatarKey, context: doc.context };
  }

  /** Bump the epoch: every token issued before this call stops working immediately. */
  async signout(learnerId: string): Promise<{ ok: true }> {
    await this.epochs.bump(learnerId);
    return { ok: true };
  }
}
