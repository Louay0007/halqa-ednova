import { Body, Controller, Param, Post } from '@nestjs/common';
import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { WhisperService } from './whisper.service';
import { Roles } from '../../security/roles.decorator';
import { CurrentUser } from '../../security/current-user.decorator';
import { MembershipService } from '../../security/membership.service';

class StepDto {
  /** Ignored for the first step: the relay starts with the caller. */
  @IsOptional()
  @IsString()
  authorId?: string;
  @IsString()
  @IsNotEmpty()
  text!: string;
}

class RunDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;
  @IsString()
  @IsNotEmpty()
  circleId!: string;
  @IsString()
  @IsNotEmpty()
  topic!: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StepDto)
  steps!: StepDto[];
}

class RepairDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;
  @IsString()
  @IsNotEmpty()
  circleId!: string;
  @IsString()
  @IsNotEmpty()
  text!: string;
}

@Roles('learner')
@Controller('whisper')
export class WhisperController {
  constructor(
    private readonly whisper: WhisperService,
    private readonly members: MembershipService,
  ) {}

  /**
   * A relay legitimately has several authors, so the chain keeps its per-step
   * ids — but the caller must be in the circle, and so must every author they
   * name. The first step is always attributed to the caller.
   */
  @Post()
  async run(@CurrentUser('sub') learnerId: string, @Body() dto: RunDto): Promise<unknown> {
    await this.members.assertMember(dto.circleId, learnerId);
    const steps = dto.steps.map((s, i) => ({ ...s, authorId: i === 0 ? learnerId : (s.authorId ?? learnerId) }));
    await this.members.assertMembers(dto.circleId, steps.map((s) => s.authorId));
    return this.whisper.run(dto.sessionId, dto.circleId, dto.topic, steps);
  }

  @Post(':cid/repair')
  async repair(
    @Param('cid') cid: string,
    @CurrentUser('sub') learnerId: string,
    @Body() dto: RepairDto,
  ): Promise<{ coverage: number }> {
    await this.members.assertMember(dto.circleId, learnerId);
    return this.whisper.repair(cid, dto.sessionId, dto.circleId, dto.text);
  }
}
