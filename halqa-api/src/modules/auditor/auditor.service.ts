import { Err } from '../../common/http-errors';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { normaliseIntent } from '../../domain/cache-key';
import { LLM_PORT, LlmPort } from '../../domain/ports/llm-port';
import { BudgetGovernor } from '../../ai/governor/budget.governor';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { ConsensusService } from '../consensus/consensus.service';
import { PeerAnswer, PeerAnswerDocument } from '../../persistence/schemas/interaction.schema';
import { Question, QuestionDocument } from '../../persistence/schemas/question.schema';
import { EventBus } from '../../telemetry/event-bus';

export type AuditorVerdict = 'verified' | 'doubtful';

export interface VerifyOutcome {
  verdict: AuditorVerdict;
  pollId?: string;
  escalated: boolean;
  cites: string[];
  note: string;
}

const CONFIDENCE_THRESHOLD = 0.55;

/**
 * AuditorService (F-AUD) — verifies peer answers, poll-first on doubt.
 * T0 first: a peer answer matching a seeded misconception trigger is
 * doubtful without spending a call. Otherwise 1×C bounded classify; low
 * confidence → poll-first + L escalation flag.
 */
@Injectable()
export class AuditorService {
  private readonly logger = new Logger(AuditorService.name);

  constructor(
    @InjectModel(PeerAnswer.name) private readonly answers: Model<PeerAnswerDocument>,
    @InjectModel(Question.name) private readonly questions: Model<QuestionDocument>,
    private readonly knowledge: KnowledgeService,
    private readonly consensus: ConsensusService,
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly governor: BudgetGovernor,
    private readonly bus: EventBus,
  ) {}

  async verify(questionId: string): Promise<VerifyOutcome> {
    const q = await this.questions.findOne({ _id: questionId }).exec();
    if (!q) throw Err.missing(`QUESTION_NOT_FOUND:${questionId}`);
    const peers = await this.answers.find({ questionId }).sort({ createdAt: 1 }).lean().exec();
    if (peers.length === 0) throw Err.conflict(`AUDITOR_NO_PEERS:${questionId}`);

    // T0: seeded-misconception screen.
    const misc = this.knowledge.query().filter((c) => c.kind === 'misconception');
    for (const peer of peers) {
      const norm = normaliseIntent(peer.text);
      for (const m of misc) {
        const triggers = (m as { triggers?: string[] }).triggers ?? [];
        if (triggers.some((t) => norm.includes(normaliseIntent(t)))) {
          return this.doubtful(q, peer.text, 'seeded-misconception', m.chunk_id);
        }
      }
    }

    // 1×C bounded classify.
    const reserved = await this.governor.reserve('C', q.sessionId);
    if (!reserved) {
      // Quota out → resilient poll-first path, no model spent.
      return this.doubtful(q, peers[0].text, 'quota-out', 'quota');
    }
    let raw: string;
    try {
      const res = await this.llm.compact({
        step: 'auditor',
        prompt: `Peer answers to verify (JSON only: {"verdict":"supported|unsure","confidence":0-1}):\n${peers.map((p) => `- ${p.text.slice(0, 200)}`).join('\n')}\nQuestion: ${q.text.slice(0, 200)}`,
        maxTokens: 120,
      });
      raw = res.text;
      await this.governor.commit('C', q.sessionId);
    } catch {
      await this.governor.release('C', q.sessionId);
      return this.doubtful(q, peers[0].text, 'adapter-error', 'error');
    }

    const parsed = this.parse(raw);
    if (parsed.verdict === 'supported' && parsed.confidence >= CONFIDENCE_THRESHOLD) {
      await this.bus.emit({
        sessionId: q.sessionId,
        circleId: q.circleId,
        actor: 'NOVA',
        type: 'nova_verify',
        payload: { qid: questionId, verdict: 'verified' },
      });
      return { verdict: 'verified', escalated: false, cites: q.cites ?? [], note: 'peer answer supported' };
    }
    return this.doubtful(q, peers[0].text, 'low-confidence', 'c');
  }

  private parse(raw: string): { verdict: 'supported' | 'unsure'; confidence: number } {
    try {
      const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const j = JSON.parse((fenced?.[1] ?? raw).trim());
      return {
        verdict: j.verdict === 'supported' ? 'supported' : 'unsure',
        confidence: typeof j.confidence === 'number' ? j.confidence : 0.4,
      };
    } catch {
      return { verdict: 'unsure', confidence: 0.35 };
    }
  }

  private async doubtful(q: QuestionDocument, claim: string, why: string, ref: string): Promise<VerifyOutcome> {
    const poll = await this.consensus.create({
      sessionId: q.sessionId,
      circleId: q.circleId,
      questionId: q._id,
      claim: claim.slice(0, 300),
      choices: ['correct', 'needs-fix'],
      reason: 'auditor_doubt',
    });
    await this.bus.emit({
      sessionId: q.sessionId,
      circleId: q.circleId,
      actor: 'NOVA',
      type: 'nova_verify',
      payload: { qid: q._id, verdict: 'doubtful', pollId: poll._id, why, ref },
    });
    return { verdict: 'doubtful', pollId: poll._id, escalated: true, cites: q.cites ?? [], note: `doubtful: ${why}` };
  }
}
