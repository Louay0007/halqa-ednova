import { Err } from '../../common/http-errors';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BANDIT_BASELINE, StyleKey, StyleWeights, evenWeights, topStyle, updateStyleWeights } from '../../domain/bandit';
import { AVATAR_KEYS } from '../../domain/ids';
import { Learner, LearnerDocument, Level } from '../../persistence/schemas/learner.schema';
import { EventBus } from '../../telemetry/event-bus';

export interface DnaAnswers {
  L1: 'novice' | 'beginner' | 'intermediate'; // level probe tier
  S1: 'visual' | 'analogy' | 'steps'; // style A/B
  G1: 'ar' | 'darija' | 'fr' | 'en'; // language pick
  C1: 'sure' | 'unsure' | 'lost'; // confidence
}

export interface DnaItem {
  id: 'L1' | 'S1' | 'G1' | 'C1';
  prompt: string;
  options: string[];
}

/** The 4 micro-items (≤3 min total). Content is T0 data, not code. */
export const DNA_ITEMS: DnaItem[] = [
  { id: 'L1', prompt: 'Niveau en recherche dichotomique ? / مستواك في البحث الثنائي؟', options: ['novice', 'beginner', 'intermediate'] },
  { id: 'S1', prompt: 'Qu’est-ce qui t’aide le plus ? / شنو يعاونك أكثر؟', options: ['picture-desc (visual)', 'daily-life analogy', 'numbered steps'] },
  { id: 'G1', prompt: 'Langue / اللغة', options: ['ar', 'darija', 'fr', 'en'] },
  { id: 'C1', prompt: 'Confiance / ثقتك', options: ['sure', 'unsure', 'lost'] },
];

const HINT_EAGERNESS: Record<DnaAnswers['C1'], number> = { sure: 0.3, unsure: 0.6, lost: 0.9 };

/**
 * LearningModule — DNA + passport + bandit (F-DNA).
 * L1 → level · S1 → initial style weights · G1 → lang · C1 → hint eagerness + invite flag.
 */
@Injectable()
export class LearningService {
  private readonly logger = new Logger(LearningService.name);

  constructor(
    @InjectModel(Learner.name) private readonly learners: Model<LearnerDocument>,
    private readonly bus: EventBus,
  ) {}

  items(): DnaItem[] {
    return DNA_ITEMS;
  }

  /** Create a learner (synthetic L-## id, neutral avatar) and write its passport. */
  async completeDna(input: {
    nickname: string;
    context: string;
    topic?: string;
    answers: DnaAnswers;
    sessionId?: string;
    circleId?: string;
  }): Promise<{ learnerId: string; passport: Record<string, unknown> }> {
    const topic = input.topic ?? 'binary_search';
    const styleAnchor: Record<DnaAnswers['S1'], StyleKey> = { visual: 'visual', analogy: 'analogy', steps: 'steps' };
    const base = evenWeights();
    const anchored: StyleWeights = { ...base, [styleAnchor[input.answers.S1]]: 0.5 };
    const total = Object.values(anchored).reduce((a, b) => a + b, 0);
    for (const k of Object.keys(anchored) as (keyof StyleWeights)[]) anchored[k] = anchored[k] / total;

    const level: Level = input.answers.L1 === 'novice' ? 'novice' : input.answers.L1 === 'intermediate' ? 'intermediate' : 'beginner';
    const passport = {
      level,
      levelByTopic: { [topic]: level },
      styleWeights: anchored,
      lang: input.answers.G1,
      hintEagerness: HINT_EAGERNESS[input.answers.C1],
      inviteMe: input.answers.C1 !== 'sure',
      explainCardVisible: false,
      completedAt: new Date(),
    };

    const learnerId = await this.allocateLearnerId(async (candidate) => {
      await this.learners.create({
        _id: candidate,
        nickname: input.nickname.slice(0, 24),
        avatarKey: AVATAR_KEYS[candidate.charCodeAt(3) % AVATAR_KEYS.length],
        context: input.context,
        lastSeenAt: new Date(),
        passport,
      });
    });

    if (input.sessionId && input.circleId) {
      await this.bus.emit({
        sessionId: input.sessionId,
        circleId: input.circleId,
        actor: learnerId,
        type: 'dna_done',
        payload: { level, lang: input.answers.G1 },
      });
    }
    return { learnerId, passport: passport as Record<string, unknown> };
  }

  /** Bandit update after a check-question; returns the new top style. */
  async recordCheck(learnerId: string, style: StyleKey, success: 0 | 1, baseline: number = BANDIT_BASELINE): Promise<{ weights: StyleWeights; top: StyleKey }> {
    const doc = await this.learners.findOne({ _id: learnerId }).lean().exec();
    if (!doc?.passport) throw Err.missing(`DNA_NO_PASSPORT:${learnerId}`);
    const weights = updateStyleWeights(doc.passport.styleWeights as StyleWeights, style, success, baseline);
    await this.learners.updateOne({ _id: learnerId }, { $set: { 'passport.styleWeights': weights } }).exec();
    return { weights, top: topStyle(weights) };
  }

  /** Unique L-## ids: count-based candidate with a duplicate-key retry loop. */
  private async allocateLearnerId(create: (candidate: string) => Promise<void>): Promise<string> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const count = await this.learners.countDocuments().exec();
      const candidate = `L-${String(count + 1 + attempt).padStart(2, '0')}`;
      try {
        await create(candidate);
        return candidate;
      } catch (e) {
        if ((e as { code?: number }).code !== 11000) throw e;
        lastError = e;
      }
    }
    throw lastError;
  }
}
