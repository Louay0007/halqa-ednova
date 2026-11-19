import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventBus } from '../../telemetry/event-bus';
import {
  LearnerProgress,
  LearnerProgressDocument,
  XpEntry,
  XpEntryDocument,
} from '../../persistence/schemas/gamification.schema';

const XP_TABLE: Record<string, number> = {
  sharp_question: 20,
  good_explanation: 20,
  bridging: 25,
  kind_skeptic: 20,
  capsule_done: 15,
  correction: 25,
  poll_vote: 3,
  me_too: 3,
  scribe_note: 3,
};

/** Signals capped per calendar day (UTC, matching the `YYYY-MM-DD` key). */
const CAPPED_SIGNALS = new Set(['poll_vote', 'me_too', 'scribe_note']);
const DAILY_CAP = 15;
const STREAK_CAP = 5;

/** The only signals that grant XP. Exported so routes and tests can validate. */
export const SIGNALS: readonly string[] = Object.keys(XP_TABLE);

const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);

/**
 * GamificationService — XP tied to learning signals only (F-GAME).
 *
 * Persistence and authority both changed in the production pass (§4.1, §3.6):
 *
 * - XP used to live in four `Map`s, so every restart wiped a learner's progress
 *   and two replicas disagreed. It now lives in `learner_progress`, with an
 *   append-only `xp_ledger` beside it so a total is always auditable.
 * - `award()` is no longer reachable over HTTP with a client-supplied signal.
 *   XP is a server-side consequence of an action the server already witnessed,
 *   granted by the service that owns that action.
 *
 * Caps: vote/me-too/scribe 15/day, streak cap 5. No leaderboard by design.
 */
@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    @InjectModel(LearnerProgress.name) private readonly progress: Model<LearnerProgressDocument>,
    @InjectModel(XpEntry.name) private readonly ledger: Model<XpEntryDocument>,
    private readonly bus: EventBus,
  ) {}

  /**
   * Grant XP for a signal the server itself observed.
   *
   * Idempotency is the caller's responsibility via `dedupeKey` (typically
   * `${signal}:${qid}`): a repeat for the same key is dropped, so a retried
   * settle cannot double-credit.
   */
  async award(
    learnerId: string,
    sessionId: string,
    circleId: string,
    signal: string,
    dedupeKey?: string,
  ): Promise<{ xp: number; total: number; badges: string[] }> {
    const base = XP_TABLE[signal] ?? 0;
    if (base === 0) return { ...(await this.total(learnerId)) };

    if (dedupeKey && (await this.ledger.exists({ learnerId, sessionId, signal, dedupeKey } as never))) {
      return { ...(await this.total(learnerId)) };
    }

    const day = dayKey();
    const row =
      (await this.progress.findById(learnerId).exec()) ??
      new this.progress({ _id: learnerId, xp: 0, badges: [], streakDays: 0, daily: { day, n: 0 } });

    let grant = base;
    if (CAPPED_SIGNALS.has(signal)) {
      const n = row.daily?.day === day ? row.daily.n : 0;
      grant = Math.max(0, Math.min(base, DAILY_CAP - n));
      row.daily = { day, n: n + grant };
    }

    // Streak: a grant on the next consecutive day advances it; a gap resets to 1.
    if (row.lastStreakDay !== day) {
      const yesterday = dayKey(new Date(Date.now() - 86_400_000));
      row.streakDays = row.lastStreakDay === yesterday ? Math.min(STREAK_CAP, row.streakDays + 1) : 1;
      row.lastStreakDay = day;
    }

    row.xp += grant;
    for (const badge of badgesFor(signal)) {
      if (!row.badges.includes(badge)) row.badges.push(badge);
    }
    row.updatedAt = new Date();
    await row.save();

    if (grant > 0) {
      await this.ledger.create({
        learnerId,
        sessionId,
        circleId,
        signal,
        xp: grant,
        ...(dedupeKey ? { dedupeKey } : {}),
      } as never);
    }

    void this.bus.emit({
      sessionId,
      circleId,
      actor: learnerId,
      type: 'xp_award',
      payload: { signal, xp: grant, total: row.xp },
    });

    return { xp: grant, total: row.xp, badges: [...row.badges] };
  }

  async total(
    learnerId: string,
  ): Promise<{ xp: number; total: number; badges: string[]; streakDays: number }> {
    const row = await this.progress.findById(learnerId).lean().exec();
    return {
      xp: row?.xp ?? 0,
      total: row?.xp ?? 0,
      badges: row?.badges ? [...row.badges] : [],
      streakDays: row?.streakDays ?? 0,
    };
  }

  async streak(learnerId: string): Promise<{ days: number }> {
    const row = await this.progress.findById(learnerId).select('streakDays').lean().exec();
    return { days: Math.min(STREAK_CAP, row?.streakDays ?? 0) };
  }

  /**
   * Recompute a learner's total from the ledger. Used by the audit script and by
   * tests that must prove the read model never drifted from its source.
   */
  async reconcile(learnerId: string): Promise<{ stored: number; ledger: number }> {
    const row = await this.progress.findById(learnerId).lean().exec();
    const agg = await this.ledger.aggregate<{ sum: number }>([
      { $match: { learnerId } },
      { $group: { _id: null, sum: { $sum: '$xp' } } },
    ]);
    return { stored: row?.xp ?? 0, ledger: agg[0]?.sum ?? 0 };
  }
}

function badgesFor(signal: string): string[] {
  switch (signal) {
    case 'bridging':
      return ['Bridge Builder'];
    case 'kind_skeptic':
    case 'correction':
      return ['Kind Skeptic'];
    case 'sharp_question':
      return ['First Light'];
    case 'capsule_done':
      return ['Chain Healer'];
    default:
      return [];
  }
}
