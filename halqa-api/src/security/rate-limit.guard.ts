import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_KEY, RateLimitRule } from './rate-limit';

interface Bucket {
  count: number;
  resetAt: number;
}

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
    const key = `${context.getClass().name}.${context.getHandler().name}:${req.auth?.sub ?? req.ip ?? 'anon'}`;
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + rule.windowS * 1000 });
      this.sweep(now);
      return true;
    }
    bucket.count += 1;
    if (bucket.count > rule.limit) throw new HttpException('RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS);
    return true;
  }

  /** Drop expired buckets so a long-lived process does not grow without bound. */
  private sweep(now: number): void {
    if (this.buckets.size < 1000) return;
    for (const [key, bucket] of this.buckets) {
      if (now >= bucket.resetAt) this.buckets.delete(key);
    }
  }
}
