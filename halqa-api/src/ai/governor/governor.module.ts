import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { PersistenceModule } from '../../persistence/persistence.module';
import { BudgetGovernor } from './budget.governor';

@Module({
  imports: [CoreModule, PersistenceModule],
  providers: [BudgetGovernor],
  exports: [BudgetGovernor],
})
export class GovernorModule {}
