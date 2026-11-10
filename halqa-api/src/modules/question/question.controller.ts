import { Body, Controller, Get, Headers, Param, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { QuestionService } from './question.service';

class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;
  @IsString()
  @IsNotEmpty()
  askerId!: string;
  @IsString()
  @IsNotEmpty()
  text!: string;
  @IsOptional()
  @IsIn(['ar', 'darija', 'fr', 'en'])
  lang?: string;
  @IsOptional()
  @IsBoolean()
  anonymous?: boolean;
}

class PeerAnswerDto {
  @IsString()
  @IsNotEmpty()
  authorId!: string;
  @IsString()
  @IsNotEmpty()
  text!: string;
}

class ActorDto {
  @IsString()
  @IsNotEmpty()
  askerId!: string;
}

class AuthorDto {
  @IsString()
  @IsNotEmpty()
  learnerId!: string;
}

class HintDto extends ActorDto {
  @IsInt()
  @Min(1)
  @Max(4)
  level!: number;
}

@Controller('questions')
export class QuestionController {
  constructor(private readonly questions: QuestionService) {}

  @Post()
  async create(@Body() dto: CreateQuestionDto): Promise<{ qid: string; state: string; windowS: number; windowEndsAt?: Date }> {
    const q = await this.questions.create(dto);
    return { qid: q._id, state: q.state, windowS: q.windowS, windowEndsAt: q.windowEndsAt };
  }

  @Get(':qid/state')
  async state(
    @Param('qid') qid: string,
    @Query('asker') asker: string | undefined,
    @Headers('if-none-match') inm: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const { view, etag } = await this.questions.getState(qid, asker);
    res.set('ETag', etag);
    res.set('Cache-Control', 'no-cache');
    if (inm === etag) {
      res.status(304);
      return undefined;
    }
    return view;
  }

  @Post(':qid/peer-answer')
  peerAnswer(@Param('qid') qid: string, @Body() dto: PeerAnswerDto): Promise<{ aid: string; creditsAwarded: number }> {
    return this.questions.peerAnswer(qid, dto.authorId, dto.text);
  }

  /** Alias of peer-answer (plan §9 lists both spellings). */
  @Post(':qid/answer')
  answer(@Param('qid') qid: string, @Body() dto: PeerAnswerDto): Promise<{ aid: string }> {
    return this.questions.peerAnswer(qid, dto.authorId, dto.text);
  }

  @Post(':qid/me-too')
  meToo(@Param('qid') qid: string, @Body() dto: AuthorDto): Promise<{ ok: boolean }> {
    return this.questions.meToo(qid, dto.learnerId);
  }

  @Post(':qid/skip')
  skip(@Param('qid') qid: string, @Body() dto: ActorDto): Promise<{ answer: string; tierUsed: string; cached: boolean; cites: string[] }> {
    return this.questions.skip(qid, dto.askerId);
  }

  @Post(':qid/hint')
  hint(@Param('qid') qid: string, @Body() dto: HintDto): Promise<{ hint: string; level: number; cites: string[] }> {
    return this.questions.hint(qid, dto.askerId, dto.level as 1 | 2 | 3 | 4);
  }
}
