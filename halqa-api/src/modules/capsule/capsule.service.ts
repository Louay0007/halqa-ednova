import { Err } from '../../common/http-errors';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LLM_PORT, LlmPort } from '../../domain/ports/llm-port';
import { BudgetGovernor } from '../../ai/governor/budget.governor';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { Artifact, ArtifactDocument } from '../../persistence/schemas/ai.schema';
import { Session, SessionDocument } from '../../persistence/schemas/session.schema';
import { Circle, CircleDocument } from '../../persistence/schemas/circle.schema';
import { GamificationService } from '../gamification/gamification.service';
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
 * Capsule copy, per language.
 *
 * The capsule is the artifact that closes the learning loop, so it cannot be
 * English-only in a four-language product. These are short, hand-written strings
 * rather than model output: they must render identically with the governor set
 * to BLACK.
 */
const COPY = {
  en: {
    revisit: (q: string, cite: string) => `Revisit: ${q} — check ${cite}`,
    reviewGeneric: 'Review the cited chunk and re-explain it to a peer.',
    nextStep: (what: string) => `Re-explain ${what} in your own style, then invite a friend.`,
    visualGeneric: (t: string) => `Concept map of ${t}: the key idea at the centre, its parts around it.`,
  },
  fr: {
    revisit: (q: string, cite: string) => `À revoir : ${q} — vérifie ${cite}`,
    reviewGeneric: 'Relis le passage cité et réexplique-le à un pair.',
    nextStep: (what: string) => `Réexplique ${what} avec tes mots, puis invite un ami.`,
    visualGeneric: (t: string) => `Carte du concept ${t} : l’idée clé au centre, ses parties autour.`,
  },
  ar: {
    revisit: (q: string, cite: string) => `راجع: ${q} — تحقّق من ${cite}`,
    reviewGeneric: 'أعد قراءة المقطع المُستشهد به واشرحه لزميل.',
    nextStep: (what: string) => `أعد شرح ${what} بأسلوبك ثم ادعُ صديقاً.`,
    visualGeneric: (t: string) => `خريطة مفهوم ${t}: الفكرة الأساسية في الوسط وحولها عناصرها.`,
  },
  darija: {
    revisit: (q: string, cite: string) => `عاود: ${q} — شوف ${cite}`,
    reviewGeneric: 'عاود قرا المقطع وفسّرو لصاحبك.',
    nextStep: (what: string) => `عاود فسّر ${what} بطريقتك، ومن بعد عيّط لصاحبك.`,
    visualGeneric: (t: string) => `خريطة ${t}: الفكرة المهمة فالوسط وحوالينها الأجزاء.`,
  },
} as const;

type Lang4 = keyof typeof COPY;
const copy = (lang: string) => COPY[(lang as Lang4) in COPY ? (lang as Lang4) : 'en'];
const langName = (lang: string) =>
  ({ en: 'English', fr: 'French', ar: 'Arabic', darija: 'Moroccan Darija' })[lang] ?? 'English';

/**
 * Topic-specific visual cues. A capsule must describe the concept the circle
 * actually studied; the old code always described binary search (§5.2).
 */
const VISUALS: Record<string, Partial<Record<Lang4, string>>> = {
  binary_search: {
    en: 'Halving funnel: the full array narrows to one slot in log steps.',
    fr: 'Entonnoir de division : le tableau entier se réduit à une case en log étapes.',
    ar: 'قمع التنصيف: المصفوفة كلها تتقلّص إلى خانة واحدة في خطوات لوغاريتمية.',
    darija: 'قمع التنصيف: الليستة كاملة كتضيق حتى لخانة وحدة فخطوات لوغاريتمية.',
  },
  fractions: {
    en: 'Pizza slices: one whole cut into equal parts; the denominator counts the parts.',
    fr: 'Parts de pizza : un tout coupé en parts égales ; le dénominateur compte les parts.',
    ar: 'شرائح البيتزا: كل واحد مقسّم إلى أجزاء متساوية، والمقام يعدّ الأجزاء.',
    darija: 'شرائح البيتزا: وحدة كاملة مقسّمة لأجزاء متساوية، والمقام كيعدّ الأجزاء.',
  },
};

