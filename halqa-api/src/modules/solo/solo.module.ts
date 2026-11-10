import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../persistence/persistence.module';
import { TelemetryModule } from '../../telemetry/telemetry.module';
import { AdapterModule } from '../../ai/adapter/adapter.module';
import { GovernorModule } from '../../ai/governor/governor.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { OfflineModule } from '../offline/offline.module';
import { SoloService } from './solo.service';
import { SoloController } from './solo.controller';

@Module({
  imports: [PersistenceModule, TelemetryModule, AdapterModule, GovernorModule, KnowledgeModule, OfflineModule],
  providers: [SoloService],
  controllers: [SoloController],
  exports: [SoloService],
})
export class SoloModule {}
