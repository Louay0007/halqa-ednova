import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../persistence/persistence.module';
import { SbuModule } from '../sbu/sbu.module';
import { EquityModule } from '../equity/equity.module';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [PersistenceModule, SbuModule, EquityModule],
  controllers: [DashboardController],
})
export class DashboardModule {}
