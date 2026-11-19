import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { APP_CONFIG } from '../../core/config/config.module';
import type { AppConfig } from '../../core/config/app-config';
import {
  CircleDailySpend,
  CircleDailySpendDocument,
  QuotaLedger,
  QuotaLedgerDocument,
} from '../../persistence/schemas/ai.schema';

export type ModelTier = 'C' | 'L';

export interface SessionUsage {
  cUsed: number;
  lUsed: number;
  cCap: number;
  lCap: number;
}

/** UTC day key, so the rollover is identical on every replica regardless of host TZ. */
export function dayKey(at = new Date()): string {
  return at.toISOString().slice(0, 10);
}

/**
 * Budget Governor — quota enforcement at two scopes (plan §4.8, §9.3).
 *
 * The per-session reservation is unchanged:
 *  - reserve(): conditional atomic update; matchedCount===0 means exhausted.
 *  - commit(): moves one reservation into used.
 *  - release(): drops a reservation without spending (failure path).
 *
 * What `countCircleCall` adds is a **per-circle daily ceiling**. The session
 * quota bounds one conversation, but a circle can open a new session whenever it
 * likes, so on its own it does not bound a class: ten sessions of 20 calls is 200
 * calls and the per-session cap never once fires. The circle counter is the
 * ceiling that actually bounds spend.
 *
 * The deny path stays explicit (returns false) at both scopes; callers fall back,
 * meter, and show the banner. Degradation is a feature here, not an error.
 */
@Injectable()
export class BudgetGovernor {
  private readonly logger = new Logger(BudgetGovernor.name);
  private readonly soloCCap = 8;

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @InjectModel(QuotaLedger.name) private readonly ledger: Model<QuotaLedgerDocument>,
    @InjectModel(CircleDailySpend.name) private readonly spend: Model<CircleDailySpendDocument>,
  ) {}

  /**
   * Is the circle already out for the day?
   *
   * Read-only on purpose: callers check this *before* reserving, so the common
   * exhausted case costs one indexed read instead of an increment plus its
   * compensating decrement. The authoritative check is still the atomic
   * increment in `countCircleCall`.
   */
  async circleExhausted(circleId: string | undefined, at = new Date()): Promise<boolean> {
    if (!circleId) return false;
    const row = await this.spend.findOne({ _id: `${circleId}:${dayKey(at)}` }).select('calls').lean().exec();
    return (row?.calls ?? 0) >= this.cfg.CIRCLE_DAILY_CALLS;
  }

  /**
   * Count one model call against the circle's day. False = ceiling reached.
   *
   * Increment first, then compare: check-then-increment lets N replicas each read
   * "under the cap" and all spend, which is exactly the failure this exists to
   * prevent. Our own increment is rolled back when it overshoots, because a call
   * that will not happen must not count.
   */
  async countCircleCall(circleId: string | undefined, at = new Date()): Promise<boolean> {
    if (!circleId) return true;
    const day = dayKey(at);
    const row = await this.spend
      .findOneAndUpdate(
        { _id: `${circleId}:${day}` },
        { $inc: { calls: 1 }, $setOnInsert: { circleId, day } },
        { upsert: true, new: true },
      )
      .lean()
      .exec();
    if ((row?.calls ?? 0) > this.cfg.CIRCLE_DAILY_CALLS) {
      await this.uncountCircleCall(circleId, at);
      this.logger.warn(`circle ${circleId} reached the daily model-call ceiling (${this.cfg.CIRCLE_DAILY_CALLS})`);
      return false;
    }
    return true;
  }

  /**
   * Run one metered model call: reserve at both scopes, count the circle day,
   * commit on success, release everything on failure.
   *
   * Callers that already manage their own reserve/commit keep doing so; this is
   * for the places where the pattern would otherwise be retyped. The `finally`
   * that releases on throw is the part worth centralizing — an un-released
   * reservation is a slow leak that silently shrinks the session's budget.
   */
  async metered<T>(tier: ModelTier, sessionId: string, circleId: string | undefined, fn: () => Promise<T>): Promise<T> {
    if (!(await this.reserve(tier, sessionId, circleId))) throw new Error('QUOTA_EXHAUSTED');
    if (!(await this.countCircleCall(circleId))) {
      await this.release(tier, sessionId);
      throw new Error('CIRCLE_DAILY_CAP');
    }
    try {
      const out = await fn();
      await this.commit(tier, sessionId);
      return out;
    } catch (e) {
      await this.release(tier, sessionId);
      // The provider call did not happen or did not succeed, so give the day back.
      await this.uncountCircleCall(circleId);
      throw e;
    }
  }

  /** Give back a counted call (the request failed before provider budget was spent). */
  async uncountCircleCall(circleId: string | undefined, at = new Date()): Promise<void> {
    if (!circleId) return;
    await this.spend.updateOne({ _id: `${circleId}:${dayKey(at)}` }, { $inc: { calls: -1 } }).exec();
  }

  /** Today's spend for a circle, for the dashboard and the banner. */
  async circleUsage(circleId: string, at = new Date()): Promise<{ calls: number; cap: number }> {
    const row = await this.spend.findOne({ _id: `${circleId}:${dayKey(at)}` }).select('calls').lean().exec();
    return { calls: row?.calls ?? 0, cap: this.cfg.CIRCLE_DAILY_CALLS };
  }

  /** Create the ledger row for a session if missing (caps from config). Solo sessions: C cap 8, L cap 0. */
  async ensureSession(sessionId: string, opts?: { solo?: boolean; circleId?: string }): Promise<SessionUsage> {
    const cCap = opts?.solo ? this.soloCCap : this.cfg.QUOTA_C;
    const lCap = opts?.solo ? 0 : this.cfg.QUOTA_L;
    const doc = await this.ledger
      .findOneAndUpdate(
        { _id: sessionId },
        {
          $setOnInsert: { _id: sessionId, cUsed: 0, lUsed: 0, cCap, lCap, reservedC: 0, reservedL: 0 },
          // Recorded here so `commit()` can count the day without every caller
          // having to pass the circle again — a step that would eventually be
          // forgotten at one of them, and the ceiling would leak.
          ...(opts?.circleId ? { $set: { circleId: opts.circleId } } : {}),
        },
        { upsert: true, new: true },
      )
      .lean()
      .exec();
    return { cUsed: doc?.cUsed ?? 0, lUsed: doc?.lUsed ?? 0, cCap, lCap };
  }

  /** Atomic reservation. False = quota exhausted (fallback path, never silent). */
  async reserve(tier: ModelTier, sessionId: string, circleId?: string): Promise<boolean> {
    // Both ceilings are enforced here so no caller can forget one: the circle's day
    // first (a cheap read, and the binding limit for a class), then the session's
    // window via the conditional update below.
    if (await this.circleExhausted(circleId)) return false;
    await this.ensureSession(sessionId, { circleId });
    // Counted on reservation, released on `release()`: reserving is the moment the
    // platform commits to a provider call, and every deny path already calls
    // release. Counting in commit() would let a call that throws go uncounted.
    if (!(await this.countCircleCall(circleId))) return false;
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
    const row = await this.ledger.findOneAndUpdate({ _id: sessionId }, { $inc: inc }, { new: false }).lean().exec();
    // Give the circle's day back: the reservation is dropped, so the call will not
    // happen and must not count. Without this a provider outage would burn the
    // class's whole daily budget in failed attempts.
    if (row?.circleId) await this.uncountCircleCall(row.circleId);
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
