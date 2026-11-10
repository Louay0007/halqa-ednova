import { Module } from '@nestjs/common';
import { AdapterModule } from '../adapter/adapter.module';
import { CacheModule } from '../cache/cache.module';
import { GovernorModule } from '../governor/governor.module';
import { QueueModule } from '../queue/queue.module';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { DegradationModule } from '../degradation/degradation.module';
import { TelemetryModule } from '../../telemetry/telemetry.module';
import { RouterService } from './router.service';

@Module({
  imports: [AdapterModule, CacheModule, GovernorModule, QueueModule, RetrievalModule, DegradationModule, TelemetryModule],
  providers: [RouterService],
  exports: [RouterService],
})
export class RouterModule {}
