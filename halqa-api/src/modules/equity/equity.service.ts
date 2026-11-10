import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { APP_CONFIG } from '../../core/config/config.module';
import type { AppConfig } from '../../core/config/app-config';
import {
  ActionCounts,
  CreditAction,
  CreditWeights,
  DEFAULT_CREDIT_WEIGHTS,
  LOG_CAP_K,
  coefficientOfVariation,
  creditsFor,
  dominanceAlert,
} from '../../domain/credits.math';
import { Learner, LearnerDocument } from '../../persistence/schemas/learner.schema';
import { Session, SessionDocument } from '../../persistence/schemas/session.schema';

export interface LearnerCredits {
  learnerId: string;
  total: number;
  actions: ActionCounts;
}

/**
 * EquityService — Contribution Credits (F-V2-4). Weights loaded from
 * config/equity.yaml at construction (fail fast on bad config). Totals are
 * persisted per session in healthInputs.creditsByLearner + per-learner action
 * counters in healthInputs.creditActions, so S-B-U and the dashboard read one doc.
 */
@Injectable()
export class EquityService {
  private readonly logger = new Logger(EquityService.name);
  readonly weights: CreditWeights;
  readonly logCapK: number;

  constructor(
    @Inject(APP_CONFIG) _cfg: AppConfig,
    @InjectModel(Session.name) private readonly sessions: Model<SessionDocument>,
    @InjectModel(Learner.name) private readonly learners: Model<LearnerDocument>,
  ) {
    void _cfg;
    const raw = yaml.parse(fs.readFileSync(path.resolve(process.cwd(), 'config', 'equity.yaml'), 'utf8'));
    const w: CreditWeights = { ...DEFAULT_CREDIT_WEIGHTS };
    for (const k of Object.keys(w) as CreditAction[]) {
      if (typeof raw?.[k] === 'number') w[k] = raw[k];
    }
    this.weights = w;
    this.logCapK = typeof raw?.log_cap_k === 'number' ? raw.log_cap_k : LOG_CAP_K;
  }

  /** Award one credit-bearing action to a learner inside a session. */
  async award(sessionId: string, learnerId: string, action: CreditAction, n = 1): Promise<number> {
    const key = `healthInputs.creditActions.${learnerId}.${action}`;
    await this.sessions.updateOne({ _id: sessionId }, { $inc: { [key]: n } }).exec();
    return this.totalFor(sessionId, learnerId);
  }

  async totalFor(sessionId: string, learnerId: string): Promise<number> {
    const doc = await this.sessions.findOne({ _id: sessionId }).lean().exec();
    const actions = (doc?.healthInputs?.creditActions as Record<string, ActionCounts> | undefined)?.[learnerId] ?? {};
    return creditsFor(actions, this.weights);
  }

  /** All learner totals for a session, ranked desc. */
  async totals(sessionId: string): Promise<LearnerCredits[]> {
    const doc = await this.sessions.findOne({ _id: sessionId }).lean().exec();
    const actions = (doc?.healthInputs?.creditActions as Record<string, ActionCounts> | undefined) ?? {};
    return Object.entries(actions)
      .map(([learnerId, a]) => ({ learnerId, total: creditsFor(a, this.weights), actions: a }))
      .sort((x, y) => y.total - x.total);
  }

  async dispersion(sessionId: string): Promise<number> {
    const totals = await this.totals(sessionId);
    if (totals.length < 2) return 0;
    return coefficientOfVariation(totals.map((t) => t.total));
  }

  /** Private dominance signal for nudges (never exposed publicly). */
  async dominance(sessionId: string): Promise<{ alert: boolean; topLearnerId: string | null }> {
    const totals = await this.totals(sessionId);
    const byLearner: Record<string, number> = {};
    for (const t of totals) byLearner[t.learnerId] = t.total;
    return dominanceAlert(byLearner);
  }
}
