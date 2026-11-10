import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { APP_CONFIG } from '../../core/config/config.module';
import type { AppConfig } from '../../core/config/app-config';
import { QuotaLedger, QuotaLedgerDocument } from '../../persistence/schemas/ai.schema';

export type ModelTier = 'C' | 'L';

export interface SessionUsage {
  cUsed: number;
  lUsed: number;
  cCap: number;
  lCap: number;
}

/**
 * Budget Governor — atomic per-session quota enforcement (plan §4.8).
 *
 * Reserve/commit split prevents concurrent bursts from overspending:
 *  - reserve(): conditional atomic update; matchedCount===0 means exhausted.
 *  - commit(): moves one reservation into used.
 *  - release(): drops a reservation without spending (failure path).
 * The deny path is explicit (returns false); callers fall back + meter + banner.
 */
@Injectable()
export class BudgetGovernor {
  private readonly logger = new Logger(BudgetGovernor.name);
  private readonly soloCCap = 8;

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @InjectModel(QuotaLedger.name) private readonly ledger: Model<QuotaLedgerDocument>,
  ) {}

  /** Create the ledger row for a session if missing (caps from config). Solo sessions: C cap 8, L cap 0. */
  async ensureSession(sessionId: string, opts?: { solo?: boolean }): Promise<SessionUsage> {
    const cCap = opts?.solo ? this.soloCCap : this.cfg.QUOTA_C;
    const lCap = opts?.solo ? 0 : this.cfg.QUOTA_L;
    const doc = await this.ledger
      .findOneAndUpdate(
        { _id: sessionId },
        { $setOnInsert: { _id: sessionId, cUsed: 0, lUsed: 0, cCap, lCap, reservedC: 0, reservedL: 0 } },
        { upsert: true, new: true },
      )
      .lean()
      .exec();
    return { cUsed: doc?.cUsed ?? 0, lUsed: doc?.lUsed ?? 0, cCap, lCap };
  }

  /** Atomic reservation. False = quota exhausted (fallback path, never silent). */
  async reserve(tier: ModelTier, sessionId: string): Promise<boolean> {
    await this.ensureSession(sessionId);
    const usedField = tier === 'C' ? '$cUsed' : '$lUsed';
    const reservedField = tier === 'C' ? '$reservedC' : '$reservedL';
    const capField = tier === 'C' ? '$cCap' : '$lCap';
    const inc = tier === 'C' ? { reservedC: 1 } : { reservedL: 1 };
    const res = await this.ledger
      .updateOne(
        { _id: sessionId, $expr: { $lt: [{ $add: [usedField, reservedField] }, capField] } },
        { $inc: inc },
      )
      .exec();
    return res.matchedCount === 1;
  }

  /** Move one reservation into used after a successful model call. */
  async commit(tier: ModelTier, sessionId: string): Promise<void> {
    const inc = tier === 'C' ? { reservedC: -1, cUsed: 1 } : { reservedL: -1, lUsed: 1 };
    await this.ledger.updateOne({ _id: sessionId }, { $inc: inc }).exec();
  }

  /** Drop a reservation without spending (model failure / cache hit after reserve). */
  async release(tier: ModelTier, sessionId: string): Promise<void> {
    const inc = tier === 'C' ? { reservedC: -1 } : { reservedL: -1 };
    await this.ledger.updateOne({ _id: sessionId }, { $inc: inc }).exec();
  }

  async usage(sessionId: string): Promise<SessionUsage> {
    const doc = await this.ledger.findOne({ _id: sessionId }).lean().exec();
    if (!doc) return { cUsed: 0, lUsed: 0, cCap: this.cfg.QUOTA_C, lCap: this.cfg.QUOTA_L };
    return { cUsed: doc.cUsed, lUsed: doc.lUsed, cCap: doc.cCap, lCap: doc.lCap };
  }

  /** Solo sessions are capped at 8 C calls and 0 L calls (plan invariant #2). */
  isSoloCap(solo: boolean, tier: ModelTier): boolean {
    if (!solo) return true;
    return tier === 'C';
  }
}
