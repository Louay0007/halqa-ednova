// ID formats — synthetic, human-readable, PII-free.
// Learners L-01.., circles C-1.., sessions S-<ulid-ish>.
import { randomBytes } from 'crypto';

export const LEARNER_ID = /^L-\d{2,4}$/;
export const CIRCLE_ID = /^C-\d{1,4}$/;
export const SESSION_ID = /^S-[A-Za-z0-9]{6,26}$/;

let learnerSeq = 0;
let circleSeq = 0;

export function nextLearnerId(): string {
  learnerSeq += 1;
  return `L-${String(learnerSeq).padStart(2, '0')}`;
}
export function nextCircleId(): string {
  circleSeq += 1;
  return `C-${circleSeq}`;
}
export function resetIdCounters(): void {
  learnerSeq = 0;
  circleSeq = 0;
}

export const AVATAR_KEYS = ['fox', 'owl', 'star', 'deer', 'wave', 'comet', 'palm', 'lamp'] as const;
export type AvatarKey = (typeof AVATAR_KEYS)[number];

/** Alphabet excludes I/L/O/0/1 so a code read aloud is never ambiguous. */
export const JOIN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function joinCode(): string {
  const bytes = randomBytes(6);
  return [...bytes].map((b) => JOIN_ALPHABET[b % JOIN_ALPHABET.length]).join('');
}

/** Deterministic 6-char code for the demo reset (same seed → same code). */
export function stableJoinCode(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const chars: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    chars.push(JOIN_ALPHABET[h % JOIN_ALPHABET.length]);
  }
  return chars.join('');
}
