import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../persistence/persistence.module';
import { TelemetryModule } from '../../telemetry/telemetry.module';
import { AdapterModule } from '../../ai/adapter/adapter.module';
import { GovernorModule } from '../../ai/governor/governor.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ConsensusModule } from '../consensus/consensus.module';
import { AuditorService } from './auditor.service';

@Module({
  imports: [PersistenceModule, TelemetryModule, AdapterModule, GovernorModule, KnowledgeModule, ConsensusModule],
  providers: [AuditorService],
  exports: [AuditorService],
})
export class AuditorModule {}
