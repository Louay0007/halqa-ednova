import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { PersistenceModule } from '../../persistence/persistence.module';
import { LLM_PORT } from '../../domain/ports/llm-port';
import { ProviderAdapter } from './provider.adapter';

@Module({
  imports: [CoreModule, PersistenceModule],
  providers: [ProviderAdapter, { provide: LLM_PORT, useExisting: ProviderAdapter }],
  exports: [ProviderAdapter, LLM_PORT],
})
export class AdapterModule {}
