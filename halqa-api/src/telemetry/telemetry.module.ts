import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { EventBus } from './event-bus';
import { TelemetryController } from './telemetry.controller';

@Module({
  imports: [PersistenceModule],
  providers: [EventBus],
  controllers: [TelemetryController],
  exports: [EventBus],
})
export class TelemetryModule {}
