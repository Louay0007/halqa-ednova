import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { APP_CONFIG } from '../core/config/config.module';
import type { AppConfig } from '../core/config/app-config';
import { DegradationService, DegradationMode } from '../ai/degradation/degradation.service';

export type { DegradationMode };

@Controller()
export class ChaosController {
  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly degradation: DegradationService,
  ) {}

  @Get('degradation')
  status(): { mode: DegradationMode } {
    return { mode: this.degradation.getMode() };
  }

  // Dev-only. In production this controller is NOT registered (see security.module.ts).
  @Post('chaos')
  force(@Body() body: { mode: DegradationMode }): { mode: DegradationMode } {
    if (!this.cfg.chaosEnabled) return { mode: this.degradation.getMode() };
    return { mode: this.degradation.force(body?.mode ?? 'green') };
  }
}
