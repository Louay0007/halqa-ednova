import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { KnowledgeModule } from '../modules/knowledge/knowledge.module';
import { AiPlatformModule } from '../ai/ai-platform.module';
import { DemoReset } from './demo-reset';
import { SeedService } from './seed.service';

@Module({
  imports: [PersistenceModule, TelemetryModule, KnowledgeModule, AiPlatformModule],
  providers: [SeedService, DemoReset],
  exports: [SeedService, DemoReset],
})
export class SeedModule {}
