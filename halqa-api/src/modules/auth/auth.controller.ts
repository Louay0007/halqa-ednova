import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthService, LearnerView } from './auth.service';
import { CurrentUser } from '../../security/current-user.decorator';
import { Public, Roles } from '../../security/roles.decorator';
import { RateLimit } from '../../security/rate-limit';

class SessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(24)
  nickname!: string;
  @IsOptional()
  @IsString()
  avatarKey?: string;
  @IsIn(['class', 'study', 'community', 'workshop', 'program', 'solo'])
  context!: string;
}

class UpdateMeDto {
  @IsOptional()
  @IsString()
  avatarKey?: string;
  @IsOptional()
  @IsIn(['class', 'study', 'community', 'workshop', 'program', 'solo'])
  context?: string;
}

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  // Anonymous by design, so this is the one route worth guarding against minting spam.
  @RateLimit({ limit: 20, windowS: 60 })
  @Post('auth/session')
  session(@Body() dto: SessionDto): Promise<{ token: string; learner: LearnerView }> {
    return this.auth.session(dto.nickname, dto.avatarKey ?? '', dto.context);
  }

  @Roles('learner')
  @Get('me')
  me(@CurrentUser('sub') learnerId: string): Promise<{ learner: LearnerView; passport: unknown }> {
    return this.auth.me(learnerId);
  }

  @Roles('learner')
  @Patch('me')
  update(@CurrentUser('sub') learnerId: string, @Body() dto: UpdateMeDto): Promise<LearnerView> {
    return this.auth.update(learnerId, dto);
  }

  @Roles('learner')
  @Post('auth/signout')
  signout(@CurrentUser('sub') learnerId: string): Promise<{ ok: true }> {
    return this.auth.signout(learnerId);
  }
}
