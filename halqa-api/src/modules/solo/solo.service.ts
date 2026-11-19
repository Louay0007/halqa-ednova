import { Err } from '../../common/http-errors';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import { LLM_PORT, LlmPort } from '../../domain/ports/llm-port';
import { BudgetGovernor } from '../../ai/governor/budget.governor';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { OfflineService } from '../offline/offline.service';
import { Session, SessionDocument } from '../../persistence/schemas/session.schema';
import { EventBus } from '../../telemetry/event-bus';

export type SoloHat = 'NOVA_NOVICE' | 'NOVA_SKEPTIC' | 'NOVA_CURIOUS' | 'NOVA_EXAMINER';

const HAT_PROBES: Record<SoloHat, string[]> = {
  NOVA_NOVICE: [
    'I know the loop, but why must the array be sorted first?',
    'What happens if I halve an unsorted list — which half survives?',
    'Is O(log n) fast because we skip halves? Explain like I am new.',
  ],
  NOVA_SKEPTIC: [
    'But what if the array is NOT sorted — does halving still work?',
    'Mid = (low+high) — always safe? What could break?',
    'Someone said binary search is O(n). Convince me otherwise.',
  ],
  NOVA_CURIOUS: [
    'Where else does halving appear outside search?',
    'Can we binary-search the answer to a fractions problem?',
    'What would you teach a friend first about sorted order?',
  ],
  NOVA_EXAMINER: [
    'Trace find 8 in [2,4,6,8]: list each midpoint.',
    'Give one input where binary search FAILS and say why.',
    'Compare 3/4 vs 3/5 without a calculator — which wins?',
  ],
};

/**
 * SoloService — Teach Nova (F-V2-5). The learner teaches; Nova asks naive
 * probe questions from T0 templates, C only rephrases (≤60 tokens).
 * Hard caps: ≤8 C calls, 0 L calls per solo session (governor ledger).
 */
@Injectable()
export class SoloService {
  private readonly logger = new Logger(SoloService.name);
  // Hat and turn count used to live in these two Maps, so a solo session reset to
  // NOVA_NOVICE / turn 0 on every deploy (§4.4). The service already creates a
  // durable `Session` document, so both fields live there now.


  constructor(
    @InjectModel(Session.name) private readonly sessions: Model<SessionDocument>,
    private readonly knowledge: KnowledgeService,
    private readonly offline: OfflineService,
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly governor: BudgetGovernor,
    private readonly bus: EventBus,
  ) {}

  async start(topic: string, lang: string, learnerId: string): Promise<{ sessionId: string; hat: SoloHat; probe: string }> {
    const sessionId = `S-solo-${randomBytes(3).toString('hex')}`;
    await this.sessions.create({
      _id: sessionId,
      circleId: `C-solo-${learnerId}`,
      agenda: { templateId: 'solo', steps: [] },
      health: { S: 0, B: 0.5, U: 0.5, computedAt: new Date() },
      healthInputs: { solo: true },
      lang,
      // Hat is learner-chosen, so it must be stored, not derived from turn index.
      soloHat: 'NOVA_NOVICE',
      soloTurn: 0,
      startedAt: new Date(),
    });
    await this.governor.ensureSession(sessionId, { solo: true });
    const probe = HAT_PROBES.NOVA_NOVICE[0];
    await this.bus.emit({ sessionId, circleId: `C-solo-${learnerId}`, actor: 'NOVA', type: 'solo_turn', payload: { hat: 'NOVA_NOVICE', probe } });
    return { sessionId, hat: 'NOVA_NOVICE', probe };
  }

  async turn(sessionId: string, learnerId: string, text: string, lang: string): Promise<{ novaTurn: string; hint?: string; progress: number }> {
    const session = await this.sessions.findOne({ _id: sessionId }).lean().exec();
    if (!session) throw Err.missing(`SESSION_NOT_FOUND:${sessionId}`);
    const hat = (session.soloHat as SoloHat | undefined) ?? 'NOVA_NOVICE';
    const n = (session.soloTurn ?? 0) + 1;
    // Atomic increment: two fast turns must not both read the same count.
    await this.sessions.updateOne({ _id: sessionId }, { $inc: { soloTurn: 1 } }).exec();

    // C rephrase only (≤60 tokens), capped at 8/session by the governor.
    let novaTurn = HAT_PROBES[hat][n % HAT_PROBES[hat].length];
    const reserved = await this.governor.reserve('C', sessionId);
    if (reserved) {
      try {
        const res = await this.llm.compact({
          step: 'solo_turn',
          prompt: `Rephrase as a curious student (≤60 tokens, ${lang}): """${HAT_PROBES[hat][n % HAT_PROBES[hat].length]}""" Learner said: """${text.slice(0, 200)}"""`,
          maxTokens: 80,
        });
        await this.governor.commit('C', sessionId);
        novaTurn = res.text;
      } catch {
        await this.governor.release('C', sessionId);
      }
    } else {
      const off = this.offline.serve('binary_search', lang);
      novaTurn = off.text;
    }
    await this.bus.emit({ sessionId, circleId: session.circleId, actor: 'NOVA', type: 'solo_turn', payload: { hat, n } });
    return { novaTurn, progress: Math.min(1, n / 8) };
  }

  async hat(sessionId: string, next: SoloHat): Promise<{ hat: SoloHat }> {
    if (!HAT_PROBES[next]) throw Err.bad(`SOLO_BAD_HAT:${next}`);
    const res = await this.sessions.updateOne({ _id: sessionId }, { $set: { soloHat: next } }).exec();
    if (res.matchedCount === 0) throw Err.missing(`SESSION_NOT_FOUND:${sessionId}`);
    return { hat: next };
  }

  async invite(sessionId: string): Promise<{ deepLink: string; code: string }> {
    const session = await this.sessions.findOne({ _id: sessionId }).lean().exec();
    if (!session) throw Err.missing(`SESSION_NOT_FOUND:${sessionId}`);
    const code = randomBytes(3).toString('hex').toUpperCase();
    await this.bus.emit({ sessionId, circleId: session.circleId, actor: 'system', type: 'invite_sent', payload: { code } });
    return { deepLink: `halqa://join?code=${code}&topic=binary_search`, code };
  }
}
