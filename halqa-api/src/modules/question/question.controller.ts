import { Body, Controller, Get, Headers, Param, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { QuestionService } from './question.service';
import { Roles } from '../../security/roles.decorator';
import { CurrentUser } from '../../security/current-user.decorator';
import { MembershipService } from '../../security/membership.service';

class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;
  /** Deprecated: the asker is the authenticated caller. Kept optional for old clients. */
  @IsOptional()
  @IsString()
  askerId?: string;
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
  /** Deprecated: the author is the authenticated caller. */
  @IsOptional()
  @IsString()
  authorId?: string;
  @IsString()
  @IsNotEmpty()
  text!: string;
  @IsOptional()
  @IsIn(['ar', 'darija', 'fr', 'en'])
  lang?: string;
}

class ActorDto {
  /** Deprecated: the actor is the authenticated caller. */
  @IsOptional()
  @IsString()
  askerId?: string;
}

class HintDto extends ActorDto {
  @IsInt()
  @Min(1)
  @Max(4)
  level!: number;
}

@Roles('learner')
@Controller('questions')
export class QuestionController {
  constructor(
    private readonly questions: QuestionService,
    private readonly members: MembershipService,
  ) {}

  @Get()
  async list(@Query('sessionId') sessionId: string) {
    return this.questions.listBySession(sessionId);
  }

  @Post()
  async create(
    @CurrentUser('sub') askerId: string,
    @Body() dto: CreateQuestionDto,
  ): Promise<{ qid: string; state: string; windowS: number; windowEndsAt?: Date }> {
    await this.members.assertSessionMember(dto.sessionId, askerId);
    const q = await this.questions.create({ ...dto, askerId });
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
  peerAnswer(
    @Param('qid') qid: string,
    @CurrentUser('sub') authorId: string,
    @Body() dto: PeerAnswerDto,
  ): Promise<{ aid: string; creditsAwarded: number }> {
    return this.questions.peerAnswer(qid, authorId, dto.text, dto.lang);
  }

  /** Alias of peer-answer (plan §9 lists both spellings). */
  @Post(':qid/answer')
  answer(
    @Param('qid') qid: string,
    @CurrentUser('sub') authorId: string,
    @Body() dto: PeerAnswerDto,
  ): Promise<{ aid: string }> {
    return this.questions.peerAnswer(qid, authorId, dto.text, dto.lang);
  }

  @Post(':qid/me-too')
  meToo(@Param('qid') qid: string, @CurrentUser('sub') learnerId: string): Promise<{ ok: boolean }> {
    return this.questions.meToo(qid, learnerId);
  }

  @Post(':qid/skip')
  skip(
    @Param('qid') qid: string,
    @CurrentUser('sub') askerId: string,
    @Body() _dto: ActorDto,
  ): Promise<{ answer: string; tierUsed: string; cached: boolean; cites: string[] }> {
    return this.questions.skip(qid, askerId);
  }

  @Post(':qid/hint')
  hint(
    @Param('qid') qid: string,
    @CurrentUser('sub') askerId: string,
    @Body() dto: HintDto,
  ): Promise<{ hint: string; level: number; cites: string[] }> {
    return this.questions.hint(qid, askerId, dto.level as 1 | 2 | 3 | 4);
  }
}
