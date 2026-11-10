import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { GamificationService } from './gamification.service';

class AwardDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;
  @IsString()
  @IsNotEmpty()
  circleId!: string;
  @IsString()
  @IsNotEmpty()
  signal!: string;
}

@Controller('learners')
export class GamificationController {
  constructor(private readonly game: GamificationService) {}

  @Get(':id/xp')
  xp(@Param('id') id: string): { total: number; badges: string[] } {
    return this.game.total(id);
  }

  @Get(':id/badges')
  badges(@Param('id') id: string): { badges: string[] } {
    return { badges: this.game.total(id).badges };
  }

  @Post(':id/xp')
  award(@Param('id') id: string, @Body() dto: AwardDto): { xp: number; total: number } {
    return this.game.award(id, dto.sessionId, dto.circleId, dto.signal);
  }
}
