import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../persistence/persistence.module';
import { CacheService } from './cache.service';

@Module({
  imports: [PersistenceModule],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