function firstSentence(text: string): string {
  const cut = text.search(/[.!?؟]/);
  const s = (cut === -1 ? text : text.slice(0, cut + 1)).trim();
  return s.length > 90 ? `${s.slice(0, 90)}…` : s;
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
    @InjectModel(Circle.name) private readonly circles: Model<CircleDocument>,
    private readonly game: GamificationService,
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
    const cites = qs.flatMap((q) => q.cites ?? []).slice(0, 5);
    // Both were previously ignored: the language was hardcoded to English and the
    // visual description described binary search for every topic (§5.2).
    const lang = session.lang ?? 'en';
    const topic = await this.topicFor(session, cites);

    // C draft (bounded): 3 bullets from resolved questions + cites.
    const draft = this.draftFromSession(qs.map((q) => q.text), cites, topic, lang);

    // L polish only if quota allows — the one luxury call.
    let tier: 'C' | 'L' | 'T0' = 'C';
    let capsule = draft;
    if (await this.governor.reserve('L', sessionId)) {
      try {
        const res = await this.llm.larger({
          step: 'capsule_polish',
          // Ask for the learner's own language: polishing an English draft into
          // French is not a polish, it is a translation with worse fidelity.
          prompt: `Polish these revision bullets in ${langName(lang)} (keep ≤15 words each, keep meaning, keep the technical terms): ${JSON.stringify(draft.bullets)}`,
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

    /*
     * Credit the capsule completion (§5.4).
     *
     * `xp_earned: 15` was displayed on the screen while nothing was ever credited,
     * so the number was a promise the system did not keep. It is granted here, on
     * the first build only — the early-return above means a re-read of an existing
     * capsule does not pay again — and keyed by session so a retry is idempotent.
     */
    const askers = [...new Set(qs.map((q) => q.askerId).filter(Boolean))];
    for (const learnerId of askers) {
      await this.game.award(learnerId, sessionId, session.circleId, 'capsule_done', `capsule_done:${sessionId}:${learnerId}`);
    }
    return capsule;
  }

  async get(sessionId: string): Promise<Capsule> {
    const doc = await this.artifacts.findOne({ sessionId, kind: 'capsule' }).lean().exec();
    if (!doc) throw Err.missing(`CAPSULE_NOT_FOUND:${sessionId}`);
    return doc.body as unknown as Capsule;
  }

  /**
   * Which topic this session was about. Prefers the cited chunks (they are what
   * the circle actually resolved), then the circle's topic.
   */
  private async topicFor(session: { circleId: string }, cites: string[]): Promise<string> {
    const all = this.knowledge.query();
    for (const id of cites) {
      const hit = all.find((c) => c.chunk_id === id);
      if (hit) return hit.topic;
    }
    const circle = await this.circles.findOne({ _id: session.circleId }).select('topic').lean().exec();
    return circle?.topic ?? all[0]?.topic ?? 'general';
  }

  /**
   * T0 draft: fully offline, composed from the retrieved chunks in the learner's
   * language. This is the path that must work when the governor says no, so it
   * can never depend on a model call.
   */
  private draftFromSession(questionTexts: string[], cites: string[], topic: string, lang: string): Capsule {
    const kb = this.knowledge.query(topic, lang);
    // Fall back to any language for the same topic before leaving the topic: an
    // on-topic capsule in the wrong language beats a correct-language capsule
    // about the wrong concept, and the UI can label the mismatch.
    const pool = kb.length > 0 ? kb : this.knowledge.query(topic);
    const probes = pool.filter((c) => c.kind === 'probe').slice(0, 3);
    const explainers = pool.filter((c) => c.kind !== 'probe');

    const bullets = this.clampBullets(
      questionTexts
        .slice(0, 3)
        .map((t) => copy(lang).revisit(t.slice(0, 60), cites[0] ?? 'kb')),
      lang,
    );
    while (bullets.length < 3) {
      const next = explainers[bullets.length];
      bullets.push(next ? `${next.title}: ${firstSentence(next.text)}` : copy(lang).reviewGeneric);
    }

    return {
      bullets,
      visual_desc: this.visualFor(topic, lang, explainers[0]?.title),
      mini_quiz: probes.map((p) => p.chunk_id),
      next_step: copy(lang).nextStep(cites[0] ?? topic),
      xp_earned: 15,
      tier: 'C',
    };
  }

  /**
   * A topic-specific visual cue. The old implementation returned the binary-search
   * funnel for every topic, so a fractions circle was told to picture an array.
   */
  private visualFor(topic: string, lang: string, title?: string): string {
    const languages = VISUALS[topic];
    const visual = languages?.[(lang as Lang4) in COPY ? (lang as Lang4) : 'en'] ?? languages?.en;
    if (visual) return visual;
    // Unknown topic: describe the actual concept rather than inventing a diagram.
    return copy(lang).visualGeneric(title ?? topic);
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
