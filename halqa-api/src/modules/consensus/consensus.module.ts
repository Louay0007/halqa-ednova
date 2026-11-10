import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../persistence/persistence.module';
import { TelemetryModule } from '../../telemetry/telemetry.module';
import { ConsensusService } from './consensus.service';
import { ConsensusController } from './consensus.controller';

@Module({
  imports: [PersistenceModule, TelemetryModule],
  providers: [ConsensusService],
  controllers: [ConsensusController],
  exports: [ConsensusService],
})
export class ConsensusModule {}
