import { Err } from '../../common/http-errors';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import { LLM_PORT, LlmPort } from '../../domain/ports/llm-port';
import { BudgetGovernor } from '../../ai/governor/budget.governor';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { Artifact, ArtifactDocument } from '../../persistence/schemas/ai.schema';
import { EventBus } from '../../telemetry/event-bus';

export interface DriftMap {
  kept: string[];
  lost: string[];
  distorted: string[];
  added: string[];
}

export interface WhisperChain {
  chainId: string;
  steps: Array<{ authorId: string; text: string }>;
  driftMap: DriftMap;
  tier: 'C' | 'T0';
}

/**
 * WhisperService — Explanation Relay (F-V2-8). A explains → hidden from B →
 * B re-explains → … → 1×C compares the chain vs the claim checklist →
 * drift map (kept/lost/distorted/added) → group repairs together.
 * Typical cost: ≤1 C call per game.
 */
@Injectable()
export class WhisperService {
  private readonly logger = new Logger(WhisperService.name);

  constructor(
    @InjectModel(Artifact.name) private readonly artifacts: Model<ArtifactDocument>,
    private readonly knowledge: KnowledgeService,
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly governor: BudgetGovernor,
    private readonly bus: EventBus,
  ) {}

  async run(sessionId: string, circleId: string, topic: string, steps: Array<{ authorId: string; text: string }>): Promise<WhisperChain> {
    if (steps.length < 2) throw Err.bad('WHISPER_NEEDS_CHAIN');
    const chainId = `W-${randomBytes(3).toString('hex')}`;
    // The chain used to live in a Map, so `repair()` 404'd after any deploy and
    // two replicas disagreed about which chains existed. It now lives on the
    // `drift_map` artifact this method already writes, which is where it belongs:
    // the chain is the input to that artifact.


    const checklist = this.checklistFor(topic);
    let drift = this.t0Compare(steps, checklist);
    let tier: 'C' | 'T0' = 'T0';

    // 1×C bounded compare, escalated only on low confidence — here: always try once.
    if (await this.governor.reserve('C', sessionId)) {
      try {
        const res = await this.llm.compact({
          step: 'whisper_compare',
          prompt: `Compare this explanation chain vs checklist ${JSON.stringify(checklist)}. Chain: ${JSON.stringify(steps.map((s) => s.text).slice(0, 3))}. Return JSON {"kept":[],"lost":[],"distorted":[],"added":[]} using checklist ids only.`,
          maxTokens: 200,
        });
        await this.governor.commit('C', sessionId);
        drift = this.parseDrift(res.text, checklist);
        tier = 'C';
      } catch {
        await this.governor.release('C', sessionId);
      }
    }

    await this.artifacts
      .updateOne(
        { sessionId, kind: 'drift_map' },
        {
          $set: {
            sessionId,
            circleId,
            kind: 'drift_map',
            body: { chainId, topic, steps, driftMap: drift },
            tier,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      )
      .exec();
    await this.bus.emit({ sessionId, circleId, actor: 'NOVA', type: 'whisper_run', payload: { chainId } });
    await this.bus.emit({ sessionId, circleId, actor: 'NOVA', type: 'drift_found', payload: { chainId, lost: drift.lost } });
    return { chainId, steps, driftMap: drift, tier };
  }

  async repair(chainId: string, sessionId: string, circleId: string, text: string): Promise<{ coverage: number }> {
    // Read the chain back from the artifact, so a repair survives a restart and
    // works from any replica.
    const doc = await this.artifacts
      .findOne({ sessionId, kind: 'drift_map', 'body.chainId': chainId })
      .lean()
      .exec();
    const body = doc?.body as { topic?: string } | undefined;
    if (!body?.topic) throw Err.missing(`WHISPER_NOT_FOUND:${chainId}`);
    const checklist = this.checklistFor(body.topic);
    const lower = text.toLowerCase();
    const covered = checklist.filter((c) => lower.includes(c.split('-')[0]) || lower.includes(c));
    await this.bus.emit({ sessionId, circleId, actor: 'system', type: 'correction', payload: { chainId, coverage: covered.length / Math.max(1, checklist.length) } });
    return { coverage: covered.length / Math.max(1, checklist.length) };
  }

  private checklistFor(topic: string): string[] {
    const chunks = this.knowledge.query(topic);
    const claims = new Set<string>();
    for (const c of chunks) for (const cl of c.claims ?? []) claims.add(cl);
    return [...claims].slice(0, 8);
  }

  /** T0 fallback: last step vs checklist by keyword overlap. */
  private t0Compare(steps: Array<{ text: string }>, checklist: string[]): DriftMap {
    const last = (steps[steps.length - 1]?.text ?? '').toLowerCase();
    const first = (steps[0]?.text ?? '').toLowerCase();
    const kept: string[] = [];
    const lost: string[] = [];
    for (const c of checklist) {
      const key = c.split('-')[0];
      const inFirst = first.includes(key);
      const inLast = last.includes(key);
      if (inLast) kept.push(c);
      else if (inFirst) lost.push(c);
      else lost.push(c);
    }
    return { kept, lost, distorted: [], added: [] };
  }

  private parseDrift(raw: string, checklist: string[]): DriftMap {
    try {
      const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const j = JSON.parse((fenced?.[1] ?? raw).trim());
      const pick = (k: 'kept' | 'lost' | 'distorted' | 'added'): string[] =>
        Array.isArray(j[k]) ? (j[k] as string[]).filter((c) => checklist.includes(c)) : [];
      return { kept: pick('kept'), lost: pick('lost'), distorted: pick('distorted'), added: pick('added') };
    } catch {
      return { kept: [], lost: [...checklist], distorted: [], added: [] };
    }
  }
}
