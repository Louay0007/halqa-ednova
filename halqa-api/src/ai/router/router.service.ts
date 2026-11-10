import { Injectable, Logger } from '@nestjs/common';
import { LlmRequest } from '../../domain/ports/llm-port';
import { screenPii } from '../../domain/pii';
import { ProviderAdapter } from '../adapter/provider.adapter';
import { CacheService } from '../cache/cache.service';
import { BudgetGovernor } from '../governor/budget.governor';
import { AiQueue } from '../queue/ai.queue';
import { RetrievalService } from '../retrieval/retrieval.service';
import { DegradationService } from '../degradation/degradation.service';
import { EventBus } from '../../telemetry/event-bus';

export type PulseIntent = 'ask' | 'explain' | 'help_offer' | 'dispute' | 'chitchat' | 'meta';

export interface GroupPulse {
  intent: PulseIntent;
  helpful_0_2: number;
  bridging_bool: boolean;
  skeptic_bool: boolean;
  confusion_0_1: number;
  lang: string;
}

export interface PulseInput {
  sessionId: string;
  circleId: string;
  text: string;
  lang: string;
  level: string;
  ladderState?: number;
}

export interface PulseOutcome {
  pulse: GroupPulse;
  escalate: boolean;
  servedFromCache: boolean;
  quotaExhausted: boolean;
  confidence: number;
  cites: string[];
}

/** Confidence below which C defers to L (router.yaml stub value). */
export const CONFIDENCE_THRESHOLD = 0.55;

export function emptyPulse(lang = 'en'): GroupPulse {
  return { intent: 'chitchat', helpful_0_2: 0, bridging_bool: false, skeptic_bool: false, confusion_0_1: 0, lang };
}

/** Parse schema-constrained Group Pulse JSON (tolerates code fences). */
export function parsePulse(text: string, fallbackLang = 'en'): { pulse: GroupPulse; confidence: number } {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced?.[1] ?? text).trim();
  try {
    const j = JSON.parse(candidate);
    const intents: PulseIntent[] = ['ask', 'explain', 'help_offer', 'dispute', 'chitchat', 'meta'];
    return {
      pulse: {
        intent: intents.includes(j.intent) ? j.intent : 'chitchat',
        helpful_0_2: typeof j.helpful_0_2 === 'number' ? Math.min(2, Math.max(0, j.helpful_0_2)) : 0,
        bridging_bool: j.bridging_bool === true,
        skeptic_bool: j.skeptic_bool === true,
        confusion_0_1: typeof j.confusion_0_1 === 'number' ? Math.min(1, Math.max(0, j.confusion_0_1)) : 0,
        lang: typeof j.lang === 'string' ? j.lang : fallbackLang,
      },
      confidence: 0.85,
    };
  } catch {
    return { pulse: emptyPulse(fallbackLang), confidence: 0.35 };
  }
}

export interface EscalationInput {
  confidence: number;
  chunkCount: number;
  /** Blueprint "≥3 chunks + conflict": retrieval genuinely torn (thin top
   *  margin) or a misconception chunk in play — otherwise rich retrieval
   *  alone would push L-share structurally above target. */
  conflict?: boolean;
  auditorEscalated?: boolean;
  needsPolishedProse?: boolean;
}

/**
 * Escalate to L iff ANY holds (plan §6.3):
 *  1. ≥3 chunks with conflicting claims need synthesis
 *  2. gate flags final polished prose
 *  3. C confidence < threshold
 *  4. Auditor/Whisper explicitly escalates
 */
export function decideEscalation(input: EscalationInput): boolean {
  if (input.confidence < CONFIDENCE_THRESHOLD) return true;
  if (input.chunkCount >= 3 && input.conflict === true) return true;
  if (input.needsPolishedProse === true) return true;
  if (input.auditorEscalated === true) return true;
  return false;
}

/** T0 conflict signal from the PRIMARY variant's top-2: a misconception chunk
 *  genuinely contending for the answer, or a retrieval tie (<5% margin).
 *  Deliberately tight: seeded errors share vocabulary with lessons by design,
 *  so top-5 presence would escalate nearly every turn and break the L budget. */
export function retrievalConflict(top2: Array<{ score: number; kind?: string }>): boolean {
  if (top2.some((h) => h.kind === 'misconception')) return true;
  if (top2.length < 2) return false;
  const [first, second] = top2;
  const denom = Math.max(Math.abs(first.score), 1e-9);
  return (first.score - second.score) / denom < 0.05;
}

/**
 * Router: Stage-0 gate + Group Pulse + escalation (plan §3.3 / §6.3).
 * Exactly 1×C per turn window; credits/confusion/intent/lang all consume this
 * one call — never an extra one (asserted by a call-count test).
 * Order: PII screen → cache → reserve → adapter → commit → llm_calls write.
 */
