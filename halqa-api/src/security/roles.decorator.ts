import { SetMetadata } from '@nestjs/common';
import type { TokenRole } from './tokens';

export const ROLES_KEY = 'halqa_roles';
export const IS_PUBLIC_KEY = 'halqa_public';

export const Roles = (...roles: TokenRole[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roles);

/**
 * Opt a route (or a whole controller) out of authentication.
 * The guard is default-deny: anything without `@Public()` and without a valid
 * bearer token is rejected, so a forgotten decorator fails closed.
 */
export const Public = (): ReturnType<typeof SetMetadata> => SetMetadata(IS_PUBLIC_KEY, true);
