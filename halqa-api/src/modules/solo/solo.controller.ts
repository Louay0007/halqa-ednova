import { Body, Controller, Param, Post } from '@nestjs/common';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SoloHat, SoloService } from './solo.service';
import { LIMITS, RateLimit } from '../../security/rate-limit';
import { Roles } from '../../security/roles.decorator';
import { CurrentUser } from '../../security/current-user.decorator';

class StartDto {
  @IsString()
  @IsNotEmpty()
  topic!: string;
  @IsIn(['ar', 'darija', 'fr', 'en'])
  lang!: string;
  /** Deprecated: the learner is the authenticated caller. */
  @IsOptional()
  @IsString()
  learnerId?: string;
}

class TurnDto {
  /** Deprecated: the learner is the authenticated caller. */
  @IsOptional()
  @IsString()
  learnerId?: string;
  @IsString()
  @IsNotEmpty()
  text!: string;
  @IsOptional()
  @IsIn(['ar', 'darija', 'fr', 'en'])
  lang?: string;
}

class HatDto {
  @IsIn(['NOVA_NOVICE', 'NOVA_SKEPTIC', 'NOVA_CURIOUS', 'NOVA_EXAMINER'])
  hat!: SoloHat;
}

@Roles('learner')
@Controller('solo')
export class SoloController {
  constructor(private readonly solo: SoloService) {}

  @RateLimit(LIMITS.write)
  @Post('sessions')
  start(
    @CurrentUser('sub') learnerId: string,
    @Body() dto: StartDto,
  ): Promise<{ sessionId: string; hat: SoloHat; probe: string }> {
    return this.solo.start(dto.topic, dto.lang, learnerId);
  }

  @RateLimit(LIMITS.ai)
  @Post('sessions/:sid/turn')
  turn(
    @Param('sid') sid: string,
    @CurrentUser('sub') learnerId: string,
    @Body() dto: TurnDto,
  ): Promise<{ novaTurn: string; hint?: string; progress: number }> {
    return this.solo.turn(sid, learnerId, dto.text, dto.lang ?? 'en');
  }

  @RateLimit(LIMITS.write)
  @Post('sessions/:sid/hat')
  hat(@Param('sid') sid: string, @Body() dto: HatDto): Promise<{ hat: SoloHat }> {
    return this.solo.hat(sid, dto.hat);
  }

  @RateLimit(LIMITS.ai)
  @Post('sessions/:sid/invite')
  invite(@Param('sid') sid: string): Promise<{ deepLink: string; code: string }> {
    return this.solo.invite(sid);
  }
}
