import { Global, Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';

/** Global so any service can record without importing this module explicitly. */
@Global()
@Module({
  providers: [MetricsService, { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor }],
  controllers: [MetricsController],
  exports: [MetricsService],
})
export class MetricsModule {}
