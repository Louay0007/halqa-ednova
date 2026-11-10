import { BANDIT_BASELINE, evenWeights, topStyle, updateStyleWeights } from '../../src/domain/bandit';

describe('bandit (pure)', () => {
  it('even weights sum to 1', () => {
    const w = evenWeights();
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
  it('success raises the style, failure lowers it, always renormalised', () => {
    const up = updateStyleWeights(evenWeights(), 'visual', 1);
    expect(up.visual).toBeGreaterThan(1 / 6);
    expect(Object.values(up).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    const down = updateStyleWeights(evenWeights(), 'visual', 0);
    expect(down.visual).toBeLessThan(1 / 6);
  });
  it('repeated success makes the style top (personalisation evidence)', () => {
    let w = evenWeights();
    for (let i = 0; i < 5; i += 1) w = updateStyleWeights(w, 'analogy', 1, BANDIT_BASELINE);
    expect(topStyle(w)).toBe('analogy');
  });
});
