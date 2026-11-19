import { Controller, Get, Param, Post } from '@nestjs/common';
import { SessionService } from './session.service';
import { LIMITS, RateLimit } from '../../security/rate-limit';
import { Roles } from '../../security/roles.decorator';
import { CurrentUser } from '../../security/current-user.decorator';
import { MembershipService } from '../../security/membership.service';

@Roles('learner')
@Controller('circles/:circleId/sessions')
export class CircleSessionController {
  constructor(
    private readonly sessions: SessionService,
    private readonly members: MembershipService,
  ) {}

  @RateLimit(LIMITS.write)
  @Post()
  async start(@Param('circleId') circleId: string, @CurrentUser('sub') learnerId: string): Promise<{ sessionId: string }> {
    await this.members.assertMember(circleId, learnerId);
    const s = await this.sessions.start(circleId);
    return { sessionId: s._id };
  }
}

@Roles('learner')
@Controller('sessions')
export class SessionController {
  constructor(
    private readonly sessions: SessionService,
    private readonly members: MembershipService,
  ) {}

  @Get(':id')
  async get(@Param('id') id: string, @CurrentUser('sub') learnerId: string): Promise<unknown> {
    await this.members.assertSessionMember(id, learnerId);
    return this.sessions.get(id);
  }

  @RateLimit(LIMITS.write)
  @Post(':id/end')
  async end(@Param('id') id: string, @CurrentUser('sub') learnerId: string): Promise<unknown> {
    await this.members.assertSessionMember(id, learnerId);
    return this.sessions.end(id);
  }

  @Get(':id/credits')
  async credits(@Param('id') id: string, @CurrentUser('sub') learnerId: string): Promise<unknown> {
    await this.members.assertSessionMember(id, learnerId);
    return this.sessions.credits(id);
  }
}
