// Contribution-credit maths — PURE, zero Nest imports (plan §2 rule 4).
// Blueprint F-V2-4: quality-weighted, volume-capped; silent participation counts.
// Weights come from config/equity.yaml (loaded by EquityService); the default
// table below mirrors it and is used when the service passes no overrides.

export type CreditAction =
  | 'sharp_question'
  | 'good_explanation'
  | 'bridging'
  | 'kind_skeptic'
  | 'poll_vote'
  | 'me_too'
  | 'scribe_note'
  | 'plain_message';

export type CreditWeights = Record<CreditAction, number>;

export const DEFAULT_CREDIT_WEIGHTS: CreditWeights = {
  sharp_question: 3,
  good_explanation: 3,
  bridging: 3,
  kind_skeptic: 3,
  poll_vote: 1,
  me_too: 1,
  scribe_note: 1,
  plain_message: 0.5,
};

/** Log-cap constant k=2: effective_plain = 2·ln(1+n), so volume ≠ dominance. */
export const LOG_CAP_K = 2;

export function effectivePlainCount(n: number, k: number = LOG_CAP_K): number {
  if (n <= 0) return 0;
  return k * Math.log(1 + n);
}

export interface ActionCounts {
  sharp_question?: number;
  good_explanation?: number;
  bridging?: number;
  kind_skeptic?: number;
  poll_vote?: number;
  me_too?: number;
  scribe_note?: number;
  plain_message?: number;
}

/** Total credits for one learner from action counts (plain messages log-capped). */
export function creditsFor(counts: ActionCounts, w: CreditWeights = DEFAULT_CREDIT_WEIGHTS): number {
  const c = (k: CreditAction): number => counts[k] ?? 0;
  return (
    c('sharp_question') * w.sharp_question +
    c('good_explanation') * w.good_explanation +
    c('bridging') * w.bridging +
    c('kind_skeptic') * w.kind_skeptic +
    c('poll_vote') * w.poll_vote +
    c('me_too') * w.me_too +
    c('scribe_note') * w.scribe_note +
    effectivePlainCount(c('plain_message')) * w.plain_message
  );
}

/** Normalised dispersion 0..1 (coefficient of variation, capped). 0 = perfectly shared. */
export function coefficientOfVariation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean <= 0) return 0;
  const variance = values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / values.length;
  return Math.min(1, Math.sqrt(variance) / mean);
}

/** Private dominance alert (never public): top learner holds >50% with ≥3 contributors. */
export function dominanceAlert(creditsByLearner: Record<string, number>): { alert: boolean; topLearnerId: string | null } {
  const entries = Object.entries(creditsByLearner);
  if (entries.length < 3) return { alert: false, topLearnerId: null };
  const total = entries.reduce((a, [, v]) => a + v, 0);
  if (total <= 0) return { alert: false, topLearnerId: null };
  const [topId, top] = entries.sort((a, b) => b[1] - a[1])[0];
  return top / total > 0.5 ? { alert: true, topLearnerId: topId } : { alert: false, topLearnerId: null };
}
