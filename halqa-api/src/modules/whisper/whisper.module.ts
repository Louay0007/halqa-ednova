import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../persistence/persistence.module';
import { TelemetryModule } from '../../telemetry/telemetry.module';
import { AdapterModule } from '../../ai/adapter/adapter.module';
import { GovernorModule } from '../../ai/governor/governor.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { WhisperService } from './whisper.service';
import { WhisperController } from './whisper.controller';

@Module({
  imports: [PersistenceModule, TelemetryModule, AdapterModule, GovernorModule, KnowledgeModule],
  providers: [WhisperService],
  controllers: [WhisperController],
  exports: [WhisperService],
})
export class WhisperModule {}
