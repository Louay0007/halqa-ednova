import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

/**
 * Prometheus registry for HALQA (§7.5).
 *
 * The plan's alert list drives what is measured here:
 *   - settle lag > 30 s          → halqa_settle_lag_seconds
 *   - 5xx rate > 1% for 5 min    → halqa_http_requests_total{status}
 *   - L-share > 0.25 for 15 min  → halqa_llm_calls_total{tier}
 *   - readiness failing twice    → the readyz endpoint itself
 *   - quota < 10% remaining      → halqa_quota_remaining
 *
 * Metrics are registered once, at construction. That matters: a second
 * `new Registry()` in a test would otherwise throw on duplicate registration.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly httpRequests = new Counter({
    name: 'halqa_http_requests_total',
    help: 'HTTP requests by route, method and status class',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [this.registry],
  });

  readonly httpDuration = new Histogram({
    name: 'halqa_http_request_duration_seconds',
    help: 'HTTP request latency in seconds',
    labelNames: ['method', 'route'] as const,
    // Buckets tuned to the §1 SLO: p95 < 400 ms on non-AI routes.
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.4, 0.75, 1, 2.5, 5, 15],
    registers: [this.registry],
  });

  readonly llmCalls = new Counter({
    name: 'halqa_llm_calls_total',
    help: 'Model calls by tier (T0 = offline, C = compact, L = larger)',
    labelNames: ['tier', 'step'] as const,
    registers: [this.registry],
  });

  readonly settleLag = new Histogram({
    name: 'halqa_settle_lag_seconds',
    help: 'How late a peer window settled relative to its windowEndsAt',
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 300],
    registers: [this.registry],
  });

  readonly degradation = new Gauge({
    name: 'halqa_degradation_mode',
    help: 'Current degradation mode: 0 green, 1 orange, 2 red, 3 black',
    registers: [this.registry],
  });

  readonly quotaRemaining = new Gauge({
    name: 'halqa_quota_remaining',
    help: 'Remaining model calls in the served session by tier',
    labelNames: ['tier', 'sessionId'] as const,
    registers: [this.registry],
  });

  readonly cacheHits = new Counter({
    name: 'halqa_cache_events_total',
    help: 'Semantic cache outcomes',
    labelNames: ['result'] as const,
    registers: [this.registry],
  });

  constructor() {
    // Event-loop lag, heap and GC: the cheapest early warning that a pod is
    // unhealthy before it fails a probe.
    collectDefaultMetrics({ register: this.registry, prefix: 'halqa_' });
  }

  async render(): Promise<{ body: string; contentType: string }> {
    return { body: await this.registry.metrics(), contentType: this.registry.contentType };
  }
}
