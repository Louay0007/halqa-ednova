import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TokenGuard } from '../../src/security/token.guard';
import { RateLimitGuard } from '../../src/security/rate-limit.guard';
import { RATE_LIMIT_KEY, type RateLimitRule } from '../../src/security/rate-limit';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../../src/security/roles.decorator';
import { signToken, type TokenRole } from '../../src/security/tokens';

const SECRET = 'guard-test-secret';

/** Minimal ExecutionContext: the guards only touch headers, auth and handler metadata. */
function ctx(headers: Record<string, string> = {}): { ctx: ExecutionContext; req: { headers: Record<string, unknown>; auth?: { sub: string; role: TokenRole } } } {
  const req: { headers: Record<string, unknown>; auth?: { sub: string; role: TokenRole } } = { headers };
  const ctx = {
    getHandler: () => 'handler',
    getClass: () => 'klass',
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { ctx, req };
}

function guardFor(meta: { public?: boolean; roles?: TokenRole[] }, epoch: number | null = 0): TokenGuard {
  const reflector = {
    getAllAndOverride: (key: string) => {
      if (key === IS_PUBLIC_KEY) return meta.public;
      if (key === ROLES_KEY) return meta.roles;
      return undefined;
    },
  } as unknown as Reflector;
  const epochs = { current: async () => epoch } as never;
  return new TokenGuard(reflector, { TOKEN_SECRET: SECRET } as never, epochs);
}

const token = (over: { sub?: string; role?: TokenRole; ep?: number; ttlS?: number } = {}) =>
  signToken({ sub: over.sub ?? 'L-01', role: over.role ?? 'learner', ep: over.ep ?? 0 }, SECRET, over.ttlS);

describe('TokenGuard (default-deny)', () => {
  it('rejects a guarded route with no token', async () => {
    const { ctx: c } = ctx();
    await expect(guardFor({}).canActivate(c)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows an unguarded route only when it is @Public()', async () => {
    const { ctx: c } = ctx();
    await expect(guardFor({ public: true }).canActivate(c)).resolves.toBe(true);
  });

  it('exposes the verified principal, not the body', async () => {
    const { ctx: c, req } = ctx({ authorization: `Bearer ${token({ sub: 'L-07' })}` });
    await guardFor({ roles: ['learner'] }).canActivate(c);
    expect(req.auth).toEqual({ sub: 'L-07', role: 'learner' });
  });

  it('rejects a token signed with another secret', async () => {
    const forged = signToken({ sub: 'L-01', role: 'learner', ep: 0 }, 'not-the-secret');
    const { ctx: c } = ctx({ authorization: `Bearer ${forged}` });
    await expect(guardFor({}).canActivate(c)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token whose epoch was bumped (sign-out)', async () => {
    const { ctx: c } = ctx({ authorization: `Bearer ${token({ ep: 0 })}` });
    await expect(guardFor({}, 1).canActivate(c)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token for a learner that no longer exists', async () => {
    const { ctx: c } = ctx({ authorization: `Bearer ${token()}` });
    await expect(guardFor({}, null).canActivate(c)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('still denies the wrong role, and reports which role was needed', async () => {
    const { ctx: c, req } = ctx({ authorization: `Bearer ${token({ role: 'learner' })}` });
    const err = await guardFor({ roles: ['mentor'] }).canActivate(c).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).message).toContain('FORBIDDEN_ROLE');
    expect(req.auth).toBeUndefined();
  });

  it('lets an unlisted role through when no @Roles is declared', async () => {
    // Guarded but role-agnostic: authentication alone is the gate.
    const { ctx: c } = ctx({ authorization: `Bearer ${token({ role: 'admin' })}` });
    await expect(guardFor({}).canActivate(c)).resolves.toBe(true);
  });
});

describe('RateLimitGuard', () => {
  function limiter(rule: RateLimitRule | undefined): RateLimitGuard {
    const reflector = { getAllAndOverride: (key: string) => (key === RATE_LIMIT_KEY ? rule : undefined) } as unknown as Reflector;
    return new RateLimitGuard(reflector);
  }
  const call = (g: RateLimitGuard, sub = 'L-01') => {
    const { ctx: c, req } = ctx();
    req.auth = { sub, role: 'learner' };
    return g.canActivate(c);
  };

  it('is a no-op for routes without a rule', () => {
    const g = limiter(undefined);
    for (let i = 0; i < 50; i += 1) expect(call(g)).toBe(true);
  });

  it('allows the budget then refuses with 429', () => {
    const g = limiter({ limit: 2, windowS: 60 });
    expect(call(g)).toBe(true);
    expect(call(g)).toBe(true);
    expect(() => call(g)).toThrow(/RATE_LIMITED/);
  });

  it('budgets each caller separately', () => {
    const g = limiter({ limit: 1, windowS: 60 });
    expect(call(g, 'L-01')).toBe(true);
    expect(call(g, 'L-02')).toBe(true);
    expect(() => call(g, 'L-01')).toThrow(/RATE_LIMITED/);
  });
});
