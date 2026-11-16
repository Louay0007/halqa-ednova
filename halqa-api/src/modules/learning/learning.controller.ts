import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsIn, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DnaAnswers, LearningService } from './learning.service';
import { Public, Roles } from '../../security/roles.decorator';
import { OptionalUser } from '../../security/current-user.decorator';

class DnaAnswersDto implements DnaAnswers {
  @IsIn(['novice', 'beginner', 'intermediate'])
  L1!: 'novice' | 'beginner' | 'intermediate';
  @IsIn(['visual', 'analogy', 'steps'])
  S1!: 'visual' | 'analogy' | 'steps';
  @IsIn(['ar', 'darija', 'fr', 'en'])
  G1!: 'ar' | 'darija' | 'fr' | 'en';
  @IsIn(['sure', 'unsure', 'lost'])
  C1!: 'sure' | 'unsure' | 'lost';
}

class CompleteDnaDto {
  /** Ignored for a signed-in caller: DNA is written onto their own record. */
  @IsOptional()
  @IsString()
  @MaxLength(24)
  nickname?: string;
  @IsOptional()
  @IsIn(['class', 'study', 'community', 'workshop', 'program', 'solo'])
  context?: string;
  @IsOptional()
  @IsString()
  topic?: string;
  @IsObject()
  @ValidateNested()
  @Type(() => DnaAnswersDto)
  answers!: DnaAnswersDto;
  @IsOptional()
  @IsString()
  sessionId?: string;
  @IsOptional()
  @IsString()
  circleId?: string;
}

@Roles('learner')
@Controller()
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  /** Content, not personal data: the DNA items are shown to anonymous visitors too. */
  @Public()
  @Get('dna/items')
  items(): { items: unknown[] } {
    return { items: this.learning.items() };
  }

  @Public()
  @Post('dna')
  complete(
    @Body() dto: CompleteDnaDto,
    @OptionalUser('sub') learnerId: string | undefined,
  ): Promise<{ learnerId: string; passport: Record<string, unknown> }> {
    return this.learning.completeDna({
      ...dto,
      nickname: dto.nickname ?? 'Learner',
      context: dto.context ?? 'study',
      learnerId,
    });
  }
}
