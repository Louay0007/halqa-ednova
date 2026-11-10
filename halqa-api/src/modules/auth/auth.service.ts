import { Err } from '../../common/http-errors';
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { APP_CONFIG } from '../../core/config/config.module';
import type { AppConfig } from '../../core/config/app-config';
import { AVATAR_KEYS } from '../../domain/ids';
import { signToken, verifyToken } from '../../security/tokens';
import { Learner, LearnerDocument } from '../../persistence/schemas/learner.schema';

/**
 * AuthService — passport-free session tokens (plan D9). No password, no
 * sign-up, no PII: nickname + neutral avatar + context → HMAC token.
 * DNA completion (LearningService) writes the passport separately.
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @InjectModel(Learner.name) private readonly learners: Model<LearnerDocument>,
  ) {}

  async session(nickname: string, avatarKey: string, context: string): Promise<{ token: string; learner: { id: string; nickname: string; avatarKey: string } }> {
    const clean = nickname.slice(0, 24).trim();
    if (!clean) throw Err.bad('NICKNAME_EMPTY');
    const avatar = AVATAR_KEYS.includes(avatarKey as never) ? avatarKey : AVATAR_KEYS[clean.length % AVATAR_KEYS.length];
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const count = await this.learners.countDocuments().exec();
      const candidate = `L-${String(count + 1 + attempt).padStart(2, '0')}`;
      try {
        const doc = await this.learners.create({ _id: candidate, nickname: clean, avatarKey: avatar, context, lastSeenAt: new Date() });
        const token = signToken({ sub: doc._id, role: 'learner' }, this.cfg.TOKEN_SECRET);
        return { token, learner: { id: doc._id, nickname: clean, avatarKey: avatar } };
      } catch (e) {
        if ((e as { code?: number }).code !== 11000) throw e;
      }
    }
    throw new Error('LEARNER_ALLOC_FAILED');
  }

  async me(token: string): Promise<{ learner: unknown; passport: unknown }> {
    const body = verifyToken(token, this.cfg.TOKEN_SECRET);
    if (!body) throw Err.denied('AUTH_INVALID');
    const doc = await this.learners.findOne({ _id: body.sub }).lean().exec();
    if (!doc) throw Err.missing(`LEARNER_NOT_FOUND:${body.sub}`);
    return { learner: { id: doc._id, nickname: doc.nickname, avatarKey: doc.avatarKey, context: doc.context }, passport: doc.passport ?? null };
  }
}
