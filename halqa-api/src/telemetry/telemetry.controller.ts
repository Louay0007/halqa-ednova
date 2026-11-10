import { Controller, Get, Param, Query } from '@nestjs/common';
import { EventBus } from './event-bus';

@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly bus: EventBus) {}

  // Phase 0 debug surface (kept; prod keeps it behind admin role in Phase 7).
  @Get('sessions/:id/events')
  events(@Param('id') id: string, @Query('limit') limit?: string): Promise<unknown> {
    const n = Math.min(Math.max(parseInt(limit ?? '200', 10) || 200, 1), 1000);
    return this.bus.listBySession(id, n);
  }
}
