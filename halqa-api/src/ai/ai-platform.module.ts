import { Module } from '@nestjs/common';
import { AdapterModule } from './adapter/adapter.module';
import { GovernorModule } from './governor/governor.module';
import { CacheModule } from './cache/cache.module';
import { QueueModule } from './queue/queue.module';
import { DegradationModule } from './degradation/degradation.module';
import { RetrievalModule } from './retrieval/retrieval.module';
import { RouterModule } from './router/router.module';

@Module({
  imports: [AdapterModule, GovernorModule, CacheModule, QueueModule, DegradationModule, RetrievalModule, RouterModule],
  exports: [AdapterModule, GovernorModule, CacheModule, QueueModule, DegradationModule, RetrievalModule, RouterModule],
})
export class AiPlatformModule {}
