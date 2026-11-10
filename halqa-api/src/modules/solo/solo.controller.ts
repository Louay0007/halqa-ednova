import { Body, Controller, Param, Post } from '@nestjs/common';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SoloHat, SoloService } from './solo.service';

class StartDto {
  @IsString()
  @IsNotEmpty()
  topic!: string;
  @IsIn(['ar', 'darija', 'fr', 'en'])
  lang!: string;
  @IsString()
  @IsNotEmpty()
  learnerId!: string;
}

class TurnDto {
  @IsString()
  @IsNotEmpty()
  learnerId!: string;
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

@Controller('solo')
export class SoloController {
  constructor(private readonly solo: SoloService) {}

  @Post('sessions')
  start(@Body() dto: StartDto): Promise<{ sessionId: string; hat: SoloHat; probe: string }> {
    return this.solo.start(dto.topic, dto.lang, dto.learnerId);
  }

  @Post('sessions/:sid/turn')
  turn(@Param('sid') sid: string, @Body() dto: TurnDto): Promise<{ novaTurn: string; hint?: string; progress: number }> {
    return this.solo.turn(sid, dto.learnerId, dto.text, dto.lang ?? 'en');
  }

  @Post('sessions/:sid/hat')
  hat(@Param('sid') sid: string, @Body() dto: HatDto): Promise<{ hat: SoloHat }> {
    return this.solo.hat(sid, dto.hat);
  }

  @Post('sessions/:sid/invite')
  invite(@Param('sid') sid: string): Promise<{ deepLink: string; code: string }> {
    return this.solo.invite(sid);
  }
}
