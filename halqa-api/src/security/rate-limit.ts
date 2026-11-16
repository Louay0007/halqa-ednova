import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'halqa_rate_limit';

export interface RateLimitRule {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowS: number;
}

/**
 * Per-caller request budget for the few routes that mint or spend something a
 * caller could otherwise farm — nickname minting, note writing. Keyed by caller
 * id when signed in, by IP otherwise (`TokenGuard` runs first, so `req.auth`
 * is already set). In-process and per-instance: enough to stop a single client
 * hammering the demo API, not a replacement for an edge limiter in production.
 */
export const RateLimit = (rule: RateLimitRule) => SetMetadata(RATE_LIMIT_KEY, rule);
