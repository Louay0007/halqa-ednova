import { Module } from '@nestjs/common';
import { DegradationService } from './degradation.service';

@Module({
  providers: [DegradationService],
  exports: [DegradationService],
})
export class DegradationModule {}
