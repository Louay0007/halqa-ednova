import { Controller, Get, Param, Query } from '@nestjs/common';
import { EventBus } from './event-bus';
import { Roles } from '../security/roles.decorator';

@Roles('mentor', 'admin')
@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly bus: EventBus) {}

  // Phase 0 debug surface, now mentor/admin only: it streams every actor id
  // and event for a session.
  @Get('sessions/:id/events')
  events(@Param('id') id: string, @Query('limit') limit?: string): Promise<unknown> {
    const n = Math.min(Math.max(parseInt(limit ?? '200', 10) || 200, 1), 1000);
    return this.bus.listBySession(id, n);
  }
}
