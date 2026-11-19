import { Controller, Get, Header } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { Roles } from '../security/roles.decorator';

/**
 * Prometheus scrape endpoint.
 *
 * Admin-only. `/metrics` is not public data regardless of the format: it is a
 * per-route map of traffic, latency and model spend, and it doubles as a way to
 * time a quota exhaustion. A scrape is unauthenticated by default in Prometheus,
 * so the scrape config carries the credential.
 */
@Roles('admin')
@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('prom/metrics')
  @Header('Cache-Control', 'no-store')
  async scrape(): Promise<string> {
    return (await this.metrics.render()).body;
  }
}
