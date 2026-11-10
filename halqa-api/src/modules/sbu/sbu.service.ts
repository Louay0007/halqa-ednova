import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { AnalyticsEventType, TelemetryEvent, TelemetryEventDocument } from '../../persistence/schemas/telemetry.schema';
import { Session, SessionDocument } from '../../persistence/schemas/session.schema';
import { HealthInputs, SbuRings, SbuWeights, DEFAULT_SBU_WEIGHTS, computeSBU, needsHuman, ringTier } from '../../domain/sbu.math';
import { EquityService } from '../equity/equity.service';

export interface SessionHealthView {
  sessionId: string;
  S: number;
  B: number;
  U: number;
  tiers: { S: string; B: string; U: string };
  needsHuman: boolean;
  inputs: HealthInputs;
}

/**
 * SbuService — Circle Health rings (F-V2-3). Derives HealthInputs from the
 * session doc + event stream, computes rings with domain/sbu.math, and writes
 * both back (health + healthInputs) so every ring value is reproducible from
 * its inputs (Phase 2 exit criterion).
 */
@Injectable()
export class SbuService {
  private readonly logger = new Logger(SbuService.name);
  private readonly weights: SbuWeights;

  constructor(
    @InjectModel(Session.name) private readonly sessions: Model<SessionDocument>,
    @InjectModel(TelemetryEvent.name) private readonly events: Model<TelemetryEventDocument>,
    private readonly equity: EquityService,
  ) {
    const raw = yaml.parse(fs.readFileSync(path.resolve(process.cwd(), 'config', 'sbu.yaml'), 'utf8'));
    this.weights = {
      s: { ...DEFAULT_SBU_WEIGHTS.s, ...(raw?.s ?? {}) },
      u: { ...DEFAULT_SBU_WEIGHTS.u, ...(raw?.u ?? {}) },
      thresholds: { ...DEFAULT_SBU_WEIGHTS.thresholds, ...(raw?.thresholds ?? {}) },
    };
  }

  /** Derive inputs, compute rings, persist, return the view. */
  async recompute(sessionId: string): Promise<SessionHealthView> {
    const session = await this.sessions.findOne({ _id: sessionId }).lean().exec();
    if (!session) throw new Error(`SBU_NO_SESSION:${sessionId}`);
    const inputs = await this.deriveInputs(sessionId, session);
    const rings = computeSBU(inputs, this.weights);
    await this.sessions
      .updateOne(
        { _id: sessionId },
        {
          $set: {
            health: { S: rings.S, B: rings.B, U: rings.U, computedAt: new Date() },
            'healthInputs.sbu': inputs,
            'healthInputs.creditsByLearner': inputs.creditsByLearner,
          },
        },
      )
      .exec();
    return {
      sessionId,
      S: rings.S,
      B: rings.B,
      U: rings.U,
      tiers: { S: ringTier(rings.S, this.weights), B: ringTier(rings.B, this.weights), U: ringTier(rings.U, this.weights) },
      needsHuman: needsHuman(rings, await this.misconceptionOpenMin(sessionId)),
      inputs,
    };
  }

  async deriveInputs(sessionId: string, session: Record<string, unknown>): Promise<HealthInputs> {
    const agenda = (session['agenda'] as { steps?: Array<{ done?: boolean; kind?: string; plannedS?: number }> } | undefined) ?? {};
    const steps = agenda.steps ?? [];
    const agendaCompletion = steps.length === 0 ? 0 : steps.filter((s) => s.done).length / steps.length;
    const recapDone = steps.some((s) => s.kind === 'recap' && s.done);

    // Time discipline: planned vs actual session length (0.5 neutral when unmeasurable).
    const plannedTotal = steps.reduce((a, s) => a + (s.plannedS ?? 0), 0);
    const started = session['startedAt'] ? new Date(session['startedAt'] as string).getTime() : Date.now();
    const ended = session['endedAt'] ? new Date(session['endedAt'] as string).getTime() : Date.now();
    const actualS = Math.max(1, (ended - started) / 1000);
    const timeDiscipline = plannedTotal > 0 ? Math.min(1, plannedTotal / actualS) : 0.5;

    const count = async (type: AnalyticsEventType): Promise<number> =>
      this.events.countDocuments({ sessionId, type }).exec();

    // U ingredients.
    const quizTotal = await count('quiz_answer');
    let checkSuccessRate = 0.5; // neutral prior: no evidence yet
    if (quizTotal > 0) {
      const correct = await this.events.countDocuments({ sessionId, type: 'quiz_answer', 'payload.correct': true }).exec();
      checkSuccessRate = correct / quizTotal;
    }
    const hintCounts = await Promise.all([count('hint_L1'), count('hint_L2'), count('hint_L3'), count('hint_L4')]);
    const hintTotal = hintCounts.reduce((a, b) => a + b, 0);
    const avgHintDepth =
      hintTotal === 0 ? 0 : (hintCounts[0] * 1 + hintCounts[1] * 2 + hintCounts[2] * 3 + hintCounts[3] * 4) / hintTotal;
    const corrections = await count('correction');
    const questions = await count('question_open');
    const correctionsPerAnswer = Math.min(1, corrections / Math.max(1, questions));

    // B ingredient: live credit totals.
    const totals = await this.equity.totals(sessionId);
    const creditsByLearner: Record<string, number> = {};
    for (const t of totals) creditsByLearner[t.learnerId] = t.total;

    return { agendaCompletion, timeDiscipline, recapDone, creditsByLearner, checkSuccessRate, avgHintDepth, correctionsPerAnswer };
  }

  private async misconceptionOpenMin(_sessionId: string): Promise<number> {
    // Phase 5 (Auditor/Whisper) tracks open misconceptions; Phase 2 reports 0.
    return 0;
  }

  ringsOf(rings: SbuRings): SbuRings {
    return rings;
  }
}
