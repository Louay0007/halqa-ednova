import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../persistence/persistence.module';
import { TelemetryModule } from '../../telemetry/telemetry.module';
import { LearningService } from './learning.service';
import { LearningController } from './learning.controller';

@Module({
  imports: [PersistenceModule, TelemetryModule],
  providers: [LearningService],
  controllers: [LearningController],
  exports: [LearningService],
})
export class LearningModule {}
