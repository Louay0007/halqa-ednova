import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { APP_CONFIG } from '../core/config/config.module';
import type { AppConfig } from '../core/config/app-config';
import { DegradationService, DegradationMode } from '../ai/degradation/degradation.service';
import { Public, Roles } from './roles.decorator';
import { LIMITS, RateLimit } from './rate-limit';

export type { DegradationMode };

/**
 * Read-only degradation status. Always registered: the frontend's degradation banner
 * needs it in production too, otherwise it silently stays "green" during a real outage.
 */
@Public()
@Controller()
export class DegradationController {
  constructor(private readonly degradation: DegradationService) {}

  @Get('degradation')
  status(): { mode: DegradationMode } {
    return { mode: this.degradation.getMode() };
  }
}

/**
 * Dev-only: NOT registered in production (see security.module.ts).
 *
 * Kept behind `chaosEnabled` and, defence in depth, an admin role: forcing the
 * platform into BLACK must never be reachable by a learner even in a staging
 * build where the controller is mounted.
 */
@Roles('admin')
@RateLimit(LIMITS.write)
@Controller()
export class ChaosController {
  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly degradation: DegradationService,
  ) {}

  @Post('chaos')
  force(@Body() body: { mode: DegradationMode }): { mode: DegradationMode } {
    if (!this.cfg.chaosEnabled) return { mode: this.degradation.getMode() };
    return { mode: this.degradation.force(body?.mode ?? 'green') };
  }
}
