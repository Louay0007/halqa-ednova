import { Body, Controller, Param, Post } from '@nestjs/common';
import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { WhisperService } from './whisper.service';

class StepDto {
  @IsString()
  @IsNotEmpty()
  authorId!: string;
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

@Controller('whisper')
export class WhisperController {
  constructor(private readonly whisper: WhisperService) {}

  @Post()
  run(@Body() dto: RunDto): Promise<unknown> {
    return this.whisper.run(dto.sessionId, dto.circleId, dto.topic, dto.steps);
  }

  @Post(':cid/repair')
  repair(@Param('cid') cid: string, @Body() dto: RepairDto): Promise<{ coverage: number }> {
    return this.whisper.repair(cid, dto.sessionId, dto.circleId, dto.text);
  }
}
