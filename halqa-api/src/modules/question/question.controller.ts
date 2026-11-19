import { Body, Controller, Get, Headers, Param, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { QuestionService } from './question.service';
import { LIMITS, RateLimit } from '../../security/rate-limit';
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

  /**
   * Listing a session's questions is member-scoped. Without this check any
   * signed-in learner could enumerate `S-1…S-n` and read every circle's
   * questions, peer answers and resolution state.
   */
  @Get()
  async list(
    @Query('sessionId') sessionId: string,
    @CurrentUser('sub') learnerId: string,
  ): Promise<{ qids: string[] }> {
    await this.members.assertSessionMember(sessionId, learnerId);
    return this.questions.listBySession(sessionId);
  }

  @RateLimit(LIMITS.write)
  @Post()
  async create(
    @CurrentUser('sub') askerId: string,
    @Body() dto: CreateQuestionDto,
  ): Promise<{ qid: string; state: string; windowS: number; windowEndsAt?: Date }> {
    await this.members.assertSessionMember(dto.sessionId, askerId);
    const q = await this.questions.create({ ...dto, askerId });
    return { qid: q._id, state: q.state, windowS: q.windowS, windowEndsAt: q.windowEndsAt };
  }

  /**
   * Shared poller view. Deliberately carries no asker-only field, so every peer
   * polls one cacheable body and the ETag stays stable across viewers.
   *
   * The asker is derived from the token, never from a query param: `?asker=` used
   * to let anyone read Nova's hidden answer before the peer window closed.
   */
  @Get(':qid/state')
  async state(
    @Param('qid') qid: string,
    @CurrentUser('sub') learnerId: string,
    @Headers('if-none-match') inm: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    await this.questions.assertQuestionMember(qid, learnerId);
    const { view, etag } = await this.questions.getState(qid);
    res.set('ETag', etag);
    res.set('Cache-Control', 'no-cache');
    if (inm === etag) {
      res.status(304);
      return undefined;
    }
    return view;
  }

  /** Asker-only extras, split out so the shared poller above stays viewer-independent. */
  @Get(':qid/private')
  askerView(
    @Param('qid') qid: string,
    @CurrentUser('sub') learnerId: string,
  ): Promise<{ stages: unknown[]; quickTakeReady: boolean; deepDiveReady: boolean; deepDive?: { text: string; cites: string[] } }> {
    return this.questions.askerView(qid, learnerId);
  }

  @RateLimit(LIMITS.write)
  @Post(':qid/peer-answer')
  peerAnswer(
    @Param('qid') qid: string,
    @CurrentUser('sub') authorId: string,
    @Body() dto: PeerAnswerDto,
  ): Promise<{ aid: string; creditsAwarded: number }> {
    return this.questions.peerAnswer(qid, authorId, dto.text, dto.lang);
  }

  /** Alias of peer-answer (plan §9 lists both spellings). */
  @RateLimit(LIMITS.ai)
  @Post(':qid/answer')
  answer(
    @Param('qid') qid: string,
    @CurrentUser('sub') authorId: string,
    @Body() dto: PeerAnswerDto,
  ): Promise<{ aid: string }> {
    return this.questions.peerAnswer(qid, authorId, dto.text, dto.lang);
  }

  @RateLimit(LIMITS.poll)
  @Post(':qid/me-too')
  meToo(@Param('qid') qid: string, @CurrentUser('sub') learnerId: string): Promise<{ ok: boolean }> {
    return this.questions.meToo(qid, learnerId);
  }

  @RateLimit(LIMITS.write)
  @Post(':qid/skip')
  skip(
    @Param('qid') qid: string,
    @CurrentUser('sub') askerId: string,
    @Body() _dto: ActorDto,
  ): Promise<{ answer: string; tierUsed: string; cached: boolean; cites: string[] }> {
    return this.questions.skip(qid, askerId);
  }

  @RateLimit(LIMITS.ai)
  @Post(':qid/hint')
  hint(
    @Param('qid') qid: string,
    @CurrentUser('sub') askerId: string,
    @Body() dto: HintDto,
  ): Promise<{ hint: string; level: number; cites: string[] }> {
    return this.questions.hint(qid, askerId, dto.level as 1 | 2 | 3 | 4);
  }
}
