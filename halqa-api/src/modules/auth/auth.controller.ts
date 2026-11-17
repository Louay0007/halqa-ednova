import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthService, LearnerView } from './auth.service';
import { CurrentUser, OptionalUser } from '../../security/current-user.decorator';
import { Public, Roles } from '../../security/roles.decorator';
import { RateLimit } from '../../security/rate-limit';
import { PASSPHRASE_MAX, PASSPHRASE_MIN } from '../../security/credentials';

const CONTEXT_VALUES = ['class', 'study', 'community', 'workshop', 'program', 'solo'];

class SessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(24)
  nickname!: string;
  @IsOptional()
  @IsString()
  avatarKey?: string;
  @IsIn(CONTEXT_VALUES)
  context!: string;
}

class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'HANDLE_INVALID' })
  @MaxLength(20, { message: 'HANDLE_INVALID' })
  handle!: string;
  @IsString({ message: 'PASSPHRASE_LENGTH' })
  // The validator would otherwise answer with a bare sentence and lose the code
  // the PWA keys its translated message off, so each rule names the domain code.
  @MinLength(PASSPHRASE_MIN, { message: 'PASSPHRASE_LENGTH' })
  @MaxLength(PASSPHRASE_MAX, { message: 'PASSPHRASE_LENGTH' })
  passphrase!: string;
  @IsOptional()
  @IsString()
  @MaxLength(24)
  nickname?: string;
  @IsOptional()
  @IsString()
  avatarKey?: string;
  @IsOptional()
  @IsIn(CONTEXT_VALUES)
  context?: string;
}

class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  handle!: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSPHRASE_MAX)
  passphrase!: string;
}

class UpdateMeDto {
  @IsOptional()
  @IsString()
  avatarKey?: string;
  @IsOptional()
  @IsIn(CONTEXT_VALUES)
  context?: string;
}

class PassphraseDto {
  @IsString({ message: 'LOGIN_FAILED' })
  @IsNotEmpty({ message: 'LOGIN_FAILED' })
  @MaxLength(PASSPHRASE_MAX, { message: 'LOGIN_FAILED' })
  current!: string;
  @IsString({ message: 'PASSPHRASE_LENGTH' })
  @MinLength(PASSPHRASE_MIN, { message: 'PASSPHRASE_LENGTH' })
  @MaxLength(PASSPHRASE_MAX, { message: 'PASSPHRASE_LENGTH' })
  next!: string;
}

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Guest entry: mints a throwaway learner with no credential. Kept because the
   * landing page promises "no signup, under a minute" — a visitor can try the
   * whole circle first and claim an account later from `/me`.
   */
  @Public()
  // Anonymous by design, so this is the one route worth guarding against minting spam.
  @RateLimit({ limit: 20, windowS: 60 })
  @Post('auth/session')
  session(@Body() dto: SessionDto): Promise<{ token: string; learner: LearnerView }> {
    return this.auth.session(dto.nickname, dto.avatarKey ?? '', dto.context);
  }

  /**
   * Create the account. With a token present the guest record being used right now
   * is upgraded, so the passport already written is kept.
   */
  @Public()
  // Higher than sign-in: creating accounts is not a brute-force surface, and a
  // shared classroom NAT would otherwise exhaust the budget legitimately.
  @RateLimit({ limit: 20, windowS: 60 })
  @Post('auth/register')
  register(
    @Body() dto: RegisterDto,
    @OptionalUser('sub') learnerId: string | undefined,
  ): Promise<{ token: string; learner: LearnerView }> {
    return this.auth.register(
      {
        handle: dto.handle,
        passphrase: dto.passphrase,
        nickname: dto.nickname,
        avatarKey: dto.avatarKey ?? '',
        context: dto.context ?? 'study',
      },
      learnerId,
    );
  }

  /** Sign back in to an account from any device. */
  @Public()
  @RateLimit({ limit: 10, windowS: 60 })
  @Post('auth/login')
  login(@Body() dto: LoginDto): Promise<{ token: string; learner: LearnerView }> {
    return this.auth.login(dto.handle, dto.passphrase);
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
  @RateLimit({ limit: 10, windowS: 60 })
  @Post('auth/passphrase')
  changePassphrase(@CurrentUser('sub') learnerId: string, @Body() dto: PassphraseDto): Promise<{ token: string }> {
    return this.auth.changePassphrase(learnerId, dto.current, dto.next);
  }

  @Roles('learner')
  @Post('auth/signout')
  signout(@CurrentUser('sub') learnerId: string): Promise<{ ok: true }> {
    return this.auth.signout(learnerId);
  }
}
