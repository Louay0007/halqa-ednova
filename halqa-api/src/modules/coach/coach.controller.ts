import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CoachService } from './coach.service';
import { LIMITS, RateLimit } from '../../security/rate-limit';
import { Roles } from '../../security/roles.decorator';
import { CurrentUser } from '../../security/current-user.decorator';
import { MembershipService } from '../../security/membership.service';

class NudgeDto {
  /** Deprecated: the explainer is the authenticated caller. */
  @IsOptional()
  @IsString()
  explainerId?: string;
  @IsString()
  @IsNotEmpty()
  sessionId!: string;
  @IsString()
  @IsNotEmpty()
  circleId!: string;
}

class RephraseDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;
  @IsString()
  @IsNotEmpty()
  circleId!: string;
  @IsString()
  @IsNotEmpty()
  text!: string;
  @IsIn(['visual', 'analogy', 'steps', 'example', 'repetition', 'practice'])
  style!: string;
  @IsIn(['ar', 'darija', 'fr', 'en'])
  lang!: string;
}

@Roles('learner')
@Controller()
export class CoachController {
  constructor(
    private readonly coach: CoachService,
    private readonly members: MembershipService,
  ) {}

  @Get('passports/:id/explain-card')
  card(@Param('id') id: string): Promise<{ card: string; visible: boolean }> {
    return this.coach.card(id);
  }

  @RateLimit(LIMITS.ai)
  @Post('coach/nudge/:targetId')
  async nudge(
    @Param('targetId') target: string,
    @CurrentUser('sub') explainerId: string,
    @Body() dto: NudgeDto,
  ): Promise<{ nudge: string; private: true }> {
    await this.members.assertMembers(dto.circleId, [explainerId, target]);
    return this.coach.nudge(explainerId, target, dto.sessionId, dto.circleId);
  }

  @RateLimit(LIMITS.ai)
  @Post('coach/rephrase')
  async rephrase(@CurrentUser('sub') learnerId: string, @Body() dto: RephraseDto): Promise<{ suggestion: string }> {
    await this.members.assertMember(dto.circleId, learnerId);
    return this.coach.rephrase(dto.sessionId, dto.circleId, dto.text, dto.style, dto.lang);
  }
}
