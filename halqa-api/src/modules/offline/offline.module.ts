import { Module } from '@nestjs/common';
import { OfflineService } from './offline.service';

@Module({
  providers: [OfflineService],
  exports: [OfflineService],
})
export class OfflineModule {}
