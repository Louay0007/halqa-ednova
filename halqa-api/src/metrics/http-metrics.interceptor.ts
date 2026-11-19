import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';
import { MetricsService } from './metrics.service';

/**
 * Records every request into Prometheus (§7.5).
 *
 * Route labels use the **pattern** (`/questions/:qid/state`), never the raw path.
 * Labelling by actual URL would create one time series per question id — the
 * classic way to melt a Prometheus instance.
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request & { route?: { path?: string } }>();
    const res = context.switchToHttp().getResponse<Response>();
    const t0 = process.hrtime.bigint();

    const record = () => {
      const route = req.route?.path ?? 'unknown';
      const seconds = Number(process.hrtime.bigint() - t0) / 1e9;
      const labels = { method: req.method, route };
      this.metrics.httpDuration.observe(labels, seconds);
      this.metrics.httpRequests.inc({ ...labels, status: String(res.statusCode) });
    };

    return next.handle().pipe(tap({ next: record, error: record }));
  }
}
