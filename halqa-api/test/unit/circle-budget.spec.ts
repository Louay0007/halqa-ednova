import { BudgetGovernor, dayKey } from '../../src/ai/governor/budget.governor';
import type { AppConfig } from '../../src/core/config/app-config';

/**
 * §9.3 gate: the per-circle daily ceiling.
 *
 * The per-session quota is tested elsewhere and is unchanged. What is new — and
 * what this file exists for — is that a circle cannot exceed its day by opening
 * more sessions, and that failed calls give the day back.
 *
 * These use a fake collection rather than a database because the interesting
 * property is arithmetic and ordering, not persistence: the real query semantics
 * are exercised by the integration suite.
 */

interface Row {
  _id: string;
  cUsed: number;
  lUsed: number;
  cCap: number;
  lCap: number;
  reservedC: number;
  reservedL: number;
  circleId?: string;
  calls?: number;
}

/** Minimal in-memory stand-in for the two collections the governor touches. */
function fakeModels(): { ledger: unknown; spend: unknown; rows: Map<string, Row> } {
  const rows = new Map<string, Row>();
  const get = (id: string): Row => {
    let r = rows.get(id);
    if (!r) {
      r = { _id: id, cUsed: 0, lUsed: 0, cCap: 20, lCap: 5, reservedC: 0, reservedL: 0 };
      rows.set(id, r);
    }
    return r;
  };
  const chain = (fn: () => unknown): unknown => {
    const p = {
      lean: () => p,
      exec: async () => fn(),
      select: () => p,
    };
    return p;
  };

  const ledger = {
    findOneAndUpdate: (filter: { _id: string }, update: Record<string, unknown>) =>
      chain(() => {
        const r = get(filter._id);
        const setOnInsert = (update.$setOnInsert ?? {}) as Partial<Row>;
        for (const [k, v] of Object.entries(setOnInsert)) {
          if ((r as unknown as Record<string, unknown>)[k] === undefined) (r as unknown as Record<string, unknown>)[k] = v;
        }
        const set = (update.$set ?? {}) as Partial<Row>;
        Object.assign(r, set);
        return { ...r };
      }),
    updateOne: (filter: { _id: string }, update: { $inc: Record<string, number> }) =>
      chain(() => {
        const r = get(filter._id);
        for (const [k, v] of Object.entries(update.$inc)) {
          (r as unknown as Record<string, number>)[k] = ((r as unknown as Record<string, number>)[k] ?? 0) + v;
        }
        return { matchedCount: 1 };
      }),
    findOne: (filter: { _id: string }) => chain(() => rows.get(filter._id) ?? null),
  };

  const spend = {
    findOneAndUpdate: (filter: { _id: string }, update: Record<string, unknown>) =>
      chain(() => {
        const r = get(filter._id);
        const setOnInsert = (update.$setOnInsert ?? {}) as Partial<Row>;
        Object.assign(r, setOnInsert);
        const inc = (update.$inc ?? {}) as Record<string, number>;
        for (const [k, v] of Object.entries(inc)) {
          (r as unknown as Record<string, number>)[k] = ((r as unknown as Record<string, number>)[k] ?? 0) + v;
        }
        return { ...r };
      }),
    updateOne: (filter: { _id: string }, update: { $inc: Record<string, number> }) =>
      chain(() => {
        const r = get(filter._id);
        for (const [k, v] of Object.entries(update.$inc)) {
          (r as unknown as Record<string, number>)[k] = ((r as unknown as Record<string, number>)[k] ?? 0) + v;
        }
        return { matchedCount: 1 };
      }),
    findOne: (filter: { _id: string }) => chain(() => rows.get(filter._id) ?? null),
  };

  return { ledger, spend, rows };
}

function governor(cap = 5): { gov: BudgetGovernor; rows: Map<string, Row> } {
  const cfg = { QUOTA_C: 20, QUOTA_L: 5, CIRCLE_DAILY_CALLS: cap } as AppConfig;
  const models = fakeModels();
  const gov = new BudgetGovernor(cfg, models.ledger as never, models.spend as never);
  return { gov, rows: models.rows };
}

describe('per-circle daily model-call ceiling (§9.3)', () => {
  it('dayKey is UTC and date-only, so the rollover is the same on every replica', () => {
    // 23:30 in a +02:00 zone is still the previous UTC day; using local time would
    // roll the budget over at a different moment per pod.
    const d = new Date('2026-03-01T23:30:00+02:00');
    expect(dayKey(d)).toBe('2026-03-01');
    expect(new Date('2026-03-01T23:30:00Z')).toBeInstanceOf(Date);
    expect(dayKey(new Date('2026-03-01T23:30:00Z'))).toBe('2026-03-01');
  });

  it('refuses the call that would exceed the cap, and does not count it', async () => {
    const { gov, rows } = governor(5);
    const circle = 'C-1';
    for (let i = 0; i < 5; i += 1) {
      expect(await gov.countCircleCall(circle)).toBe(true);
    }
    // The sixth would make six of five, so it is refused and rolled back; the
    // counter must read exactly 5, not 6.
    expect(await gov.countCircleCall(circle)).toBe(false);
    expect(rows.get(`${circle}:${dayKey()}`)?.calls).toBe(5);
  });

  it('stops a second session in the same circle — the reason it exists', async () => {
    const { gov } = governor(3);
    // Three calls across three different sessions of one circle. A per-session
    // cap would allow 3 x 20 here and never fire; the circle ceiling binds.
    expect(await gov.reserve('C', 'S-a', 'C-1')).toBe(true);
    expect(await gov.reserve('C', 'S-b', 'C-1')).toBe(true);
    expect(await gov.reserve('C', 'S-c', 'C-1')).toBe(true);
    expect(await gov.reserve('C', 'S-d', 'C-1')).toBe(false);
  });

  it('gives the day back when a reservation is released', async () => {
    const { gov, rows } = governor(2);
    await gov.reserve('C', 'S-1', 'C-1');
    await gov.reserve('C', 'S-1', 'C-1');
    // Both reserved, circle day now full.
    expect(await gov.circleExhausted('C-1')).toBe(true);
    // A provider failure releases one; the call did not happen, so the day must
    // not be spent — otherwise an outage burns the class's whole budget.
    await gov.release('C', 'S-1');
    expect(rows.get(`C-1:${dayKey()}`)?.calls).toBe(1);
    expect(await gov.circleExhausted('C-1')).toBe(false);
  });

  it('is per circle and per day, not global', async () => {
    const { gov } = governor(1);
    expect(await gov.reserve('C', 'S-1', 'C-1')).toBe(true);
    expect(await gov.reserve('C', 'S-1', 'C-2')).toBe(true);
    // Tomorrow is a fresh budget: the key carries the date.
    const tomorrow = new Date(Date.now() + 86_400_000);
    expect(await gov.countCircleCall('C-1', tomorrow)).toBe(true);
  });

  it('does not limit when no circle is known (solo has its own 8/0 cap)', async () => {
    const { gov } = governor(1);
    expect(await gov.reserve('C', 'S-solo', undefined)).toBe(true);
    expect(await gov.reserve('C', 'S-solo', undefined)).toBe(true);
  });
});
