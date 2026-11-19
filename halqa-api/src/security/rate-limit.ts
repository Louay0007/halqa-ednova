import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'halqa_rate_limit';

export interface RateLimitRule {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowS: number;
  /** What the bucket is keyed on. `ip` matters for unauthenticated routes and
   *  for anything that can be attacked before an account exists. */
  scope?: 'caller' | 'ip';
}

/**
 * Per-caller request budget.
 *
 * Keyed by caller id when signed in, by IP otherwise (`TokenGuard` runs first,
 * so `req.auth` is already set). This is the in-app half of a two-layer budget:
 * it stops one client hammering the API, but it is per-instance and in-memory,
 * so production also needs the edge limiter described in plan §3.8.
 */
export const RateLimit = (rule: RateLimitRule) => SetMetadata(RATE_LIMIT_KEY, rule);

/**
 * Named budgets, so a limit is a product decision made once rather than a magic
 * number repeated at every route. Every AI-spending route takes `ai`; anything
 * that can brute-force a secret takes `code`.
 *
 * The IP-scoped budgets are sized for a **classroom behind one NAT**, which is
 * the delivery context this product actually has. A whole class arrives from a
 * single school IP, so a limit tight enough to look strict per-IP would be a
 * mass outage at 09:00: 30 learners typing a join code in the same thirty
 * seconds must all get in. Brute-force protection therefore does not lean on
 * these numbers — it leans on high-entropy codes plus the edge limiter (§3.8),
 * which is the authoritative budget.
 */
export const LIMITS = {
  /** Anything that spends provider budget (coach, hints, capsule, whisper, solo). */
  ai: { limit: 10, windowS: 60 } satisfies RateLimitRule,
  /** Writes that create or mutate rows in a circle. */
  write: { limit: 30, windowS: 60 } satisfies RateLimitRule,
  /** Join-code lookup. Sized for a class joining at once; see the note above. */
  code: { limit: 60, windowS: 60, scope: 'ip' } satisfies RateLimitRule,
  /** Circle creation mints a learner + token. A class of 40 in groups of four
   *  is ten circles in the first minute, and a teacher may open a few more. */
  createCircle: { limit: 20, windowS: 60, scope: 'ip' } satisfies RateLimitRule,
  /** Polling is benign but chatty; a runaway tab should not fill the log. */
  poll: { limit: 120, windowS: 60 } satisfies RateLimitRule,
} as const;
