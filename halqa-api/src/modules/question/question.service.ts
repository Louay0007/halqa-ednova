import { Err } from '../../common/http-errors';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash } from 'crypto';
import { buildCacheKey } from '../../domain/cache-key';
import { detectRegister } from '../../domain/arabizi';
import { screenPii } from '../../domain/pii';
import { LLM_PORT, LlmPort } from '../../domain/ports/llm-port';
import { BudgetGovernor } from '../../ai/governor/budget.governor';
import { CacheService } from '../../ai/cache/cache.service';
import { RouterService } from '../../ai/router/router.service';
import { PeerWindowService } from '../peer-window/peer-window.service';
import { HintService } from '../hints/hint.service';
import { EquityService } from '../equity/equity.service';
import { Circle, CircleDocument } from '../../persistence/schemas/circle.schema';
import { Session, SessionDocument } from '../../persistence/schemas/session.schema';
import { Learner, LearnerDocument } from '../../persistence/schemas/learner.schema';
import { PeerAnswer, PeerAnswerDocument } from '../../persistence/schemas/interaction.schema';
import { Question, QuestionDocument } from '../../persistence/schemas/question.schema';
import { EventBus } from '../../telemetry/event-bus';

export interface StateView {
  qid: string;
  state: string;
  peerCount: number;
  windowS: number;
  windowEndsAt?: Date; // peers derive the countdown from this (no server `now`: keeps ETags stable)
  resolution?: string;
  peerFirst?: boolean;
  answer?: { text: string; cites: string[]; kind: string; tierUsed?: string; cached?: boolean; truncated?: boolean };
  stages?: Array<{ stage: string; startedAt?: Date; doneAt?: Date }>;
  quickTakeReady?: boolean;
  deepDiveReady?: boolean;
  deepDive?: { text: string; cites: string[] };
  pollId?: string;
}

const ANSWER_PREVIEW_CHARS = 600;

let qSeq = 0;
let aSeq = 0;

/**
 * QuestionService — CF-AS vertical slice (F-V2-1).
 * Create: PII screen → pulse (1×C gate) → hidden Quick Take prep (cache/1×C)
 * → queued Deep Dive iff escalation → window timer. Settle/skip resolve.
 * Contract note: POST /questions requires {sessionId} (scoping addition to
 * blueprint §3.5, which lists body without it).
 */
@Injectable()
export class QuestionService {
  private readonly logger = new Logger(QuestionService.name);

  constructor(
    @InjectModel(Question.name) private readonly questions: Model<QuestionDocument>,
    @InjectModel(PeerAnswer.name) private readonly answers: Model<PeerAnswerDocument>,
    @InjectModel(Session.name) private readonly sessions: Model<SessionDocument>,
    @InjectModel(Circle.name) private readonly circles: Model<CircleDocument>,
    @InjectModel(Learner.name) private readonly learners: Model<LearnerDocument>,
    private readonly router: RouterService,
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly governor: BudgetGovernor,
    private readonly cache: CacheService,
    private readonly windows: PeerWindowService,
    private readonly hints: HintService,
    private readonly equity: EquityService,
    private readonly bus: EventBus,
  ) {}

