import { Err } from '../../common/http-errors';
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { APP_CONFIG } from '../../core/config/config.module';
import type { AppConfig } from '../../core/config/app-config';
import { AVATAR_KEYS } from '../../domain/ids';
import { HANDLE_RE, PASSPHRASE_MAX, PASSPHRASE_MIN, hashPassphrase, normaliseHandle, verifyPassphrase } from '../../security/credentials';
import { signToken } from '../../security/tokens';
import { TokenEpochService } from '../../security/token-epoch.service';
import { Learner, LearnerDocument } from '../../persistence/schemas/learner.schema';

export interface LearnerView {
  id: string;
  nickname: string;
  avatarKey: string;
  context: string;
  /** Chosen pseudonym, present only once the record is a real account. */
  handle: string | null;
}

const CONTEXTS = ['class', 'study', 'community', 'workshop', 'program', 'solo'] as const;

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
    const doc = await this.allocate(async (candidate) =>
      this.learners.create({ _id: candidate, nickname: clean, avatarKey: avatar, context, lastSeenAt: new Date() }),
    );
    const token = signToken({ sub: doc._id, role: 'learner', ep: doc.tokenEpoch ?? 0 }, this.cfg.TOKEN_SECRET);
    return { token, learner: { id: doc._id, nickname: doc.nickname, avatarKey: doc.avatarKey, context: doc.context, handle: doc.handle ?? null } };
  }

  /**
   * Turn this record into an account: claim a handle, set a passphrase. When a
   * token is already present the anonymous learner being upgraded is the one that
   * gets the credential, so progress made before signing up is not lost — the
   * epoch bumps so any token minted before the credential existed stops working.
   */
  async register(
    input: { handle: string; passphrase: string; nickname?: string; avatarKey: string; context: string },
    existingId?: string,
  ): Promise<{ token: string; learner: LearnerView }> {
    const handle = normaliseHandle(input.handle);
    if (!HANDLE_RE.test(handle)) throw Err.bad('HANDLE_INVALID');
    if (input.passphrase.length < PASSPHRASE_MIN || input.passphrase.length > PASSPHRASE_MAX) {
      throw Err.bad('PASSPHRASE_LENGTH');
    }
    // The default nickname is the handle as typed, so nothing has to be entered
    // twice to get an account.
    const nickname = (input.nickname ?? input.handle).slice(0, 24).trim() || handle;
    const avatar = AVATAR_KEYS.includes(input.avatarKey as never) ? input.avatarKey : AVATAR_KEYS[nickname.length % AVATAR_KEYS.length];
    const context = CONTEXTS.includes(input.context as never) ? input.context : 'study';
    const credential = await hashPassphrase(input.passphrase);
    // Checked up front as well as enforced by the unique index: on a fresh database
    // the index build is asynchronous, so relying on the index alone would let the
    // first duplicate through.
    if (await this.learners.exists({ handle })) throw Err.conflict('ACCOUNT_EXISTS');

    // An existing token only upgrades its own record, and only if that record has
    // not already claimed a handle — otherwise anyone could seize an account.
    if (existingId) {
      const upgraded = await this.learners
        .findOneAndUpdate(
          { _id: existingId, handle: { $exists: false } },
          { $set: { ...credential, handle, nickname, avatarKey: avatar, context, lastSeenAt: new Date() }, $inc: { tokenEpoch: 1 } },
          { new: true },
        )
        .lean()
        .exec();
      if (upgraded) {
        this.epochs.forget(existingId);
        const token = signToken({ sub: upgraded._id, role: 'learner', ep: upgraded.tokenEpoch ?? 0 }, this.cfg.TOKEN_SECRET);
        return { token, learner: view(upgraded) };
      }
      const already = await this.learners.exists({ _id: existingId, handle: { $exists: true } });
      if (already) throw Err.conflict('ACCOUNT_EXISTS');
    }

    const doc = await this.allocate(async (candidate) =>
      this.learners.create({ _id: candidate, nickname, avatarKey: avatar, context, handle, ...credential, lastSeenAt: new Date() }),
    );
    const token = signToken({ sub: doc._id, role: 'learner', ep: doc.tokenEpoch ?? 0 }, this.cfg.TOKEN_SECRET);
    return { token, learner: view(doc) };
  }

  /**
   * Sign in to an existing account. The handle is public within the app; the
   * passphrase is the only secret. A wrong handle and a wrong passphrase return
   * the same code so the endpoint cannot be used to enumerate accounts.
   */
  async login(handle: string, passphrase: string): Promise<{ token: string; learner: LearnerView }> {
    const clean = normaliseHandle(handle);
    const doc = await this.learners
      .findOne({ handle: clean })
      .select('+secretSalt +secretHash')
      .lean()
      .exec();
    if (!doc || !(await verifyPassphrase(passphrase, doc))) throw Err.denied('LOGIN_FAILED');
    // A sign-in is also a heartbeat: the epoch-tagged token below is always fresh.
    await this.learners.updateOne({ _id: doc._id }, { $set: { lastSeenAt: new Date() } }).exec();
    this.epochs.forget(doc._id);
    const token = signToken({ sub: doc._id, role: 'learner', ep: doc.tokenEpoch ?? 0 }, this.cfg.TOKEN_SECRET);
    return { token, learner: view(doc) };
  }

  async me(learnerId: string): Promise<{ learner: LearnerView; passport: unknown }> {
    const doc = await this.learners.findOne({ _id: learnerId }).lean().exec();
    if (!doc) throw Err.missing(`LEARNER_NOT_FOUND:${learnerId}`);
    return { learner: view(doc), passport: doc.passport ?? null };
  }

  /** Only fields a learner may set about themselves — no ids, no passport, no credential. */
  async update(learnerId: string, patch: { avatarKey?: string; context?: string }): Promise<LearnerView> {
    const set: Record<string, unknown> = { lastSeenAt: new Date() };
    if (patch.avatarKey !== undefined) {
      if (!AVATAR_KEYS.includes(patch.avatarKey as never)) throw Err.bad(`AVATAR_UNKNOWN:${patch.avatarKey}`);
      set.avatarKey = patch.avatarKey;
    }
    if (patch.context !== undefined) set.context = patch.context;
    const doc = await this.learners.findOneAndUpdate({ _id: learnerId }, { $set: set }, { new: true }).lean().exec();
    if (!doc) throw Err.missing(`LEARNER_NOT_FOUND:${learnerId}`);
    return view(doc);
  }

  /** Rotate the passphrase; the caller must prove the current one first. */
  async changePassphrase(learnerId: string, current: string, next: string): Promise<{ token: string }> {
    if (next.length < PASSPHRASE_MIN || next.length > PASSPHRASE_MAX) throw Err.bad('PASSPHRASE_LENGTH');
    const doc = await this.learners.findOne({ _id: learnerId }).select('+secretSalt +secretHash').lean().exec();
    if (!doc?.handle) throw Err.bad('ACCOUNT_REQUIRED');
    if (!(await verifyPassphrase(current, doc))) throw Err.denied('LOGIN_FAILED');
    const credential = await hashPassphrase(next);
    const rotated = await this.learners
      .findOneAndUpdate({ _id: learnerId }, { $set: credential, $inc: { tokenEpoch: 1 } }, { new: true })
      .select('tokenEpoch')
      .lean()
      .exec();
    // The bump signs out every other device. This one is handed a token at the new
    // epoch so changing a passphrase does not also eject the learner who changed it.
    this.epochs.forget(learnerId);
    return { token: signToken({ sub: learnerId, role: 'learner', ep: rotated?.tokenEpoch ?? 0 }, this.cfg.TOKEN_SECRET) };
  }

  /** Bump the epoch: every token issued before this call stops working immediately. */
  async signout(learnerId: string): Promise<{ ok: true }> {
    await this.epochs.bump(learnerId);
    return { ok: true };
  }

  /** Unique L-## ids: count-based candidate with a duplicate-key retry loop. */
  private async allocate<T>(create: (candidate: string) => Promise<T>): Promise<T> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const count = await this.learners.countDocuments().exec();
      const candidate = `L-${String(count + 1 + attempt).padStart(2, '0')}`;
      try {
        return await create(candidate);
      } catch (e) {
        if ((e as { code?: number }).code !== 11000) throw e;
        // A clashing `_id` is the sequence racing another insert — retry. Any other
        // duplicate key is the unique handle index, which is a real conflict.
        if (!(await this.learners.exists({ _id: candidate }))) throw Err.conflict('ACCOUNT_EXISTS');
        lastError = e;
      }
    }
    throw lastError ?? new Error('LEARNER_ALLOC_FAILED');
  }
}

function view(doc: {
  _id: string;
  nickname: string;
  avatarKey: string;
  context: string;
  handle?: string;
}): LearnerView {
  return { id: doc._id, nickname: doc.nickname, avatarKey: doc.avatarKey, context: doc.context, handle: doc.handle ?? null };
}

