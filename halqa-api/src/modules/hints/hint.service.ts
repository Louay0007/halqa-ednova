import { Err } from '../../common/http-errors';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { getHintTemplate } from '../../domain/hint-templates';
import { HintDoc, HintDocument } from '../../persistence/schemas/interaction.schema';
import { Question, QuestionDocument } from '../../persistence/schemas/question.schema';
import { Circle, CircleDocument } from '../../persistence/schemas/circle.schema';
import { EventBus } from '../../telemetry/event-bus';
import type { AnalyticsEventType } from '../../persistence/schemas/telemetry.schema';

export interface ServedHint {
  hint: string;
  level: number;
  cites: string[];
  fromTemplate: boolean;
}

/**
 * HintService — Hint Ladder L1–L4 (F-HINT).
 * L1–L3 are T0 templates (zero model calls). L4 serves the hidden Quick Take.
 * T0 leak gate (enforced in code, not prompt): L4 requires hintState ≥ 3
 * (L1–L3 served in order) OR asker pressed skip. Out-of-order L2/L3 are
 * allowed only after L1 (hintState ≥ level−1).
 */
@Injectable()
export class HintService {
  private readonly logger = new Logger(HintService.name);

  constructor(
    @InjectModel(HintDoc.name) private readonly hints: Model<HintDocument>,
    @InjectModel(Question.name) private readonly questions: Model<QuestionDocument>,
    @InjectModel(Circle.name) private readonly circles: Model<CircleDocument>,
    private readonly bus: EventBus,
  ) {}

  /** Serve a hint level to the asker. Returns the hint + updated hintState. */
  async serve(questionId: string, level: 1 | 2 | 3 | 4, askerId: string): Promise<ServedHint> {
    const q = await this.questions.findOne({ _id: questionId }).exec();
    if (!q) throw Err.missing(`QUESTION_NOT_FOUND:${questionId}`);
    if (q.askerId !== askerId) throw Err.denied('HINT_ASKER_ONLY');
    if (q.state === 'OPEN') throw Err.conflict('HINT_WINDOW_OPEN');

    // T0 leak gate.
    if (level === 4 && !(q.hintState >= 3 || q.skipPressed)) throw Err.denied('HINT_L4_LOCKED');
    if (level < 4 && q.hintState < level - 1) throw Err.bad('HINT_ORDER');

    const id = `${questionId}:${level}`;
    const existing = await this.hints.findOne({ _id: id }).lean().exec();
    if (existing) {
      return { hint: existing.text, level, cites: existing.cites ?? [], fromTemplate: level < 4 };
    }

    let text: string;
    let cites: string[];
    if (level < 4) {
      const tpl = getHintTemplate(await this.topicOf(q), q.lang);
      text = level === 1 ? tpl.L1 : level === 2 ? tpl.L2 : tpl.L3;
      cites = q.cites ?? [];
    } else {
      const qt = (q.quickTake ?? {}) as { text?: string; cites?: string[]; failed?: boolean };
      if (!qt.text) throw Err.conflict('HINT_L4_NOT_READY');
      text = qt.text;
      cites = qt.cites ?? q.cites ?? [];
    }

    await this.hints.updateOne({ _id: id }, { $set: { _id: id, questionId, level, text, cites, createdAt: new Date() } }, { upsert: true }).exec();
    q.hintState = Math.max(q.hintState, level);
    await q.save();
    await this.bus.emit({
      sessionId: q.sessionId,
      circleId: q.circleId,
      actor: askerId,
      type: `hint_L${level}` as AnalyticsEventType,
      payload: { qid: questionId, level },
    });
    return { hint: text, level, cites, fromTemplate: level < 4 };
  }

  /** Ensure L1 exists (used by the window-settle no-answer path). No event here — caller emits. */
  async ensureL1(questionId: string): Promise<ServedHint> {
    const q = await this.questions.findOne({ _id: questionId }).exec();
    if (!q) throw Err.missing(`QUESTION_NOT_FOUND:${questionId}`);
    const tpl = getHintTemplate(await this.topicOf(q), q.lang);
    const id = `${questionId}:1`;
    await this.hints.updateOne({ _id: id }, { $setOnInsert: { _id: id, questionId, level: 1, text: tpl.L1, cites: q.cites ?? [], createdAt: new Date() } }, { upsert: true }).exec();
    if (q.hintState < 1) {
      q.hintState = 1;
      await q.save();
    }
    return { hint: tpl.L1, level: 1, cites: q.cites ?? [], fromTemplate: true };
  }

  private async topicOf(q: QuestionDocument): Promise<string> {
    const c = await this.circles.findOne({ _id: q.circleId }).lean().exec();
    return c?.topic ?? 'generic';
  }
}
