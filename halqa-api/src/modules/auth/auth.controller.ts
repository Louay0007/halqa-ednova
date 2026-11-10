import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthService } from './auth.service';

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

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('auth/session')
  session(@Body() dto: SessionDto): Promise<{ token: string; learner: { id: string; nickname: string; avatarKey: string } }> {
    return this.auth.session(dto.nickname, dto.avatarKey ?? '', dto.context);
  }

  @Get('me')
  me(@Headers('authorization') header?: string): Promise<{ learner: unknown; passport: unknown }> {
    const token = (header ?? '').startsWith('Bearer ') ? (header as string).slice(7) : '';
    return this.auth.me(token);
  }
}
