import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../persistence/persistence.module';
import { TelemetryModule } from '../../telemetry/telemetry.module';
import { AdapterModule } from '../../ai/adapter/adapter.module';
import { GovernorModule } from '../../ai/governor/governor.module';
import { CoachService } from './coach.service';
import { CoachController } from './coach.controller';

@Module({
  imports: [PersistenceModule, TelemetryModule, AdapterModule, GovernorModule],
  providers: [CoachService],
  controllers: [CoachController],
  exports: [CoachService],
})
export class CoachModule {}
