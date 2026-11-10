import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../persistence/persistence.module';
import { TelemetryModule } from '../../telemetry/telemetry.module';
import { GovernorModule } from '../../ai/governor/governor.module';
import { EquityModule } from '../equity/equity.module';
import { SbuModule } from '../sbu/sbu.module';
import { SessionService } from './session.service';
import { CircleSessionController, SessionController } from './session.controller';

@Module({
  imports: [PersistenceModule, TelemetryModule, GovernorModule, EquityModule, SbuModule],
  providers: [SessionService],
  controllers: [CircleSessionController, SessionController],
  exports: [SessionService],
})
export class SessionModule {}
