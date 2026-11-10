import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { APP_CONFIG } from '../core/config/config.module';
import type { AppConfig } from '../core/config/app-config';
import { ROLES_KEY } from './roles.decorator';
import { TokenRole, verifyToken } from './tokens';

@Injectable()
export class TokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<TokenRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true; // public route
    const req = context.switchToHttp().getRequest();
    const header = String(req.headers['authorization'] ?? '');
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const body = token ? verifyToken(token, this.cfg.TOKEN_SECRET) : null;
    if (!body) throw new UnauthorizedException('Missing or invalid token');
    if (!required.includes(body.role)) throw new UnauthorizedException('Forbidden for role');
    req.auth = body;
    return true;
  }
}
