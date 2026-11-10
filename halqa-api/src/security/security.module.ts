import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CoreModule } from '../core/core.module';
import { ChaosController } from './chaos.controller';
import { PiiService } from './pii.service';
import { TokenGuard } from './token.guard';

import { DegradationModule } from '../ai/degradation/degradation.module';

@Module({
  imports: [CoreModule, DegradationModule],
  controllers: process.env.NODE_ENV === 'production' ? [] : [ChaosController],
  providers: [PiiService, { provide: APP_GUARD, useClass: TokenGuard }],
  exports: [PiiService],
})
export class SecurityModule {}
