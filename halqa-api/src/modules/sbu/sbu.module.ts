import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../persistence/persistence.module';
import { EquityModule } from '../equity/equity.module';
import { SbuService } from './sbu.service';

@Module({
  imports: [PersistenceModule, EquityModule],
  providers: [SbuService],
  exports: [SbuService],
})
export class SbuModule {}
