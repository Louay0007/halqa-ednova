import { Err } from '../../common/http-errors';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LLM_PORT, LlmPort } from '../../domain/ports/llm-port';
import { BudgetGovernor } from '../../ai/governor/budget.governor';
import { Learner, LearnerDocument } from '../../persistence/schemas/learner.schema';
import { EventBus } from '../../telemetry/event-bus';

const STYLE_CARDS: Record<string, Record<string, string>> = {
  visual: {
    en: 'Explain to me: picture first, then example. Short sentences.',
    fr: 'Explique-moi : image d’abord, puis exemple. Phrases courtes.',
    ar: 'اشرح لي: صورة أولاً ثم مثال. جمل قصيرة.',
    darija: 'فسّرلي: تصويرة لول، من بعد مثال. جمل قصيرة.',
  },
  analogy: {
    en: 'Explain to me: daily-life analogy first, then the rule.',
    fr: 'Explique-moi : analogie du quotidien d’abord, puis la règle.',
    ar: 'اشرح لي: تشبيه من الحياة أولاً ثم القاعدة.',
    darija: 'فسّرلي: مثال من الحياة لول، من بعد القاعدة.',
  },
  steps: {
    en: 'Explain to me: numbered steps, one action each.',
    fr: 'Explique-moi : étapes numérotées, une action chacune.',
    ar: 'اشرح لي: خطوات مرقمة، فعل واحد لكل خطوة.',
    darija: 'فسّرلي: خطوات مرقمة، كل خطوة حاجة وحدة.',
  },
};

/**
 * CoachService — Explain-to-me cards + Style Coach (F-V2-2). Card render is
 * T0 (<100 ms) from the passport; the private nudge is a template (0 calls);
 * `rephrase` is the ONLY C call (≤80 tokens, explainer-tapped).
 */
@Injectable()
export class CoachService {
  private readonly logger = new Logger(CoachService.name);

  constructor(
    @InjectModel(Learner.name) private readonly learners: Model<LearnerDocument>,
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly governor: BudgetGovernor,
    private readonly bus: EventBus,
  ) {}

  async card(learnerId: string): Promise<{ card: string; visible: boolean }> {
    const doc = await this.learners.findOne({ _id: learnerId }).lean().exec();
    if (!doc?.passport) throw Err.missing(`DNA_NO_PASSPORT:${learnerId}`);
    const weights = doc.passport.styleWeights as Record<string, number>;
    const top = (Object.entries(weights).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'visual') as string;
    const lang = (doc.passport.lang as string) ?? 'en';
    const table = STYLE_CARDS[top] ?? STYLE_CARDS.visual;
    return { card: table[lang] ?? table.en, visible: (doc.passport.explainCardVisible as boolean) ?? false };
  }

  /** Private nudge to the explainer (never in the circle feed). T0 template. */
  async nudge(explainerId: string, targetLearnerId: string, sessionId: string, circleId: string): Promise<{ nudge: string; private: true }> {
    const target = await this.learners.findOne({ _id: targetLearnerId }).lean().exec();
    const top = target?.passport
      ? (Object.entries(target.passport.styleWeights as Record<string, number>).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'visual')
      : 'visual';
    const name = (target?.nickname ?? 'your peer').slice(0, 24);
    const nudge = `${name} understands best via ${top}-first — try a sketch or a one-line picture before the rule.`;
    await this.bus.emit({ sessionId, circleId, actor: explainerId, type: 'coach_nudge', payload: { target: targetLearnerId, style: top } });
    return { nudge, private: true };
  }

  /** Explainer-tapped rephrase (1×C, ≤80 tokens). */
  async rephrase(sessionId: string, circleId: string, text: string, style: string, lang: string): Promise<{ suggestion: string }> {
    if (!(await this.governor.reserve('C', sessionId))) {
      return { suggestion: text };
    }
    try {
      const res = await this.llm.compact({
        step: 'question_coach',
        prompt: `Rephrase in ${style}-first style (≤80 tokens, ${lang}): """${text.slice(0, 300)}"""`,
        maxTokens: 100,
      });
      await this.governor.commit('C', sessionId);
      return { suggestion: res.text };
    } catch {
      await this.governor.release('C', sessionId);
      return { suggestion: text };
    }
  }
}
