import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../persistence/persistence.module';
import { TelemetryModule } from '../../telemetry/telemetry.module';
import { RouterModule } from '../../ai/router/router.module';
import { AdapterModule } from '../../ai/adapter/adapter.module';
import { GovernorModule } from '../../ai/governor/governor.module';
import { CacheModule } from '../../ai/cache/cache.module';
import { PeerWindowModule } from '../peer-window/peer-window.module';
import { HintModule } from '../hints/hint.module';
import { EquityModule } from '../equity/equity.module';
import { QuestionService } from './question.service';
import { QuestionController } from './question.controller';

@Module({
  imports: [PersistenceModule, TelemetryModule, RouterModule, AdapterModule, GovernorModule, CacheModule, PeerWindowModule, HintModule, EquityModule],
  providers: [QuestionService],
  controllers: [QuestionController],
  exports: [QuestionService],
})
export class QuestionModule {}
