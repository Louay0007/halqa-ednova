import { Injectable } from '@nestjs/common';
import { EventBus } from '../../telemetry/event-bus';

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

const DAILY_CAP = 15;
const STREAK_CAP = 5;

/**
 * GamificationService — XP tied to learning signals only (F-GAME).
 * Caps enforced: vote/me-too/scribe 15/day, streak +10/day cap 5.
 * NO public leaderboard endpoint exists by design (private-first).
 */
@Injectable()
export class GamificationService {
  private xp = new Map<string, number>();
  private daily = new Map<string, { day: string; n: number }>();
  private badges = new Map<string, Set<string>>();
  private streaks = new Map<string, { last: string; n: number }>();

  constructor(private readonly bus: EventBus) {}

  award(learnerId: string, sessionId: string, circleId: string, signal: string): { xp: number; total: number } {
    const base = XP_TABLE[signal] ?? 0;
    let grant = base;
    if (['poll_vote', 'me_too', 'scribe_note'].includes(signal)) {
      const day = new Date().toISOString().slice(0, 10);
      const key = `${learnerId}:${day}`;
      const cur = this.daily.get(key) ?? { day, n: 0 };
      const room = Math.max(0, DAILY_CAP - cur.n);
      grant = Math.min(base, room);
      this.daily.set(key, { day, n: cur.n + grant });
    }
    const total = (this.xp.get(learnerId) ?? 0) + grant;
    this.xp.set(learnerId, total);
    this.badgesFor(learnerId, signal);
    void this.bus.emit({ sessionId, circleId, actor: learnerId, type: 'xp_award', payload: { signal, xp: grant, total } });
    return { xp: grant, total };
  }

  total(learnerId: string): { total: number; badges: string[] } {
    return { total: this.xp.get(learnerId) ?? 0, badges: [...(this.badges.get(learnerId) ?? [])] };
  }

  streak(learnerId: string): { days: number } {
    return { days: Math.min(STREAK_CAP, this.streaks.get(learnerId)?.n ?? 0) };
  }

  private badgesFor(learnerId: string, signal: string): void {
    const set = this.badges.get(learnerId) ?? new Set<string>();
    if (signal === 'bridging') set.add('Bridge Builder');
    if (signal === 'kind_skeptic' || signal === 'correction') set.add('Kind Skeptic');
    if (signal === 'sharp_question') set.add('First Light');
    if (signal === 'capsule_done') set.add('Chain Healer');
    this.badges.set(learnerId, set);
  }
}
