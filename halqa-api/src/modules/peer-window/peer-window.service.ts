import { Err } from '../../common/http-errors';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditorService } from '../auditor/auditor.service';
import { HintService } from '../hints/hint.service';
import { PeerAnswer, PeerAnswerDocument } from '../../persistence/schemas/interaction.schema';
import { Question, QuestionDocument } from '../../persistence/schemas/question.schema';
import { EventBus } from '../../telemetry/event-bus';

/**
 * PeerWindowService — CF-AS window mechanics (F-V2-1):
 * expiry timers, crash-recovery rescan, settle arbitration
 * (≥1 peer answer → auditor · none → hint L1), and asker skip.
 * Settle is idempotent: only OPEN questions transition.
 */
@Injectable()
export class PeerWindowService implements OnModuleInit {
  private readonly logger = new Logger(PeerWindowService.name);
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    @InjectModel(Question.name) private readonly questions: Model<QuestionDocument>,
    @InjectModel(PeerAnswer.name) private readonly answers: Model<PeerAnswerDocument>,
    private readonly auditor: AuditorService,
    private readonly hints: HintService,
    private readonly bus: EventBus,
  ) {}

  /** Crash recovery: settle overdue OPEN questions, reschedule the rest. */
  async onModuleInit(): Promise<void> {
    await this.rescan();
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

  /** Window-end arbitration. Idempotent: non-OPEN questions are returned as-is. */
  async settle(questionId: string): Promise<QuestionDocument> {
    this.cancel(questionId);
    const q = await this.questions.findOne({ _id: questionId }).exec();
    if (!q) throw Err.missing(`QUESTION_NOT_FOUND:${questionId}`);
    if (q.state !== 'OPEN') return q;

    q.state = 'NOVA_THINKING';
    this.markStage(q, 'verifying');
    await q.save();

    const peerCount = await this.answers.countDocuments({ questionId }).exec();
    if (peerCount >= 1) {
      const outcome = await this.auditor.verify(questionId);
      const peers = await this.answers.find({ questionId }).sort({ createdAt: 1 }).lean().exec();
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
    await q.save();
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
