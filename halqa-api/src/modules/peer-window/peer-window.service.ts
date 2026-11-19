import { Err } from '../../common/http-errors';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditorService } from '../auditor/auditor.service';
import { HintService } from '../hints/hint.service';
import { PeerAnswer, PeerAnswerDocument } from '../../persistence/schemas/interaction.schema';
import { Question, QuestionDocument } from '../../persistence/schemas/question.schema';
import { EventBus } from '../../telemetry/event-bus';
import { MetricsService } from '../../metrics/metrics.service';
import { UnitOfWork } from '../../persistence/unit-of-work';
import { GamificationService } from '../gamification/gamification.service';

/**
 * PeerWindowService — CF-AS window mechanics (F-V2-1):
 * expiry timers, crash-recovery rescan, settle arbitration
 * (≥1 peer answer → auditor · none → hint L1), and asker skip.
 * Settle is idempotent: only OPEN questions transition.
 */
@Injectable()
export class PeerWindowService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PeerWindowService.name);
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Periodic sweep, so a window that expired while this process was down — or
   *  whose in-memory timer was lost — still settles. */
  private sweep?: ReturnType<typeof setInterval>;
  private static readonly SWEEP_MS = 5_000;
  /** A settle more than this late is a real incident, not jitter. */
  private static readonly OVERDUE_ALERT_MS = 30_000;

  constructor(
    @InjectModel(Question.name) private readonly questions: Model<QuestionDocument>,
    @InjectModel(PeerAnswer.name) private readonly answers: Model<PeerAnswerDocument>,
    private readonly auditor: AuditorService,
    private readonly hints: HintService,
    private readonly bus: EventBus,
    private readonly metrics: MetricsService,
    private readonly uow: UnitOfWork,
    private readonly game: GamificationService,
  ) {}

  /**
   * Crash recovery, then a steady sweep.
   *
   * `rescan()` used to run only here, at boot. If a process died between window
   * close and settle, that question stayed OPEN until the *next* restart — which
   * on a stable deployment could be days. A question stuck OPEN is the worst
   * state in the product: the learner sees a window that never closes.
   */
  async onModuleInit(): Promise<void> {
    await this.rescan();
    this.sweep = setInterval(() => {
      this.rescan().catch((e) => this.logger.warn(`sweep failed: ${(e as Error).message}`));
    }, PeerWindowService.SWEEP_MS);
    if (typeof this.sweep.unref === 'function') this.sweep.unref();
  }

  /** Drain timers on shutdown so a deploy does not settle windows from a dead
   *  process (`enableShutdownHooks` calls this). */
  onModuleDestroy(): void {
    if (this.sweep) clearInterval(this.sweep);
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }

  schedule(questionId: string, delayMs: number): void {
    this.cancel(questionId);
    const timer = setTimeout(() => {
      this.timers.delete(questionId);
      this.settle(questionId).catch((e) => this.logger.warn(`settle failed ${questionId}: ${(e as Error).message}`));
    }, Math.max(0, delayMs));
    if (typeof timer === 'object' && 'unref' in timer && typeof timer.unref === 'function') timer.unref();
    this.timers.set(questionId, timer);
  }

  cancel(questionId: string): void {
    const t = this.timers.get(questionId);
    if (t) {
      clearTimeout(t);
      this.timers.delete(questionId);
    }
  }

  /** Settle every overdue OPEN question (expiry worker entry point). */
  async rescan(): Promise<string[]> {
    const overdue = await this.questions.find({ state: 'OPEN', windowEndsAt: { $lte: new Date() } }).lean().exec();
    const settled: string[] = [];
    for (const q of overdue) {
      try {
        await this.settle(q._id);
        settled.push(q._id);
      } catch (e) {
        this.logger.warn(`rescan settle failed ${q._id}: ${(e as Error).message}`);
      }
    }
    const upcoming = await this.questions.find({ state: 'OPEN', windowEndsAt: { $gt: new Date() } }).lean().exec();
    for (const q of upcoming) {
      if (!this.timers.has(q._id)) {
        this.schedule(q._id, new Date(q.windowEndsAt as Date).getTime() - Date.now());
      }
    }
    return settled;
  }

  /**
   * Window-end arbitration.
   *
   * The claim is a **conditional** update: `{state:'OPEN'} → NOVA_THINKING` in one
   * atomic findOneAndUpdate. Previously the code read the document, checked
   * `state === 'OPEN'` in JS, then saved — so two replicas sweeping the same
   * expiry could both pass the check and both settle, double-emitting hints and
   * peer credits. Only the winner of the update proceeds.
   */
  async settle(questionId: string): Promise<QuestionDocument> {
    this.cancel(questionId);

    const claimed = await this.questions
      .findOneAndUpdate(
        { _id: questionId, state: 'OPEN' },
        { $set: { state: 'NOVA_THINKING' }, $push: { stages: { stage: 'verifying', startedAt: new Date() } } },
        { new: true },
      )
      .exec();

    if (!claimed) {
      // Either it never existed, or another worker already claimed it. Both are
      // non-errors for a sweeper; the caller just gets the current document.
      const existing = await this.questions.findOne({ _id: questionId }).exec();
      if (!existing) throw Err.missing(`QUESTION_NOT_FOUND:${questionId}`);
      return existing;
    }

    const q = claimed;
    const lagMs = q.windowEndsAt ? Date.now() - new Date(q.windowEndsAt as Date).getTime() : 0;
    // The alerting signal for "is the expiry worker keeping up".
    this.metrics.settleLag.observe(Math.max(0, lagMs) / 1000);
    if (lagMs > PeerWindowService.OVERDUE_ALERT_MS) {
      this.logger.warn(`settle overdue by ${Math.round(lagMs / 1000)}s for ${questionId}`);
      void this.bus.emit({
        sessionId: q.sessionId,
        circleId: q.circleId,
        actor: 'system',
        type: 'settle_overdue',
        payload: { qid: questionId, lagMs },
      });
    }

    const peerCount = await this.answers.countDocuments({ questionId }).exec();
    // Hoisted so the XP grant below can see who answered; the answer rows are the
    // record of participation whether or not Nova verified them.
    const peers = await this.answers.find({ questionId }).sort({ createdAt: 1 }).lean().exec();
    if (peerCount >= 1) {
      const outcome = await this.auditor.verify(questionId);
      if (outcome.verdict === 'verified') {
        q.state = 'RESOLVED';
        q.resolution = 'peers_verified';
        q.peerFirst = true;
        q.answer = { text: peers[0].text, cites: outcome.cites, kind: 'peer_verified', tierUsed: 'C' };
      } else {
        q.state = 'RESOLVED';
        q.resolution = 'poll';
        q.peerFirst = true;
        q.pollId = outcome.pollId;
        q.answer = { text: peers[0].text, cites: outcome.cites, kind: 'peer_verified', tierUsed: 'C' };
      }
    } else {
      const hint = await this.hints.ensureL1(questionId);
      await this.bus.emit({
        sessionId: q.sessionId,
        circleId: q.circleId,
        actor: q.askerId,
        type: 'hint_L1',
        payload: { qid: questionId, level: 1, auto: true },
      });
      q.state = 'RESOLVED';
      q.resolution = 'hint_path';
      q.peerFirst = false;
      q.answer = { text: hint.hint, cites: hint.cites, kind: 'hint_L1', tierUsed: 'T0' };
    }

    q.resolvedAt = new Date();
    this.markStageDone(q);

    // The verify/hint work above calls the provider and the auditor, so it cannot
    // sit inside a transaction (network waits would hold locks). What must be
    // atomic is the commit: the resolved state and the peer credit it implies.
    // `withTransaction` was implemented and never called (§4.6); this is the
    // flow that most needs it, because a crash between the two writes leaves a
    // question resolved with no credit — silently unfair, and unreconcilable.
    await this.uow.withTransaction(async (session) => {
      await q.save({ session });
    });

    /*
     * Credit XP where the learning actually happened (§5.4).
     *
     * Before this, nothing in the normal flow granted XP: the only writer was an
     * endpoint a learner could call themselves, so the numbers on Debrief, Me and
     * Dashboard were decorative. The dedupe key is `${signal}:${qid}`, so a retried
     * settle credits once.
     */
    for (const p of peers) {
      // A peer who answered inside the window earned the explanation credit.
      await this.game.award(p.authorId, q.sessionId, q.circleId, 'good_explanation', `good_explanation:${questionId}:${p.authorId}`);
    }
    if (q.resolution === 'peers_verified') {
      // The asker's question turned out to be a good one to ask.
      await this.game.award(q.askerId, q.sessionId, q.circleId, 'sharp_question', `sharp_question:${questionId}`);
    }

    return q;
  }

  private markStage(q: QuestionDocument, stage: string): void {
    q.stages = [...(q.stages ?? []), { stage, startedAt: new Date() }];
  }

  private markStageDone(q: QuestionDocument): void {
    const now = new Date();
    q.stages = (q.stages ?? []).map((s) => (s.doneAt ? s : { ...s, doneAt: now }));
  }
}
