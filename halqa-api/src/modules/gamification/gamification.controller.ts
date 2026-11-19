import { Controller, Get } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { Roles } from '../../security/roles.decorator';
import { CurrentUser } from '../../security/current-user.decorator';

/**
 * Learner-facing progress.
 *
 * Two endpoints were removed here in the production pass (§3.5, §3.6):
 *
 * - `GET /learners/:id/xp` and `/:id/badges` read anyone's progress with only a
 *   learner role, so sequential ids made every peer's participation readable.
 * - `POST /learners/:id/xp` let a learner mint XP by replaying a signal name.
 *
 * XP is now granted only by the services that witness the action, and the only
 * read is your own. A peer-visible achievement list would also contradict the
 * "no leaderboard" invariant in the spec.
 */
@Roles('learner', 'mentor', 'admin')
@Controller('learners')
export class GamificationController {
  constructor(private readonly game: GamificationService) {}

  @Get('me/progress')
  progress(@CurrentUser('sub') learnerId: string) {
    return this.game.total(learnerId);
  }

  @Get('me/streak')
  async streak(@CurrentUser('sub') learnerId: string) {
    return this.game.streak(learnerId);
  }
}
