import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ConsensusService } from './consensus.service';

class CreatePollDto {
  @IsOptional()
  @IsString()
  questionId?: string;
  @IsOptional()
  @IsString()
  sessionId?: string;
  @IsString()
  @IsNotEmpty()
  claim!: string;
  @IsString({ each: true })
  choices!: string[];
  @IsOptional()
  @IsIn(['auditor_doubt', 'seeded_error', 'teaching'])
  reason?: 'auditor_doubt' | 'seeded_error' | 'teaching';
}

class VoteDto {
  @IsString()
  @IsNotEmpty()
  learnerId!: string;
  @IsString()
  @IsNotEmpty()
  choice!: string;
}

@Controller('polls')
export class ConsensusController {
  constructor(private readonly consensus: ConsensusService) {}

  @Post()
  async create(@Body() dto: CreatePollDto): Promise<{ pid: string }> {
    const ctx = await this.consensus.resolveContext({ sessionId: dto.sessionId, questionId: dto.questionId });
    const poll = await this.consensus.create({
      sessionId: ctx.sessionId,
      circleId: ctx.circleId,
      questionId: dto.questionId,
      claim: dto.claim,
      choices: dto.choices,
      reason: dto.reason,
    });
    return { pid: poll._id };
  }

  @Post(':pid/vote')
  vote(@Param('pid') pid: string, @Body() dto: VoteDto): Promise<{ tally: Record<string, number>; total: number }> {
    return this.consensus.vote(pid, dto.learnerId, dto.choice);
  }

  @Post(':pid/close')
  close(@Param('pid') pid: string): Promise<{ tally: Record<string, number>; winner: string }> {
    return this.consensus.close(pid);
  }

  @Get(':pid')
  get(@Param('pid') pid: string): Promise<unknown> {
    return this.consensus.get(pid);
  }
}
