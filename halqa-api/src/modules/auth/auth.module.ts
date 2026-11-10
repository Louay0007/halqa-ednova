import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { PersistenceModule } from '../../persistence/persistence.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [CoreModule, PersistenceModule],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
