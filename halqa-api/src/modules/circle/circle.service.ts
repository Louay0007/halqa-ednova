import { Err } from '../../common/http-errors';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { APP_CONFIG } from '../../core/config/config.module';
import type { AppConfig } from '../../core/config/app-config';
import type { ContextMode, Language } from '../../common/types/api-error';
import { contextConfig, ContextConfig } from '../../domain/context-modes';
import { AVATAR_KEYS, joinCode } from '../../domain/ids';
import { signToken, TokenRole } from '../../security/tokens';
import { TokenEpochService } from '../../security/token-epoch.service';
import { Circle, CircleDocument } from '../../persistence/schemas/circle.schema';
import { Learner, LearnerDocument } from '../../persistence/schemas/learner.schema';
import { Session, SessionDocument } from '../../persistence/schemas/session.schema';
import { EquityService } from '../equity/equity.service';
import { SbuService } from '../sbu/sbu.service';

/**
 * CircleService (3.1) — circles, join codes, roles, context configs,
 * circle health (latest session S-B-U + credits + needs_human).
 */
@Injectable()
export class CircleService {
  private readonly logger = new Logger(CircleService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @InjectModel(Circle.name) private readonly circles: Model<CircleDocument>,
    @InjectModel(Learner.name) private readonly learners: Model<LearnerDocument>,
    @InjectModel(Session.name) private readonly sessions: Model<SessionDocument>,
    private readonly equity: EquityService,
    private readonly sbu: SbuService,
    private readonly epochs: TokenEpochService,
  ) {}

  async create(input: {
    topic: string;
    context: ContextMode;
    lang: Language;
    title?: string;
    windowS?: number;
    /** Ignored when `actorId` is present: a signed-in learner hosts as themselves. */
    hostNickname?: string;
    actorId?: string;
  }): Promise<{ circle: CircleDocument; hostLearnerId: string; token: string }> {
    const windowS = Math.min(90, Math.max(30, input.windowS ?? 45));
    const host = await this.resolveActor(input.actorId, input.hostNickname, input.context);
    let code = joinCode();
    for (let i = 0; i < 5; i += 1) {
      try {
        const circle = await this.circles.create({
          _id: `C-${Date.now().toString(36)}${i}`,
          topic: input.topic,
          title: input.title ?? `${input.topic} circle`,
          context: input.context,
          lang: input.lang,
          state: 'open',
          windowS,
          hostLearnerId: host._id,
          members: [{ learnerId: host._id, role: 'host', joinedAt: new Date() }],
          joinCode: code,
        });
        const token = await this.mintToken(host);
        return { circle, hostLearnerId: host._id, token };
      } catch (e) {
        if ((e as { code?: number }).code !== 11000) throw e;
        code = joinCode();
      }
    }
    throw new Error('CIRCLE_CREATE_FAILED');
  }

  /**
   * Join a circle. A signed-in caller joins as themselves (`actorId`) and keeps
   * their passport; an anonymous caller still mints a learner from the nickname
   * so the join screen works before an account exists.
   */
  async join(circleId: string, nickname: string | undefined, actorId?: string, passportFrom?: string): Promise<{ learnerId: string; role: string; token: string }> {
    const circle = await this.circles.findOne({ _id: circleId }).exec();
    if (!circle) throw Err.missing(`CIRCLE_NOT_FOUND:${circleId}`);
    if (circle.state === 'wrapped') throw Err.conflict(`CIRCLE_CLOSED:${circleId}`);

    if (actorId && circle.members.some((m) => m.learnerId === actorId)) {
      const member = await this.learners.findOne({ _id: actorId }).lean().exec();
      if (!member) throw Err.missing(`LEARNER_NOT_FOUND:${actorId}`);
      return { learnerId: member._id, role: circle.members.find((m) => m.learnerId === actorId)!.role, token: await this.mintToken(member) };
    }

    if (!nickname) throw Err.bad('NICKNAME_EMPTY');
    const memberIds = circle.members.map((m) => m.learnerId);
    const existing = await this.learners.find({ _id: { $in: memberIds } }).lean().exec();
    if (existing.some((l) => l.nickname.toLowerCase() === nickname.toLowerCase())) {
      throw Err.conflict('NICKNAME_TAKEN');
    }
    const donor = passportFrom ? await this.learners.findOne({ _id: passportFrom }).lean().exec() : null;
    const learner = actorId
      ? await this.adoptActor(actorId, nickname, circle.context as ContextMode)
      : await this.makeLearner(nickname, circle.context as ContextMode, donor?.passport as LearnerDocument['passport'] | undefined);
    circle.members.push({ learnerId: learner._id, role: 'peer', joinedAt: new Date() });
    await circle.save();
    const token = await this.mintToken(learner);
    return { learnerId: learner._id, role: 'peer', token };
  }

