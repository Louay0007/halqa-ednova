import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { MentorService } from './mentor.service';
import { Roles } from '../../security/roles.decorator';
import { CurrentUser } from '../../security/current-user.decorator';
import { MembershipService } from '../../security/membership.service';
import { LIMITS, RateLimit } from '../../security/rate-limit';

class NoteDto {
  @IsString()
  @IsNotEmpty()
  circleId!: string;
  /** Deprecated: the author is the authenticated caller. */
  @IsOptional()
  @IsString()
  mentorId?: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  text!: string;
  @IsOptional()
  @IsString()
  sessionId?: string;
}

@Roles('learner')
@Controller()
export class MentorController {
  constructor(
    private readonly mentor: MentorService,
    private readonly members: MembershipService,
  ) {}

  @RateLimit(LIMITS.write)
  @Post('circles/:id/mentor/join')
  join(@Param('id') id: string, @CurrentUser('sub') mentorId: string): Promise<{ ok: boolean; role: string }> {
    return this.mentor.join(id, mentorId);
  }

  @RateLimit({ limit: 30, windowS: 60 })
  @Post('mentor/notes')
  async note(@CurrentUser('sub') mentorId: string, @Body() dto: NoteDto): Promise<{ noteId: string }> {
    await this.members.assertMember(dto.circleId, mentorId);
    return this.mentor.note(dto.circleId, mentorId, dto.text, dto.sessionId);
  }

  @Get('mentor/brief')
  async brief(
    @CurrentUser('sub') learnerId: string,
    @Query('circleId') circleId: string,
    @Query('sessionId') sessionId: string,
  ): Promise<{ brief: string; words: number }> {
    await this.members.assertMember(circleId, learnerId);
    return this.mentor.brief(circleId, sessionId);
  }
}
