import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../persistence/persistence.module';
import { MatcherModule } from '../matcher/matcher.module';
import { CircleModule } from '../circle/circle.module';
import { SessionModule } from '../session/session.module';
import { WorkshopController } from './workshop.controller';

@Module({
  imports: [PersistenceModule, MatcherModule, CircleModule, SessionModule],
  controllers: [WorkshopController],
})
export class WorkshopModule {}
