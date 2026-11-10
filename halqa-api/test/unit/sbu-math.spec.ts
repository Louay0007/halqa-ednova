import { computeSBU, needsHuman, ringTier } from '../../src/domain/sbu.math';

describe('sbu.math (pure)', () => {
  it('perfect session → S=1, U=1', () => {
    const rings = computeSBU({
      agendaCompletion: 1,
      timeDiscipline: 1,
      recapDone: true,
      creditsByLearner: { 'L-01': 5, 'L-02': 5 },
      checkSuccessRate: 1,
      avgHintDepth: 0,
      correctionsPerAnswer: 0,
    });
    expect(rings.S).toBeCloseTo(1, 10);
    expect(rings.B).toBeCloseTo(1, 10); // equal credits → zero dispersion
    expect(rings.U).toBeCloseTo(1, 10);
  });
  it('partial progress → S=0.35 (pulse tier)', () => {
    const rings = computeSBU({
      agendaCompletion: 0.5,
      timeDiscipline: 0.5,
      recapDone: false,
      creditsByLearner: {},
      checkSuccessRate: 0.5,
      avgHintDepth: 0,
      correctionsPerAnswer: 0,
    });
    expect(rings.S).toBeCloseTo(0.35, 10);
    expect(ringTier(rings.S)).toBe('pulse');
  });
  it('skewed credits lower B: {9,1} → B=0.2', () => {
    const rings = computeSBU({
      agendaCompletion: 1,
      timeDiscipline: 1,
      recapDone: true,
      creditsByLearner: { 'L-01': 9, 'L-02': 1 },
      checkSuccessRate: 1,
      avgHintDepth: 0,
      correctionsPerAnswer: 0,
    });
    expect(rings.B).toBeCloseTo(0.2, 10);
  });
  it('U blends checks, hint depth, corrections: 0.8/1.5/0.2 → 0.71', () => {
    const rings = computeSBU({
      agendaCompletion: 1,
      timeDiscipline: 1,
      recapDone: true,
      creditsByLearner: { 'L-01': 1 },
      checkSuccessRate: 0.8,
      avgHintDepth: 1.5,
      correctionsPerAnswer: 0.2,
    });
    expect(rings.U).toBeCloseTo(0.71, 10);
    expect(ringTier(rings.U)).toBe('steady');
  });
  it('tiers: ≥0.75 bright · ≥0.45 steady · else pulse', () => {
    expect(ringTier(0.75)).toBe('bright');
    expect(ringTier(0.749)).toBe('steady');
    expect(ringTier(0.45)).toBe('steady');
    expect(ringTier(0.449)).toBe('pulse');
  });
  it('needsHuman: B<0.45 ∨ U<0.45 ∨ misconception open >3 min', () => {
    expect(needsHuman({ S: 1, B: 0.4, U: 0.9 }, 0)).toBe(true);
    expect(needsHuman({ S: 1, B: 0.9, U: 0.4 }, 0)).toBe(true);
    expect(needsHuman({ S: 1, B: 0.9, U: 0.9 }, 5)).toBe(true);
    expect(needsHuman({ S: 1, B: 0.9, U: 0.9 }, 2)).toBe(false);
  });
});
