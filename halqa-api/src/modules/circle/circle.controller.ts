import { Err } from '../../common/http-errors';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { ContextMode, Language } from '../../common/types/api-error';
import { CircleService } from './circle.service';

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
  @IsString()
  @IsNotEmpty()
  @MaxLength(24)
  hostNickname!: string;
}

class JoinDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(24)
  nickname!: string;
}

@Controller('circles')
export class CircleController {
  constructor(private readonly circles: CircleService) {}

  @Post()
  create(@Body() dto: CreateCircleDto): Promise<{ circleId: string; joinCode: string; hostLearnerId: string; token: string }> {
    return this.circles.create(dto).then(({ circle, hostLearnerId, token }) => ({
      circleId: circle._id,
      joinCode: circle.joinCode,
      hostLearnerId,
      token,
    }));
  }

  @Post(':id/join')
  join(@Param('id') id: string, @Body() dto: JoinDto): Promise<{ learnerId: string; role: string; token: string }> {
    return this.circles.join(id, dto.nickname);
  }

  @Get('by-code/:code')
  byCode(@Param('code') code: string): Promise<{ circleId: string; topic: string; members: number }> {
    return this.circles.byCode(code);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<unknown> {
    return this.circles.get(id);
  }

  @Get(':id/health')
  health(@Param('id') id: string): Promise<unknown> {
    return this.circles.health(id);
  }
}

@Controller('contexts')
export class ContextController {
  constructor(private readonly circles: CircleService) {}

  @Get(':mode/config')
  config(@Param('mode') mode: ContextMode): unknown {
    if (!['class', 'study', 'community', 'workshop', 'program', 'solo'].includes(mode)) {
      throw Err.bad(`UNKNOWN_CONTEXT:${mode}`);
    }
    return this.circles.configFor(mode);
  }
}
