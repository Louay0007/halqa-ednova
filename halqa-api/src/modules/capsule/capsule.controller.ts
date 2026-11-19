import { Controller, Get, Param, Post } from '@nestjs/common';
import { CapsuleService } from './capsule.service';
import { LIMITS, RateLimit } from '../../security/rate-limit';
import { Roles } from '../../security/roles.decorator';
import { CurrentUser } from '../../security/current-user.decorator';
import { MembershipService } from '../../security/membership.service';

@Roles('learner')
@Controller('sessions')
export class CapsuleController {
  constructor(
    private readonly capsule: CapsuleService,
    private readonly members: MembershipService,
  ) {}

  @RateLimit(LIMITS.ai)
  @Post(':id/capsule')
  async build(@Param('id') id: string, @CurrentUser('sub') learnerId: string): Promise<unknown> {
    await this.members.assertSessionMember(id, learnerId);
    return this.capsule.build(id);
  }

  @Get(':id/capsule')
  async get(@Param('id') id: string, @CurrentUser('sub') learnerId: string): Promise<unknown> {
    await this.members.assertSessionMember(id, learnerId);
    return this.capsule.get(id);
  }
}
