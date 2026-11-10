// S-B-U ring maths — PURE, zero Nest imports (plan §2 rule 4).
// Blueprint F-V2-3: S = 0.4·agenda + 0.3·time + 0.3·recap
//                   U = 0.5·checks + 0.3·(1−hintDepth/3) + 0.2·(1−corrections)
//                   B = 1 − dispersion(credits)  (dispersion lives in credits.math)

import { coefficientOfVariation } from './credits.math';

export interface SbuWeights {
  s: { agenda_completion: number; time_discipline: number; recap_done: number };
  u: { check_success_rate: number; hint_depth: number; corrections: number };
  thresholds: { bright: number; steady: number };
}

export const DEFAULT_SBU_WEIGHTS: SbuWeights = {
  s: { agenda_completion: 0.4, time_discipline: 0.3, recap_done: 0.3 },
  u: { check_success_rate: 0.5, hint_depth: 0.3, corrections: 0.2 },
  thresholds: { bright: 0.75, steady: 0.45 },
};

/** Raw ingredients — stored on the session as healthInputs for auditability. */
export interface HealthInputs {
  agendaCompletion: number; // done steps / total steps, 0..1 (0 when no agenda)
  timeDiscipline: number; // planned/actual time clamped 0..1 (0.5 neutral when unmeasurable)
  recapDone: boolean;
  creditsByLearner: Record<string, number>;
  checkSuccessRate: number; // 0..1 (0.5 neutral prior when no checks yet)
  avgHintDepth: number; // 0..4 (0 = no hints needed)
  correctionsPerAnswer: number; // capped 0..1 upstream
}

export interface SbuRings {
  S: number;
  B: number;
  U: number;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

export function computeSBU(inputs: HealthInputs, w: SbuWeights = DEFAULT_SBU_WEIGHTS): SbuRings {
  const S =
    w.s.agenda_completion * clamp01(inputs.agendaCompletion) +
    w.s.time_discipline * clamp01(inputs.timeDiscipline) +
    w.s.recap_done * (inputs.recapDone ? 1 : 0);
  const credits = Object.values(inputs.creditsByLearner);
  const B = credits.length < 2 ? 0.5 : 1 - coefficientOfVariation(credits);
  const U =
    w.u.check_success_rate * clamp01(inputs.checkSuccessRate) +
    w.u.hint_depth * (1 - clamp01(inputs.avgHintDepth / 3)) +
    w.u.corrections * (1 - clamp01(inputs.correctionsPerAnswer));
  return { S: clamp01(S), B: clamp01(B), U: clamp01(U) };
}

export type RingTier = 'bright' | 'steady' | 'pulse';

/** Display tier: ≥0.75 bright · 0.45–0.75 steady · <0.45 pulse (no red/shame styling). */
export function ringTier(value: number, w: SbuWeights = DEFAULT_SBU_WEIGHTS): RingTier {
  if (value >= w.thresholds.bright) return 'bright';
  if (value >= w.thresholds.steady) return 'steady';
  return 'pulse';
}

/** Mentor-board rule (F-V2-6): a circle needs a human now. */
export function needsHuman(rings: SbuRings, misconceptionOpenMin: number): boolean {
  return rings.B < 0.45 || rings.U < 0.45 || misconceptionOpenMin > 3;
}
