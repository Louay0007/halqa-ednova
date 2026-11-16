import { Err } from '../../common/http-errors';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { ContextMode, Language } from '../../common/types/api-error';
import { CircleService } from './circle.service';
import { OptionalUser } from '../../security/current-user.decorator';
import { Public } from '../../security/roles.decorator';

class CreateCircleDto {
  @IsString()
  @IsNotEmpty()
  topic!: string;
  @IsIn(['class', 'study', 'community', 'workshop', 'program', 'solo'])
  context!: ContextMode;
  @IsIn(['ar', 'darija', 'fr', 'en'])
  lang!: Language;
  @IsOptional()
  @IsString()
  title?: string;
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(90)
  windowS?: number;
  /** Optional: a signed-in caller hosts as themselves and this is ignored. */
  @IsOptional()
  @IsString()
  @MaxLength(24)
  hostNickname?: string;
}

class JoinDto {
  /** Required only for anonymous joins; a signed-in caller joins as themselves. */
  @IsOptional()
  @IsString()
  @MaxLength(24)
  nickname?: string;
  /** Learner whose DNA passport should follow them into the circle (optional). */
  @IsOptional()
  @IsString()
  learnerId?: string;
}

@Controller('circles')
export class CircleController {
  constructor(private readonly circles: CircleService) {}

  @Public()
  @Post()
  create(
    @Body() dto: CreateCircleDto,
    @OptionalUser('sub') actorId: string | undefined,
  ): Promise<{ circleId: string; joinCode: string; hostLearnerId: string; token: string }> {
    return this.circles.create({ ...dto, actorId }).then(({ circle, hostLearnerId, token }) => ({
      circleId: circle._id,
      joinCode: circle.joinCode,
      hostLearnerId,
      token,
    }));
  }

  @Public()
  @Post(':id/join')
  join(
    @Param('id') id: string,
    @Body() dto: JoinDto,
    @OptionalUser('sub') actorId: string | undefined,
  ): Promise<{ learnerId: string; role: string; token: string }> {
    return this.circles.join(id, dto.nickname, actorId, dto.learnerId);
  }

  @Public()
  @Get('by-code/:code')
  byCode(@Param('code') code: string): Promise<{ circleId: string; topic: string; members: number }> {
    return this.circles.byCode(code);
  }

  @Public()
  @Get(':id')
  get(@Param('id') id: string): Promise<unknown> {
    return this.circles.get(id);
  }

  @Public()
  @Get(':id/health')
  health(@Param('id') id: string): Promise<unknown> {
    return this.circles.health(id);
  }
}

@Controller('contexts')
export class ContextController {
  constructor(private readonly circles: CircleService) {}

  @Public()
  @Get(':mode/config')
  config(@Param('mode') mode: ContextMode): unknown {
    if (!['class', 'study', 'community', 'workshop', 'program', 'solo'].includes(mode)) {
      throw Err.bad(`UNKNOWN_CONTEXT:${mode}`);
    }
    return this.circles.configFor(mode);
  }
}
