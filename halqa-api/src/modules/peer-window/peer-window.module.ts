import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../persistence/persistence.module';
import { TelemetryModule } from '../../telemetry/telemetry.module';
import { AuditorModule } from '../auditor/auditor.module';
import { HintModule } from '../hints/hint.module';
import { GamificationModule } from '../gamification/gamification.module';
import { PeerWindowService } from './peer-window.service';

@Module({
  imports: [PersistenceModule, TelemetryModule, AuditorModule, HintModule, GamificationModule],
  providers: [PeerWindowService],
  exports: [PeerWindowService],
})
export class PeerWindowModule {}
