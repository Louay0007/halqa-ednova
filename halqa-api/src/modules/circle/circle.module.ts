import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { PersistenceModule } from '../../persistence/persistence.module';
import { EquityModule } from '../equity/equity.module';
import { SbuModule } from '../sbu/sbu.module';
import { CircleService } from './circle.service';
import { CircleController, ContextController } from './circle.controller';

@Module({
  imports: [CoreModule, PersistenceModule, EquityModule, SbuModule],
  providers: [CircleService],
  controllers: [CircleController, ContextController],
  exports: [CircleService],
})
export class CircleModule {}