  async get(circleId: string): Promise<unknown> {
    const circle = await this.circles.findOne({ _id: circleId }).lean().exec();
    if (!circle) throw Err.missing(`CIRCLE_NOT_FOUND:${circleId}`);
    const learners = await this.learners.find({ _id: { $in: circle.members.map((m) => m.learnerId) } }).lean().exec();
    const byId = new Map(learners.map((l) => [l._id, l.nickname]));
    return { ...circle, members: circle.members.map((m) => ({ ...m, nickname: byId.get(m.learnerId) ?? '?' })) };
  }

  configFor(mode: ContextMode): ContextConfig {
    return contextConfig(mode);
  }

  /** Resolve a 6-char join code → circle id (read-only, for the join screen). */
  async byCode(code: string): Promise<{ circleId: string; topic: string; members: number }> {
    const circle = await this.circles.findOne({ joinCode: code.trim().toUpperCase() }).lean().exec();
    if (!circle) throw Err.missing('CIRCLE_CODE_UNKNOWN');
    return { circleId: circle._id, topic: circle.topic, members: circle.members.length };
  }

  /** Circle health from the latest session (mentor/teacher view). */
  async health(circleId: string): Promise<{
    sessionId: string;
    S: number;
    B: number;
    U: number;
    tiers: { S: string; B: string; U: string };
    credits: Array<{ learnerId: string; total: number }>;
    needsHuman: boolean;
  }> {
    const session = await this.sessions.findOne({ circleId }).sort({ startedAt: -1 }).exec();
    if (!session) throw Err.missing(`NO_SESSION:${circleId}`);
    const view = await this.sbu.recompute(session._id);
    const credits = await this.equity.totals(session._id);
    return {
      sessionId: session._id,
      S: view.S,
      B: view.B,
      U: view.U,
      tiers: view.tiers,
      credits: credits.map((c) => ({ learnerId: c.learnerId, total: c.total })),
      needsHuman: view.needsHuman,
    };
  }

  /** A token must carry the learner's live epoch, or a revoked token would be re-issued. */
  private async mintToken(learner: { _id: string }): Promise<string> {
    const epoch = (await this.epochs.current(learner._id)) ?? 0;
    return signToken({ sub: learner._id, role: 'learner' as TokenRole, ep: epoch }, this.cfg.TOKEN_SECRET);
  }

  /** Signed-in host/peer: reuse the caller's learner instead of minting a second one. */
  private async resolveActor(actorId: string | undefined, nickname: string | undefined, context: string): Promise<LearnerDocument> {
    if (actorId) return this.adoptActor(actorId, nickname, context);
    if (!nickname) throw Err.bad('NICKNAME_EMPTY');
    return this.makeLearner(nickname, context);
  }

  /** Point an existing learner at this circle context, refreshing a nickname if one is given. */
  private async adoptActor(actorId: string, nickname: string | undefined, context: string): Promise<LearnerDocument> {
    const set: Record<string, unknown> = { context, lastSeenAt: new Date() };
    if (nickname) set.nickname = nickname.slice(0, 24);
    const doc = await this.learners.findOneAndUpdate({ _id: actorId }, { $set: set }, { new: true }).exec();
    if (!doc) throw Err.missing(`LEARNER_NOT_FOUND:${actorId}`);
    return doc;
  }

  private async makeLearner(nickname: string, context: string, passport?: LearnerDocument['passport']): Promise<LearnerDocument> {
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const count = await this.learners.countDocuments().exec();
      const candidate = `L-${String(count + 1 + attempt).padStart(2, '0')}`;
      try {
        return await this.learners.create({
          _id: candidate,
          nickname: nickname.slice(0, 24),
          avatarKey: AVATAR_KEYS[candidate.charCodeAt(3) % AVATAR_KEYS.length],
          context,
          lastSeenAt: new Date(),
          ...(passport ? { passport } : {}),
        });
      } catch (e) {
        if ((e as { code?: number }).code !== 11000) throw e;
      }
    }
    throw new Error('LEARNER_ALLOC_FAILED');
  }
}
