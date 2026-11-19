import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { PersistenceModule } from '../../persistence/persistence.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { DataSubjectService } from './data-subject.service';

@Module({
  imports: [CoreModule, PersistenceModule],
  providers: [AuthService, DataSubjectService],
  controllers: [AuthController],
  exports: [AuthService, DataSubjectService],
})
export class AuthModule {}
