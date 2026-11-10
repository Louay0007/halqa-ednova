import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { JsonLogger } from './logger/json.logger';

@Module({
  imports: [ConfigModule],
  providers: [JsonLogger, { provide: APP_FILTER, useClass: GlobalExceptionFilter }],
  exports: [ConfigModule, JsonLogger],
})
export class CoreModule {}
