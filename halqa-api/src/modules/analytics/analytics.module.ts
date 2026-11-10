import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../persistence/persistence.module';
import { OfflineModule } from '../offline/offline.module';
import { RetrievalModule } from '../../ai/retrieval/retrieval.module';
import { DegradationModule } from '../../ai/degradation/degradation.module';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports: [PersistenceModule, OfflineModule, RetrievalModule, DegradationModule],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}
