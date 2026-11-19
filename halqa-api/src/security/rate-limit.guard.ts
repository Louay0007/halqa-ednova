import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_KEY, RateLimitRule } from './rate-limit';

interface Bucket {
  count: number;
  resetAt: number;
}

/** Hard ceiling on tracked buckets, so a flood of distinct callers cannot grow
 *  the map without bound. Above this we sweep before inserting. */
const MAX_BUCKETS = 10_000;

/**
 * Fixed-window rate limiter.
 *
 * Two production caveats, both real and both documented rather than hidden:
 *
 * 1. **Per-instance.** Each replica keeps its own map, so N replicas enforce N×
 *    the configured budget. That is fine for a classroom pilot and not fine for
 *    a public launch — the edge limiter (plan §3.8) is the authoritative budget.
 * 2. **In-memory.** Buckets reset on deploy. Acceptable for abuse damping, not
 *    for anything billed per-call.
 *
 * What it does do correctly: key by caller when authenticated and by IP when the
 * rule says so (join-code brute force happens pre-account), and sweep expired
 * buckets so a long-lived process stays flat.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rule = this.reflector.getAllAndOverride<RateLimitRule | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!rule) return true;

    const req = context.switchToHttp().getRequest<{ ip?: string; auth?: { sub?: string } }>();
    const subject =
      rule.scope === 'ip' ? (req.ip ?? 'unknown') : (req.auth?.sub ?? req.ip ?? 'anon');
    const key = `${context.getClass().name}.${context.getHandler().name}:${subject}`;
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      if (this.buckets.size >= MAX_BUCKETS) this.sweepExpired(now);
      this.buckets.set(key, { count: 1, resetAt: now + rule.windowS * 1000 });
      return true;
    }
    bucket.count += 1;
    if (bucket.count > rule.limit) {
      throw new HttpException(
        {
          // `message` is what GlobalExceptionFilter reads to derive the code, so
          // it must stay the bare code: the filter turns that into the localized
          // `user_msg` body the PWA renders.
          message: 'RATE_LIMITED',
          retryAfterS: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  /** Drop expired buckets so a long-lived process does not grow without bound. */
  private sweepExpired(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (now >= bucket.resetAt) this.buckets.delete(key);
    }
  }
}
