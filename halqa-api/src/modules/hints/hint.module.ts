import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../persistence/persistence.module';
import { TelemetryModule } from '../../telemetry/telemetry.module';
import { HintService } from './hint.service';

@Module({
  imports: [PersistenceModule, TelemetryModule],
  providers: [HintService],
  exports: [HintService],
})
export class HintModule {}
