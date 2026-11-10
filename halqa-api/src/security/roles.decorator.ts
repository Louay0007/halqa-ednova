import { SetMetadata } from '@nestjs/common';
import type { TokenRole } from './tokens';

export const ROLES_KEY = 'halqa_roles';
export const Roles = (...roles: TokenRole[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roles);
