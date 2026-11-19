import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * These exercise the behaviours that actually broke in production terms: the
 * retry/timeout policy, and the rule that a caller abort must never be retried.
 * Everything here is the pure client, so `fetch` is the only thing mocked.
 */

const okJson = (body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

describe('api client', () => {
  beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('retries an idempotent GET on 503, then succeeds', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        if (calls < 3) return new Response('{}', { status: 503 });
        return okJson({ ok: true });
      }),
    );

    const { api } = await import('../src/lib/api');
    const res = await api.healthz();
    expect(res.data).toEqual({ ok: true });
    expect(calls).toBe(3);
  });

  it('does not retry a non-idempotent POST', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        return new Response('{}', { status: 503 });
      }),
    );

    const { api } = await import('../src/lib/api');
    await expect(api.authSession('nina', 'class')).rejects.toMatchObject({ status: 503 });
    expect(calls).toBe(1);
  });

  it('never retries a caller abort', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        calls += 1;
        // Mimic a real aborted fetch.
        if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        throw new DOMException('Aborted', 'AbortError');
      }),
    );

    const { api } = await import('../src/lib/api');
    const ctrl = new AbortController();
    ctrl.abort();

    await expect(api.questionList('S-1', ctrl.signal)).rejects.toBeTruthy();
    // Exactly one attempt: an abort means the caller left, so retrying would
    // resurrect a request nobody is waiting for.
    expect(calls).toBe(1);
  });

  it('surfaces a 401 by clearing the stored token', async () => {
    sessionStorage.setItem('halqa.token', 'stale-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ code: 'EXPIRED' }), { status: 401 })),
    );

    const { api, tokenStore } = await import('../src/lib/api');
    await expect(api.me()).rejects.toMatchObject({ status: 401 });
    expect(tokenStore.get()).toBe('');
  });

  it('learns the clock skew from the Date header once', async () => {
    const serverNow = Date.now() - 60_000;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        okJson({ ok: true }, { Date: new Date(serverNow).toUTCString() }),
      ),
    );

    const { api, clockSkew } = await import('../src/lib/api');
    await api.healthz();
    // Device clock is 60s ahead of the server, so skew is ~+60000.
    expect(clockSkew()).toBeGreaterThan(50_000);
  });

  it('reports 304 as notModified rather than throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 304, headers: { ETag: '"abc"' } })),
    );

    const { api } = await import('../src/lib/api');
    // The ETag is the second parameter; the third is an AbortSignal. Passing the
    // tag in the signal slot is what this test used to do, and it only surfaced
    // once the client started combining signals.
    const res = await api.questionState('Q-1', '"abc"');
    expect(res.notModified).toBe(true);
    expect(res.data).toBeUndefined();
    expect(res.etag).toBe('"abc"');
  });
});
