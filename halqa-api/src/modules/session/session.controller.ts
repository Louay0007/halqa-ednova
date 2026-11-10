import { Controller, Get, Param, Post } from '@nestjs/common';
import { SessionService } from './session.service';

@Controller('circles/:circleId/sessions')
export class CircleSessionController {
  constructor(private readonly sessions: SessionService) {}

  @Post()
  start(@Param('circleId') circleId: string): Promise<{ sessionId: string }> {
    return this.sessions.start(circleId).then((s) => ({ sessionId: s._id }));
  }
}

@Controller('sessions')
export class SessionController {
  constructor(private readonly sessions: SessionService) {}

  @Get(':id')
  get(@Param('id') id: string): Promise<unknown> {
    return this.sessions.get(id);
  }

  @Post(':id/end')
  end(@Param('id') id: string): Promise<unknown> {
    return this.sessions.end(id);
  }

  @Get(':id/credits')
  credits(@Param('id') id: string): Promise<unknown> {
    return this.sessions.credits(id);
  }
}
