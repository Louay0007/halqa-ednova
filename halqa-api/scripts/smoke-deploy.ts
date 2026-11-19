/**
 * Post-deploy smoke check (§10.3).
 *
 *   BASE_URL=https://api.example.com npm run smoke:deploy
 *
 * Runs against a *live* environment, not the in-memory app: that is the whole
 * point, and it is why this is a separate script from `smoke-live.ts` (which
 * boots the real app against mongodb-memory-server to check response shapes
 * without a provider key).
 *
 * A rolling deploy with `maxUnavailable: 0` guarantees the new pods pass
 * readiness, but readiness only proves the process is up: it says nothing about
 * a schema change that breaks a read path, a missing env var that only the live
 * config has, or a replica that came up against the old database. So the check
 * walks one representative request per layer and fails on the first anomaly.
 *
 * Deliberately unauthenticated plus one authenticated path: the anonymous surface
 * is what a learner hits first, and it must work before anyone signs in.
 */

export {}; // module scope: keeps every script's top-level names its own
const BASE = (process.env.BASE_URL ?? '').replace(/\/$/, '');
const API = `${BASE}/api/v1`;
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 10_000);

interface Check {
  name: string;
  run: () => Promise<void>;
}

const checks: Check[] = [
  {
    name: 'healthz answers 200',
    run: async () => {
      const r = await get(`${API}/healthz`);
      if (r.status !== 200) throw new Error(`expected 200, got ${r.status}`);
    },
  },
  {
    name: 'readyz reports ready (dependencies reachable)',
    run: async () => {
      const r = await get(`${API}/readyz`);
      // 503 here means the new revision cannot see Mongo — stop the rollout.
      if (r.status !== 200) throw new Error(`expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    },
  },
  {
    name: 'degradation is readable and not BLACK',
    run: async () => {
      const r = await get(`${API}/degradation`);
      if (r.status !== 200) throw new Error(`expected 200, got ${r.status}`);
      const mode = String((r.body as { mode?: string }).mode ?? '').toLowerCase();
      if (mode === 'black') throw new Error('platform is in BLACK degradation after deploy');
    },
  },
  {
    name: 'the anonymous learner path works (the first thing a learner hits)',
    run: async () => {
      // `class` is a real ContextMode; the enum is closed and a wrong value is a
      // 400, which is exactly the kind of thing this script exists to catch in
      // itself before a deploy relies on it.
      const r = await post(`${API}/auth/session`, {
        nickname: `smoke-${Date.now().toString(36)}`,
        avatarKey: 'owl',
        context: 'class',
      });
      if (r.status !== 201) throw new Error(`expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
      const token = (r.body as { token?: string }).token;
      if (!token) throw new Error('no token minted');
      // Token must actually work, not merely be a string.
      const me = await get(`${API}/me`, token);
      if (me.status !== 200) throw new Error(`token rejected by /me: ${me.status}`);
    },
  },
  {
    name: 'error shape is uniform and leaks no stack',
    run: async () => {
      const r = await get(`${API}/nope-route-xyz`);
      if (r.status !== 404) throw new Error(`expected 404, got ${r.status}`);
      if (/at\s+.*\(.*\.ts:/.test(JSON.stringify(r.body))) throw new Error('stack trace leaked in a 404');
    },
  },
  {
    name: 'the CSP header is actually sent (not just configured)',
    run: async () => {
      const res = await fetch(`${API}/healthz`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      const csp = res.headers.get('content-security-policy') ?? '';
      // The unit test proves the policy object; only a live response proves helmet
      // is wired to the server that is serving traffic. The token is in
      // sessionStorage, so a missing script-src is session theft, not cosmetics.
      if (!csp.includes("script-src 'self'")) throw new Error(`CSP missing script-src 'self': ${csp || '(absent)'}`);
      if (!csp.includes("frame-ancestors 'none'")) throw new Error('CSP missing frame-ancestors none');
      if (res.headers.get('x-content-type-options') !== 'nosniff') throw new Error('X-Content-Type-Options missing');
    },
  },
  {
    name: 'metrics are staff-only',
    run: async () => {
      const r = await get(`${API}/prom/metrics`);
      // 401 is the pass. 200 would mean the spend map is public.
      if (r.status !== 401 && r.status !== 403) throw new Error(`/prom/metrics was ${r.status}, expected 401/403`);
    },
  },
];

async function get(url: string, token?: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function post(url: string, payload: unknown): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function main(): Promise<void> {
  if (!BASE) {
    console.error('[smoke:deploy] BASE_URL is required, e.g. BASE_URL=https://api.example.com');
    process.exit(1);
  }
  console.log(`[smoke:deploy] ${API}`);

  let failed = 0;
  for (const c of checks) {
    const started = Date.now();
    try {
      await c.run();
      console.log(`  PASS  ${c.name} (${Date.now() - started}ms)`);
    } catch (e) {
      failed += 1;
      console.error(`  FAIL  ${c.name} (${Date.now() - started}ms) — ${(e as Error).message}`);
    }
  }

  console.log(`[smoke:deploy] ${checks.length - failed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main().catch((e: unknown) => {
  console.error(`[smoke:deploy] aborted: ${(e as Error).message}`);
  process.exit(1);
});
