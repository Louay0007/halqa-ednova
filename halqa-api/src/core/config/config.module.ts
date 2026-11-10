import { Module } from '@nestjs/common';
import { loadConfig } from './app-config';

export const APP_CONFIG = 'APP_CONFIG';

@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig() }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
