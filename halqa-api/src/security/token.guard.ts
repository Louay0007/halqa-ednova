import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { APP_CONFIG } from '../core/config/config.module';
import type { AppConfig } from '../core/config/app-config';
import { IS_PUBLIC_KEY, ROLES_KEY } from './roles.decorator';
import { TokenEpochService } from './token-epoch.service';
import { TokenRole, verifyToken } from './tokens';

/**
 * Bearer-token authentication, **default-deny**.
 *
 * A route is reachable without a token only when it (or its controller) carries
 * `@Public()`. Everything else needs a valid, unexpired token whose `ep` claim
 * still matches the learner's stored epoch — so a forgotten decorator fails
 * closed instead of silently exposing the handler. `@Roles(...)`, when present,
 * narrows the handler to those roles.
 *
 * On success `req.auth` holds the verified principal; handlers read actor ids
 * from `@CurrentUser()`, never from the request body.
 */
@Injectable()
export class TokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly epochs: TokenEpochService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<{ headers: Record<string, unknown>; auth?: unknown }>();
    const header = String(req.headers['authorization'] ?? '');
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    // Accept the current secret first, then the previous one, so a rotation is a
    // rolling deploy rather than a mass logout.
    const secrets = [this.cfg.TOKEN_SECRET, this.cfg.TOKEN_SECRET_PREVIOUS].filter(Boolean);
    const body = token ? verifyToken(token, secrets) : null;

    if (!body) {
      if (isPublic) return true;
      throw new UnauthorizedException('AUTH_REQUIRED');
    }

    // Revocation: a token is only good while its epoch matches the stored one.
    const epoch = await this.epochs.current(body.sub);
    if (epoch === null || (body.ep ?? 0) !== epoch) throw new UnauthorizedException('AUTH_INVALID');

    const required = this.reflector.getAllAndOverride<TokenRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required?.length && !required.includes(body.role)) {
      throw new ForbiddenException(`FORBIDDEN_ROLE:${required.join('|')}`);
    }

    req.auth = { sub: body.sub, role: body.role };
    return true;
  }
}