  /** Create an OPEN question and kick off hidden prep. Never rejects on prep failure. */
  async listBySession(sessionId: string): Promise<{ qids: string[] }> {
    const rows = await this.questions
      .find({ sessionId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select({ _id: 1 })
      .lean()
      .exec();
    return { qids: rows.map((r) => String(r._id)) };
  }

  async create(input: { sessionId: string; askerId: string; text: string; lang?: string; anonymous?: boolean }): Promise<QuestionDocument> {
    const session = await this.sessions.findOne({ _id: input.sessionId }).lean().exec();
    if (!session) throw Err.missing(`SESSION_NOT_FOUND:${input.sessionId}`);
    if (session.endedAt) throw Err.bad(`SESSION_ENDED:${input.sessionId}`);
    const circle = await this.circles.findOne({ _id: session.circleId }).lean().exec();
    if (!circle) throw Err.missing(`CIRCLE_NOT_FOUND:${session.circleId}`);
    const asker = await this.learners.findOne({ _id: input.askerId }).lean().exec();
    if (!asker) throw Err.missing(`LEARNER_NOT_FOUND:${input.askerId}`);

    const { clean } = screenPii(input.text);
    if (clean.trim().length === 0) throw Err.bad('QUESTION_EMPTY');
    const lang = this.resolveLang(input.lang, clean, circle.lang);
    const level = (asker.passport?.level as string) ?? 'intro';

    qSeq += 1;
    const now = new Date();
    const windowS = circle.windowS;
    const q = await this.questions.create({
      _id: `Q-${now.getTime().toString(36)}${(qSeq % 1296).toString(36).padStart(2, '0')}`,
      sessionId: session._id,
      circleId: circle._id,
      askerId: input.askerId,
      text: clean,
      lang,
      anonymous: input.anonymous ?? false,
      state: 'OPEN',
      windowS,
      windowStartedAt: now,
      windowEndsAt: new Date(now.getTime() + windowS * 1000),
      stages: [{ stage: 'retrieving', startedAt: now, doneAt: now }],
      hintState: 0,
      cites: [],
      escalated: false,
      createdAt: now,
    });

    await this.bus.emit({
      sessionId: session._id,
      circleId: circle._id,
      actor: input.askerId,
      type: 'question_open',
      payload: { qid: q._id, anonymous: q.anonymous },
    });

    // Hidden prep (never blocks creation, never throws outward).
    void this.prepare(q._id, clean, lang, level).catch((e) => this.logger.warn(`prepare failed ${q._id}: ${(e as Error).message}`));
    this.windows.schedule(q._id, windowS * 1000);
    return q;
  }

  /** Router pulse → Quick Take → queued Deep Dive iff escalation. */
  private async prepare(qid: string, clean: string, lang: string, level: string): Promise<void> {
    const q = await this.questions.findOne({ _id: qid }).exec();
    if (!q || q.state !== 'OPEN') return;

    // 1. Pulse: the 1×C gate (also yields cites + escalation decision).
    const outcome = await this.router.pulse({ sessionId: q.sessionId, circleId: q.circleId, text: clean, lang, level });
    const fresh = await this.questions.findOne({ _id: qid }).exec();
    if (!fresh || fresh.state !== 'OPEN') return;
    fresh.cites = outcome.cites;
    fresh.escalated = outcome.escalate;
    this.pushStage(fresh, 'checking_similar');
    await fresh.save();

    // 2. Hidden Quick Take (cache, else 1×C).
    await this.prepareQuickTake(fresh, clean, lang, level, outcome.cites);

    // 3. Deep Dive queued ONLY on escalation.
    if (outcome.escalate) {
      const queued = this.router.queueLarger(q.sessionId, {
        step: 'deep_dive',
        prompt: `Deep dive (≤150 words, ${lang}) for: """${clean.slice(0, 400)}"""\nUse claims from: ${outcome.cites.join(', ')}`,
        maxTokens: 300,
      });
      void queued.result
        .then(async (res) => {
          const r = res as { text: string };
          const target = await this.questions.findOne({ _id: qid }).exec();
          if (!target) return;
          target.deepDive = { text: r.text, tier: 'L', cites: outcome.cites, readyAt: new Date(), ready: true };
          await target.save();
        })
        .catch((e) => this.logger.warn(`deep dive failed ${qid}: ${(e as Error).message}`));
    }
  }

  private async prepareQuickTake(q: QuestionDocument, clean: string, lang: string, level: string, cites: string[]): Promise<void> {
    const key = buildCacheKey({ intent: `qt:${clean}`, level, lang, chunkIds: cites, ladderState: 0 });
    const hit = await this.cache.get<{ text: string }>(key);
    if (hit) {
      q.quickTake = { text: hit.value.text, cites, hidden: true, cached: true };
      await this.llm.logCacheHit('quick_take', q.sessionId);
      await q.save();
      return;
    }
    const reserved = await this.governor.reserve('C', q.sessionId);
    if (!reserved) {
      q.quickTake = { failed: true, reason: 'quota-out' };
      await q.save();
      return;
    }
    try {
      const res = await this.llm.compact({
        step: 'quick_take',
        prompt: `Quick take (≤60 words, ${lang}) for: """${clean.slice(0, 400)}"""\nGround in: ${cites.join(', ')}`,
        maxTokens: 120,
      });
      await this.governor.commit('C', q.sessionId);
      await this.cache.set(key, { text: res.text }, cites, 1800, 'C');
      q.quickTake = { text: res.text, cites, hidden: true, cached: false };
      this.pushStage(q, 'writing');
      await q.save();
    } catch (e) {
      await this.governor.release('C', q.sessionId);
      q.quickTake = { failed: true, reason: (e as Error).message };
      await q.save();
    }
  }

  /** Peer answer attempt (OPEN only). Credits flow via projections. */
  async peerAnswer(questionId: string, authorId: string, text: string): Promise<{ aid: string; creditsAwarded: number }> {
    const q = await this.questions.findOne({ _id: questionId }).exec();
    if (!q) throw Err.missing(`QUESTION_NOT_FOUND:${questionId}`);
    if (q.state !== 'OPEN') throw Err.conflict(`QUESTION_CLOSED:${questionId}`);
    if (authorId === q.askerId) throw Err.bad('PEER_NOT_ASKER');
    const { clean } = screenPii(text);
    if (clean.trim().length === 0) throw Err.bad('ANSWER_EMPTY');
    const before = await this.equity.totalFor(q.sessionId, authorId);
    aSeq += 1;
    const ans = await this.answers.create({
      _id: `A-${Date.now().toString(36)}${(aSeq % 1296).toString(36).padStart(2, '0')}`,
      questionId,
      authorId,
      text: clean,
      lang: q.lang,
      creditsAwarded: 0,
      createdAt: new Date(),
    });
    await this.bus.emit({ sessionId: q.sessionId, circleId: q.circleId, actor: authorId, type: 'peer_answer', payload: { qid: questionId, aid: ans._id } });
    const after = await this.equity.totalFor(q.sessionId, authorId);
    ans.creditsAwarded = after - before;
    await ans.save();
    return { aid: ans._id, creditsAwarded: ans.creditsAwarded };
  }

  async meToo(questionId: string, learnerId: string): Promise<{ ok: boolean }> {
    const q = await this.questions.findOne({ _id: questionId }).lean().exec();
    if (!q) throw Err.missing(`QUESTION_NOT_FOUND:${questionId}`);
    await this.bus.emit({ sessionId: q.sessionId, circleId: q.circleId, actor: learnerId, type: 'me_too', payload: { qid: questionId } });
    return { ok: true };
  }

  /** Asker skips the wait → direct answer from the hidden Quick Take. */
  async skip(questionId: string, askerId: string): Promise<{ answer: string; tierUsed: string; cached: boolean; cites: string[] }> {
    const q = await this.questions.findOne({ _id: questionId }).exec();
    if (!q) throw Err.missing(`QUESTION_NOT_FOUND:${questionId}`);
    if (q.askerId !== askerId) throw Err.denied('SKIP_ASKER_ONLY');
    if (q.state !== 'OPEN') throw Err.conflict(`QUESTION_CLOSED:${questionId}`);
    this.windows.cancel(questionId);

    q.state = 'NOVA_THINKING';
    q.skipPressed = true;
    await q.save();

    // Ensure a Quick Take exists (prep may still be in flight).
    let qt = (q.quickTake ?? {}) as { text?: string; cites?: string[]; cached?: boolean; failed?: boolean };
    if (!qt.text) {
      await this.prepareQuickTake(q, q.text, q.lang, 'intro', q.cites ?? []);
      const refetch = await this.questions.findOne({ _id: questionId }).lean().exec();
      qt = ((refetch?.quickTake ?? {}) as typeof qt);
    }

    let answer: string;
    let tierUsed = 'C';
    let cached = qt.cached === true;
    if (qt.text) {
      answer = qt.text;
    } else {
      // Resilient: circle keeps working even with no model at all.
      answer = 'Nova is unavailable right now — discuss with your peers using the poll, and try again in a bit.';
      tierUsed = 'T0';
      cached = false;
    }

    q.state = 'RESOLVED';
    q.resolution = 'skip_direct';
    q.peerFirst = false;
    q.resolvedAt = new Date();
    q.answer = { text: answer, cites: qt.cites ?? q.cites ?? [], kind: 'quick_take', tierUsed: tierUsed as 'C' | 'T0', cached };
    await q.save();
    await this.bus.emit({ sessionId: q.sessionId, circleId: q.circleId, actor: askerId, type: 'skip', payload: { qid: questionId, tierUsed, cached } });
    return { answer, tierUsed, cached, cites: q.answer.cites };
  }

  /** Asker-only hint ladder with the T0 leak gate (delegated to HintService). */
  async hint(questionId: string, askerId: string, level: 1 | 2 | 3 | 4): Promise<{ hint: string; level: number; cites: string[] }> {
    const served = await this.hints.serve(questionId, level, askerId);
    return { hint: served.hint, level: served.level, cites: served.cites };
  }

  /** Poller view. Answer text truncated to keep the payload <1 KB. */
  async getState(questionId: string, askerId?: string): Promise<{ view: StateView; etag: string }> {
    const q = await this.questions.findOne({ _id: questionId }).lean().exec();
    if (!q) throw Err.missing(`QUESTION_NOT_FOUND:${questionId}`);
    const peerCount = await this.answers.countDocuments({ questionId }).exec();
    const isAsker = !!askerId && askerId === q.askerId;

    const view: StateView = {
      qid: q._id,
      state: q.state,
      peerCount,
      windowS: q.windowS,
      windowEndsAt: q.windowEndsAt,
      resolution: q.resolution,
      peerFirst: q.peerFirst,
      pollId: q.pollId,
    };
    if (q.state === 'RESOLVED' && q.answer) {
      const text = q.answer.text ?? '';
      view.answer = {
        text: text.length > ANSWER_PREVIEW_CHARS ? `${text.slice(0, ANSWER_PREVIEW_CHARS)}…` : text,
        cites: q.answer.cites ?? [],
        kind: q.answer.kind ?? 'quick_take',
        tierUsed: q.answer.tierUsed,
        cached: q.answer.cached,
        truncated: text.length > ANSWER_PREVIEW_CHARS,
      };
    }
    if (isAsker) {
      view.stages = q.stages ?? [];
      const qt = (q.quickTake ?? {}) as { text?: string };
      const dd = (q.deepDive ?? {}) as { ready?: boolean; text?: string; cites?: string[] };
      view.quickTakeReady = !!qt.text;
      view.deepDiveReady = dd.ready === true;
      if (dd.ready === true) view.deepDive = { text: dd.text ?? '', cites: dd.cites ?? [] };
    }
    const etag = `"${createHash('sha1').update(JSON.stringify(view)).digest('hex')}"`;
    return { view, etag };
  }

  private resolveLang(explicit: string | undefined, text: string, circleLang: string): string {
    if (explicit && ['ar', 'darija', 'fr', 'en'].includes(explicit)) return explicit;
    const detected = detectRegister(text);
    if (detected === 'arabizi') return 'darija';
    if (detected === 'ar' || detected === 'darija' || detected === 'fr' || detected === 'en') return detected;
    return circleLang;
  }

  private pushStage(q: QuestionDocument, stage: string): void {
    q.stages = [...(q.stages ?? []), { stage, startedAt: new Date() }];
  }
}
