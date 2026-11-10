import { Body, Controller, Param, Post } from '@nestjs/common';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { QuizService } from './quiz.service';

class BattleDto {
  @IsString()
  @IsNotEmpty()
  circleId!: string;
  @IsString()
  @IsNotEmpty()
  sessionId!: string;
  @IsOptional()
  @IsIn(['intro', 'intermediate', 'novice', 'beginner'])
  level?: string;
}

class AnswerDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;
  @IsString()
  @IsNotEmpty()
  circleId!: string;
  @IsString()
  @IsNotEmpty()
  learnerId!: string;
  @IsString()
  @IsNotEmpty()
  qid!: string;
  @IsString()
  @IsNotEmpty()
  choice!: string;
}

@Controller('quiz')
export class QuizController {
  constructor(private readonly quiz: QuizService) {}

  @Post('battle')
  battle(@Body() dto: BattleDto): { bid: string; items: unknown[] } {
    return this.quiz.battle(dto.circleId, dto.sessionId, dto.level);
  }

  @Post('battle/:bid/answer')
  answer(@Param('bid') bid: string, @Body() dto: AnswerDto): { correct: boolean; explain: string; xp: number } {
    return this.quiz.answer(bid, dto.sessionId, dto.circleId, dto.learnerId, dto.qid, dto.choice);
  }
}
