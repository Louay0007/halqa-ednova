import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { TokenRole } from './tokens';

/** What `TokenGuard` attaches to the request. The only trustworthy identity on a handler. */
export interface AuthPrincipal {
  sub: string;
  role: TokenRole;
}

function principalOf(ctx: ExecutionContext): AuthPrincipal | undefined {
  return ctx.switchToHttp().getRequest<{ auth?: AuthPrincipal }>().auth;
}

/**
 * `@CurrentUser()` → the whole principal, `@CurrentUser('sub')` → the learner id.
 * Handlers take actor ids from here, never from the request body: a body id is
 * caller-controlled, so a valid token could otherwise act as any other learner.
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthPrincipal | undefined, ctx: ExecutionContext): AuthPrincipal | string => {
    const principal = principalOf(ctx);
    if (!principal) throw new UnauthorizedException('AUTH_REQUIRED');
    return field ? principal[field] : principal;
  },
);

/**
 * For `@Public()` routes that behave differently when a token *is* present —
 * a signed-in visitor hosts a circle as themselves, an anonymous one is minted.
 * Same trust model as `CurrentUser`, just nullable.
 */
export const OptionalUser = createParamDecorator(
  (field: keyof AuthPrincipal | undefined, ctx: ExecutionContext): AuthPrincipal | string | undefined => {
    const principal = principalOf(ctx);
    if (!principal) return undefined;
    return field ? principal[field] : principal;
  },
);
