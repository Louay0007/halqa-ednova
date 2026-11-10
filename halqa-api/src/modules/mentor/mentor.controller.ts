import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { MentorService } from './mentor.service';

class JoinDto {
  @IsString()
  @IsNotEmpty()
  mentorId!: string;
}

class NoteDto {
  @IsString()
  @IsNotEmpty()
  mentorId!: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  text!: string;
  @IsOptional()
  @IsString()
  sessionId?: string;
}

@Controller()
export class MentorController {
  constructor(private readonly mentor: MentorService) {}

  @Post('circles/:id/mentor/join')
  join(@Param('id') id: string, @Body() dto: JoinDto): Promise<{ ok: boolean; role: string }> {
    return this.mentor.join(id, dto.mentorId);
  }

  @Post('mentor/notes')
  note(@Body() dto: NoteDto & { circleId: string }): Promise<{ noteId: string }> {
    return this.mentor.note(dto.circleId, dto.mentorId, dto.text, dto.sessionId);
  }

  @Get('mentor/brief')
  brief(@Query('circleId') circleId: string, @Query('sessionId') sessionId: string): Promise<{ brief: string; words: number }> {
    return this.mentor.brief(circleId, sessionId);
  }
}
