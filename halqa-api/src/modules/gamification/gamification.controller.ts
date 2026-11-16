import { Body, Controller, ForbiddenException, Get, Param, Post } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { GamificationService } from './gamification.service';
import { Roles } from '../../security/roles.decorator';
import { CurrentUser } from '../../security/current-user.decorator';

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

@Roles('learner')
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

  /** XP is awarded to the caller only: the path id is accepted for compatibility but ignored. */
  @Post(':id/xp')
  award(
    @Param('id') id: string,
    @CurrentUser('sub') learnerId: string,
    @Body() dto: AwardDto,
  ): { xp: number; total: number } {
    if (id !== learnerId) {
      throw new ForbiddenException('SELF_ONLY');
    }
    return this.game.award(learnerId, dto.sessionId, dto.circleId, dto.signal);
  }
}
