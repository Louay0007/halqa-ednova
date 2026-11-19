import { MetricsService } from '../../src/metrics/metrics.service';

/**
 * §7.5 gate: the alert list is only real if these series actually exist and
 * carry the labels the alert rules will query. A metrics endpoint that returns
 * 200 with no useful series is the most common way observability silently fails.
 */
describe('Prometheus metrics', () => {
  it('renders every series the alert rules depend on', async () => {
    const m = new MetricsService();
    const { body, contentType } = await m.render();

    expect(contentType).toContain('text/plain');
    for (const name of [
      'halqa_http_requests_total',
      'halqa_http_request_duration_seconds',
      'halqa_llm_calls_total',
      'halqa_settle_lag_seconds',
      'halqa_degradation_mode',
      'halqa_quota_remaining',
    ]) {
      expect(body).toContain(name);
    }
  });

  it('records request labels as method/route/status', async () => {
    const m = new MetricsService();
    m.httpRequests.inc({ method: 'GET', route: '/questions/:qid/state', status: '200' });
    m.httpDuration.observe({ method: 'GET', route: '/questions/:qid/state' }, 0.03);

    const { body } = await m.render();
    expect(body).toMatch(/halqa_http_requests_total\{[^}]*method="GET"/);
    // Route must be the pattern, never a resolved id: one series per question
    // would be unbounded cardinality.
    expect(body).toContain('route="/questions/:qid/state"');
    expect(body).not.toMatch(/route="\/questions\/Q-/);
  });

  it('exposes degradation mode numerically so an alert can compare it', async () => {
    const m = new MetricsService();
    m.degradation.set(3);
    const { body } = await m.render();
    expect(body).toMatch(/halqa_degradation_mode 3/);
  });

  it('does not double-register when instantiated twice in one process', () => {
    // Two registries in a process must not share collectors, or a test suite that
    // constructs the service twice throws on duplicate metric names.
    const a = new MetricsService();
    const b = new MetricsService();
    expect(a.registry).not.toBe(b.registry);
    expect(() => a.httpRequests.inc({ method: 'GET', route: '/x', status: '200' })).not.toThrow();
  });
});
