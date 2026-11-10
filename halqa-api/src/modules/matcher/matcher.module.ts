import { Module } from '@nestjs/common';
import { MatcherService } from './matcher.service';

@Module({
  providers: [MatcherService],
  exports: [MatcherService],
})
export class MatcherModule {}
