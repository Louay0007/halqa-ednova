import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../persistence/persistence.module';
import { TelemetryModule } from '../../telemetry/telemetry.module';
import { AdapterModule } from '../../ai/adapter/adapter.module';
import { GovernorModule } from '../../ai/governor/governor.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { CapsuleService } from './capsule.service';
import { CapsuleController } from './capsule.controller';

@Module({
  imports: [PersistenceModule, TelemetryModule, AdapterModule, GovernorModule, KnowledgeModule],
  providers: [CapsuleService],
  controllers: [CapsuleController],
  exports: [CapsuleService],
})
export class CapsuleModule {}
