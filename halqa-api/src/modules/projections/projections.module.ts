import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../persistence/persistence.module';
import { TelemetryModule } from '../../telemetry/telemetry.module';
import { EquityModule } from '../equity/equity.module';
import { SbuModule } from '../sbu/sbu.module';
import { ProjectionsService } from './projections.service';

@Module({
  imports: [PersistenceModule, TelemetryModule, EquityModule, SbuModule],
  providers: [ProjectionsService],
  exports: [ProjectionsService],
})
export class ProjectionsModule {}
