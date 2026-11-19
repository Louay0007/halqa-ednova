import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { KnowledgeModule } from '../modules/knowledge/knowledge.module';
import { HealthController } from './health.controller';

@Module({ imports: [PersistenceModule, KnowledgeModule], controllers: [HealthController] })
export class HealthModule {}
