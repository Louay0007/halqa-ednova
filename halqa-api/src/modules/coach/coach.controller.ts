import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { CoachService } from './coach.service';

class NudgeDto {
  @IsString()
  @IsNotEmpty()
  explainerId!: string;
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

@Controller()
export class CoachController {
  constructor(private readonly coach: CoachService) {}

  @Get('passports/:id/explain-card')
  card(@Param('id') id: string): Promise<{ card: string; visible: boolean }> {
    return this.coach.card(id);
  }

  @Post('coach/nudge/:targetId')
  nudge(@Param('targetId') target: string, @Body() dto: NudgeDto): Promise<{ nudge: string; private: true }> {
    return this.coach.nudge(dto.explainerId, target, dto.sessionId, dto.circleId);
  }

  @Post('coach/rephrase')
  rephrase(@Body() dto: RephraseDto): Promise<{ suggestion: string }> {
    return this.coach.rephrase(dto.sessionId, dto.circleId, dto.text, dto.style, dto.lang);
  }
}
