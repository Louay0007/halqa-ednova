import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.guard';
import { CoreModule } from '../core/core.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { ChaosController, DegradationController } from './chaos.controller';
import { MembershipService } from './membership.service';
import { PiiService } from './pii.service';
import { TokenEpochService } from './token-epoch.service';
import { TokenGuard } from './token.guard';

import { DegradationModule } from '../ai/degradation/degradation.module';

@Global()
@Module({
  imports: [CoreModule, PersistenceModule, DegradationModule],
  // `/degradation` must stay readable in production (the banner depends on it);
  // only the `/chaos` override is dev-only.
  controllers: process.env.NODE_ENV === 'production' ? [DegradationController] : [DegradationController, ChaosController],
  providers: [
    PiiService,
    MembershipService,
    TokenEpochService,
    { provide: APP_GUARD, useClass: TokenGuard },
    // Runs after TokenGuard so the budget can key on the verified caller.
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
  exports: [PiiService, MembershipService, TokenEpochService],
})
export class SecurityModule {}
