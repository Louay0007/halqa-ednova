import { Module } from '@nestjs/common';
import { AiQueue } from './ai.queue';

@Module({
  providers: [AiQueue],
  exports: [AiQueue],
})
export class QueueModule {}
