import { Module } from '@nestjs/common';
import { TelemetryModule } from '../../telemetry/telemetry.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { QuizService } from './quiz.service';
import { QuizController } from './quiz.controller';

@Module({
  imports: [TelemetryModule, KnowledgeModule],
  providers: [QuizService],
  controllers: [QuizController],
  exports: [QuizService],
})
export class QuizModule {}
