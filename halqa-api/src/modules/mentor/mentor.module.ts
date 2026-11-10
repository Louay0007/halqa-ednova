import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../persistence/persistence.module';
import { TelemetryModule } from '../../telemetry/telemetry.module';
import { AdapterModule } from '../../ai/adapter/adapter.module';
import { GovernorModule } from '../../ai/governor/governor.module';
import { SbuModule } from '../sbu/sbu.module';
import { MentorService } from './mentor.service';
import { MentorController } from './mentor.controller';

@Module({
  imports: [PersistenceModule, TelemetryModule, AdapterModule, GovernorModule, SbuModule],
  providers: [MentorService],
  controllers: [MentorController],
  exports: [MentorService],
})
export class MentorModule {}