@Injectable()
export class RouterService {
  private readonly logger = new Logger(RouterService.name);

  constructor(
    private readonly adapter: ProviderAdapter,
    private readonly governor: BudgetGovernor,
    private readonly cache: CacheService,
    private readonly queue: AiQueue,
    private readonly retrieval: RetrievalService,
    private readonly degradation: DegradationService,
    private readonly bus: EventBus,
  ) {}

  async pulse(input: PulseInput): Promise<PulseOutcome> {
    const { sessionId, circleId } = input;
    // 0. PII screen BEFORE anything model-bound.
    const { clean } = screenPii(input.text);

    // 1. Retrieval (T0) for chunk context + cites; escalation judges the
    // primary variant only (expansion is for recall, not for adjudication).
    const hits = this.retrieval.search(clean, input.level, input.lang, 5);
    const chunkIds = hits.map((h) => h.chunkId);
    const cites = hits.flatMap((h) => h.cites);
    const diag = this.retrieval.diagnose(clean, input.level, input.lang);
    const conflict = retrievalConflict(diag.top2);

    // 2. Cache lookup — equivalent re-asks served without a model call.
    const key = this.cache.keyOf({
      intent: clean,
      level: input.level,
      lang: input.lang,
      chunkIds,
      ladderState: input.ladderState ?? 0,
    });
    const cached = await this.cache.get<{ pulse: GroupPulse; confidence: number; conflict: boolean }>(key);
    if (cached) {
      await this.adapter.logCacheHit('group_pulse', sessionId);
      await this.bus.emit({ sessionId, circleId, actor: 'system', type: 'cache_hit', payload: {} });
      return {
        pulse: cached.value.pulse,
        escalate: decideEscalation({ confidence: cached.value.confidence, chunkCount: chunkIds.length, conflict: cached.value.conflict }),
        servedFromCache: true,
        quotaExhausted: false,
        confidence: cached.value.confidence,
        cites,
      };
    }

    // 3. Budget guard — deny path is explicit (fallback + meter + banner).
    const reserved = await this.governor.reserve('C', sessionId);
    if (!reserved) {
      await this.bus.emit({ sessionId, circleId, actor: 'system', type: 'quota_event', payload: { exhausted: true, tier: 'C' } });
      await this.degradation.evaluate({ bus: this.bus, sessionId, circleId, lAvailable: true, quotaExhausted: true, serviceDown: false });
      return { pulse: emptyPulse(input.lang), escalate: false, servedFromCache: false, quotaExhausted: true, confidence: 0, cites };
    }

    // 4. The single C call.
    const req: LlmRequest = { step: 'group_pulse', prompt: this.buildPrompt(clean, input), maxTokens: 200 };
    let raw: string;
    try {
      const res = await this.adapter.compact(req);
      raw = res.text;
    } catch (e) {
      await this.governor.release('C', sessionId);
      throw e;
    }
    await this.governor.commit('C', sessionId);

    const { pulse, confidence } = parsePulse(raw, input.lang);
    const escalate = decideEscalation({ confidence, chunkCount: diag.count, conflict });

    // 5. Cache the pulse for equivalent re-asks (session TTL).
    await this.cache.set(key, { pulse, confidence, conflict }, cites, 1800, 'C');

    return { pulse, escalate, servedFromCache: false, quotaExhausted: false, confidence, cites };
  }

  /** L-path entry: goes through the FIFO queue (position + ETA) and a governor
   *  reservation. Callers retry once guided, then C fallback, then offline pack. */
  queueLarger(sessionId: string, req: Parameters<ProviderAdapter['larger']>[0]): { result: Promise<unknown>; position: number; etaMs: number } {
    return this.queue.enqueue(req.step, 'L', async () => {
      const ok = await this.governor.reserve('L', sessionId);
      if (!ok) throw new Error('L_QUOTA_EXHAUSTED');
      try {
        const out = await this.adapter.larger(req);
        await this.governor.commit('L', sessionId);
        return out;
      } catch (e) {
        await this.governor.release('L', sessionId);
        throw e;
      }
    });
  }

  private buildPrompt(clean: string, input: PulseInput): string {
    return [
      'Classify this learner turn as JSON (no prose):',
      `{"intent":"ask|explain|help_offer|dispute|chitchat|meta","helpful_0_2":0-2,`,
      `"bridging_bool":bool,"skeptic_bool":bool,"confusion_0_1":0-1,"lang":"${input.lang}"}`,
      `Turn: """${clean.slice(0, 500)}"""`,
    ].join('\n');
  }
}
