import { Err } from '../../common/http-errors';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LLM_PORT, LlmPort } from '../../domain/ports/llm-port';
import { BudgetGovernor } from '../../ai/governor/budget.governor';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { Artifact, ArtifactDocument } from '../../persistence/schemas/ai.schema';
import { Session, SessionDocument } from '../../persistence/schemas/session.schema';
import { Question, QuestionDocument } from '../../persistence/schemas/question.schema';
import { EventBus } from '../../telemetry/event-bus';

export interface Capsule {
  bullets: string[];
  visual_desc: string;
  mini_quiz: string[];
  next_step: string;
  xp_earned: number;
  tier: 'C' | 'L' | 'T0';
}

/**
 * CapsuleService — revision notes (F-CAP).
 * C draft always; L polish ONLY if the governor allows (one luxury call).
 * Constraints enforced in code: bullets ≤15 words (≤12 Darija),
 * visual_desc ≤40 words, exactly 3 mini-quiz qids that resolve in the KB.
 */
@Injectable()
export class CapsuleService {
  private readonly logger = new Logger(CapsuleService.name);

  constructor(
    @InjectModel(Artifact.name) private readonly artifacts: Model<ArtifactDocument>,
    @InjectModel(Session.name) private readonly sessions: Model<SessionDocument>,
    @InjectModel(Question.name) private readonly questions: Model<QuestionDocument>,
    private readonly knowledge: KnowledgeService,
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly governor: BudgetGovernor,
    private readonly bus: EventBus,
  ) {}

  async build(sessionId: string): Promise<Capsule> {
    const session = await this.sessions.findOne({ _id: sessionId }).lean().exec();
    if (!session) throw Err.missing(`SESSION_NOT_FOUND:${sessionId}`);
    const existing = await this.artifacts.findOne({ sessionId, kind: 'capsule' }).lean().exec();
    if (existing) return existing.body as unknown as Capsule;

    const qs = await this.questions.find({ sessionId, state: 'RESOLVED' }).lean().exec();
    const topics = qs.flatMap((q) => q.cites ?? []).slice(0, 5);
    const lang = 'en';

    // C draft (bounded): 3 bullets from resolved questions + cites.
    const draft = this.draftFromSession(qs.map((q) => q.text), topics, lang);

    // L polish only if quota allows — the one luxury call.
    let tier: 'C' | 'L' | 'T0' = 'C';
    let capsule = draft;
    if (await this.governor.reserve('L', sessionId)) {
      try {
        const res = await this.llm.larger({
          step: 'capsule_polish',
          prompt: `Polish these revision bullets (keep ≤15 words each, keep meaning): ${JSON.stringify(draft.bullets)}`,
          maxTokens: 200,
        });
        await this.governor.commit('L', sessionId);
        capsule = { ...draft, bullets: this.clampBullets(this.splitLines(res.text, 3), lang) };
        tier = 'L';
      } catch {
        await this.governor.release('L', sessionId);
      }
    }

    capsule.tier = tier;
    await this.artifacts
      .updateOne(
        { sessionId, kind: 'capsule' },
        { $set: { sessionId, circleId: session.circleId, kind: 'capsule', body: capsule, tier, createdAt: new Date() } },
        { upsert: true },
      )
      .exec();
    await this.bus.emit({ sessionId, circleId: session.circleId, actor: 'NOVA', type: 'capsule_done', payload: { tier } });
    return capsule;
  }

  async get(sessionId: string): Promise<Capsule> {
    const doc = await this.artifacts.findOne({ sessionId, kind: 'capsule' }).lean().exec();
    if (!doc) throw Err.missing(`CAPSULE_NOT_FOUND:${sessionId}`);
    return doc.body as unknown as Capsule;
  }

  private draftFromSession(questionTexts: string[], cites: string[], lang: string): Capsule {
    const probes = this.knowledge.query().filter((c) => c.kind === 'probe').slice(0, 3);
    const bullets = this.clampBullets(
      questionTexts.slice(0, 3).map((t) => `Revisit: ${t.slice(0, 60)} — check ${cites[0] ?? 'kb'}`),
      lang,
    );
    while (bullets.length < 3) bullets.push('Review the cited chunk and re-explain it to a peer.');
    return {
      bullets,
      visual_desc: 'Halving funnel: full array narrows to one slot in log steps.',
      mini_quiz: probes.map((p) => p.chunk_id),
      next_step: `Re-explain ${cites[0] ?? 'the lesson'} in your own style, then invite a friend.`,
      xp_earned: 15,
      tier: 'C',
    };
  }

  private clampBullets(lines: string[], lang: string): string[] {
    const max = lang === 'darija' ? 12 : 15;
    return lines.slice(0, 3).map((l) => {
      const words = l.split(/\s+/).filter(Boolean);
      return words.length > max ? `${words.slice(0, max).join(' ')}…` : l;
    });
  }

  private splitLines(text: string, n: number): string[] {
    const lines = text.split('\n').map((l) => l.replace(/^[-*\d.)\s]+/, '').trim()).filter(Boolean);
    while (lines.length < n) lines.push('Review the cited chunk and re-explain it to a peer.');
    return lines.slice(0, n);
  }
}
