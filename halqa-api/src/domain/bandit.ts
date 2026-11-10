// Learning-DNA bandit — PURE, zero Nest imports.
// After each check-question: w_style += 0.1·(success − baseline), renormalised.
// Adaptation picks the top style; the report shows one learner's weight shift.

export type StyleKey = 'visual' | 'analogy' | 'steps' | 'example' | 'repetition' | 'practice';

export const STYLE_KEYS: StyleKey[] = ['visual', 'analogy', 'steps', 'example', 'repetition', 'practice'];

export type StyleWeights = Record<StyleKey, number>;

export const BANDIT_ALPHA = 0.1;
export const BANDIT_BASELINE = 0.5;

export function evenWeights(): StyleWeights {
  const w = 1 / STYLE_KEYS.length;
  return { visual: w, analogy: w, steps: w, example: w, repetition: w, practice: w };
}

/** One bandit update; always returns weights summing to 1. */
export function updateStyleWeights(
  current: StyleWeights,
  style: StyleKey,
  success: 0 | 1,
  baseline: number = BANDIT_BASELINE,
  alpha: number = BANDIT_ALPHA,
): StyleWeights {
  const next = { ...current, [style]: Math.max(0.01, current[style] + alpha * (success - baseline)) };
  const total = STYLE_KEYS.reduce((a, k) => a + next[k], 0);
  for (const k of STYLE_KEYS) next[k] = next[k] / total;
  return next;
}

export function topStyle(weights: StyleWeights): StyleKey {
  return STYLE_KEYS.reduce((a, b) => (weights[b] > weights[a] ? b : a));
}
