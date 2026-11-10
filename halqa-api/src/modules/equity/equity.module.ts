import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../persistence/persistence.module';
import { CoreModule } from '../../core/core.module';
import { EquityService } from './equity.service';

@Module({
  imports: [CoreModule, PersistenceModule],
  providers: [EquityService],
  exports: [EquityService],
})
export class EquityModule {}
