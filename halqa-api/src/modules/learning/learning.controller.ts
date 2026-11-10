import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DnaAnswers, LearningService } from './learning.service';

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
  @IsString()
  @IsNotEmpty()
  @MaxLength(24)
  nickname!: string;
  @IsIn(['class', 'study', 'community', 'workshop', 'program', 'solo'])
  context!: string;
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

@Controller()
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  @Get('dna/items')
  items(): { items: unknown[] } {
    return { items: this.learning.items() };
  }

  @Post('dna')
  complete(@Body() dto: CompleteDnaDto): Promise<{ learnerId: string; passport: Record<string, unknown> }> {
    return this.learning.completeDna({ ...dto, answers: dto.answers });
  }
}
