import {
  coefficientOfVariation,
  creditsFor,
  dominanceAlert,
  effectivePlainCount,
} from '../../src/domain/credits.math';

describe('credits.math (pure)', () => {
  it('log cap: 12 plain messages → effective ≈ 2·ln13 ≈ 5.13', () => {
    expect(effectivePlainCount(12)).toBeCloseTo(2 * Math.log(13), 10);
    expect(effectivePlainCount(12)).toBeCloseTo(5.13, 2);
    expect(effectivePlainCount(0)).toBe(0);
  });
  it('volume has diminishing returns: 100 msgs < 4× the 12-msg value', () => {
    expect(effectivePlainCount(100) / effectivePlainCount(12)).toBeLessThan(2);
  });
  it('worked example: quality (7) outranks volume (12 plain → ≈2.56 weighted)', () => {
    // Blueprint §1 numbers: effective count 5.13 is the PRE-WEIGHT volume term;
    // with the plain_message weight 0.5 the volume total is ≈2.56. Either way B wins.
    const A = creditsFor({ plain_message: 12 });
    const B = creditsFor({ sharp_question: 1, bridging: 1, poll_vote: 1 });
    expect(A).toBeCloseTo(2.56, 2);
    expect(B).toBe(7);
    expect(B).toBeGreaterThan(A);
  });
  it('dispersion: 0 for equal, →1 for winner-takes-all', () => {
    expect(coefficientOfVariation([5, 5, 5])).toBe(0);
    expect(coefficientOfVariation([])).toBe(0);
    expect(coefficientOfVariation([9, 0, 0])).toBeCloseTo(1, 10); // capped
    expect(coefficientOfVariation([7, 5.13])).toBeGreaterThan(0);
  });
  it('dominance alert is private, needs ≥3 contributors and >50% share', () => {
    expect(dominanceAlert({ 'L-01': 9, 'L-02': 1 })).toEqual({ alert: false, topLearnerId: null });
    expect(dominanceAlert({ 'L-01': 7, 'L-02': 2, 'L-03': 1 })).toEqual({ alert: true, topLearnerId: 'L-01' });
    expect(dominanceAlert({ 'L-01': 4, 'L-02': 3, 'L-03': 3 })).toEqual({ alert: false, topLearnerId: null });
  });
});
