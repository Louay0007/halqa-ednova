/**
 * Poller load test (§9.1).
 *
 *   BASE_URL=http://localhost:3000 BASE_TOKEN=<learner jwt> SESSION_ID=S-... \
 *   QUESTION_IDS=Q-1,Q-2,Q-3 npm run load:poller
 *
 * Why a bespoke script instead of k6 or artillery: the thing under test is one
 * route with one specific behaviour — ETag/304 revalidation — and a general load
 * tool reports status codes without telling you whether the *cache* is working.
 * The failure this is built to catch is a run where every request is a 200: the
 * latency looks acceptable, the throughput looks fine, and the design has silently
 * become a per-learner Mongo query at 200x the intended load.
 *
 * Two numbers decide the verdict:
 *   - p95 on `/state` < 50 ms
 *   - 304 share > 90%
 *
 * Load is shaped like a classroom, not like a benchmark: 200 learners, each on
 * their own 1.5 s interval, all against the same small set of questions. That
 * means contention on the same documents, which is the real condition.
 */

export {}; // module scope: keeps every script's top-level names its own
const BASE = (process.env.BASE_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.BASE_TOKEN ?? '';
const SESSION = process.env.SESSION_ID ?? '';
const QUESTIONS = (process.env.QUESTION_IDS ?? '').split(',').filter(Boolean);
const LEARNERS = Number(process.env.LEARNERS ?? 200);
const DURATION_S = Number(process.env.DURATION_S ?? 60);
const P95_BUDGET_MS = Number(process.env.P95_BUDGET_MS ?? 50);
const HIT_BUDGET = Number(process.env.HIT304_BUDGET ?? 0.9);

interface Sample {
  ms: number;
  status: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function main(): Promise<void> {
  if (!BASE || !TOKEN || !SESSION || QUESTIONS.length === 0) {
    console.error(
      '[load:poller] BASE_URL, BASE_TOKEN, SESSION_ID and QUESTION_IDS are required.\n' +
        '  BASE_URL=http://localhost:3000 BASE_TOKEN=... SESSION_ID=S-... QUESTION_IDS=Q-1 npm run load:poller',
    );
    process.exit(1);
  }

  const samples: Sample[] = [];
  const deadline = Date.now() + DURATION_S * 1000;
  let stopped = false;

  // One "learner" per task rather than one task per request: the shape being
  // modelled is N independent clients polling on their own clock, so staggering
  // is inherent and the server sees a realistic spread instead of a thundering
  // herd that no real classroom produces.
  const learnerLoop = async (index: number): Promise<void> => {
    const qid = QUESTIONS[index % QUESTIONS.length];
    const target = `${BASE}/api/v1/questions/${qid}/state`;
    let etag = '';
    // Stagger start so 200 learners do not fire simultaneously.
    await new Promise((r) => setTimeout(r, (index % 30) * 50));
    while (!stopped && Date.now() < deadline) {
      const started = performance.now();
      try {
        // Poll as a browser would: revalidate with the last validator. Without
        // this the whole test measures the wrong path.
        const res = await fetch(target, {
          headers: { authorization: `Bearer ${TOKEN}`, ...(etag ? { 'if-none-match': etag } : {}) },
          signal: AbortSignal.timeout(10_000),
        });
        const ms = performance.now() - started;
        samples.push({ ms, status: res.status });
        const next = res.headers.get('etag');
        if (next) etag = next;
        // Drain the body, or sockets leak and latency drifts for the wrong reason.
        await res.text().catch(() => '');
      } catch {
        samples.push({ ms: performance.now() - started, status: 0 });
      }
      // 1.5 s cadence, jittered so the learners do not converge into lockstep.
      await new Promise((r) => setTimeout(r, 1500 + Math.random() * 400));
    }
  };

  console.log(`[load:poller] ${LEARNERS} learners for ${DURATION_S}s against ${QUESTIONS.length} question(s)`);
  const startedAt = Date.now();
  await Promise.all(Array.from({ length: LEARNERS }, (_, i) => learnerLoop(i)));
  stopped = true;

  const elapsed = (Date.now() - startedAt) / 1000;
  const ok = samples.filter((s) => s.status === 200 || s.status === 304);
  const notMod = samples.filter((s) => s.status === 304).length;
  const errors = samples.filter((s) => s.status === 0 || s.status >= 500).length;
  const latencies = ok.map((s) => s.ms).sort((a, b) => a - b);

  const p50 = percentile(latencies, 50);
  const p95 = percentile(latencies, 95);
  const p99 = percentile(latencies, 99);
  const hitRate = ok.length === 0 ? 0 : notMod / ok.length;
  const rps = samples.length / elapsed;

  console.log(`[load:poller] requests ${samples.length} over ${elapsed.toFixed(1)}s (${rps.toFixed(0)} rps)`);
  console.log(`[load:poller] p50 ${p50.toFixed(1)}ms  p95 ${p95.toFixed(1)}ms  p99 ${p99.toFixed(1)}ms`);
  console.log(`[load:poller] 304 share ${(hitRate * 100).toFixed(1)}%  errors ${errors}`);

  const failures: string[] = [];
  if (p95 > P95_BUDGET_MS) failures.push(`p95 ${p95.toFixed(1)}ms exceeds ${P95_BUDGET_MS}ms`);
  if (hitRate < HIT_BUDGET) {
    failures.push(
      `304 share ${(hitRate * 100).toFixed(1)}% is below ${(HIT_BUDGET * 100).toFixed(0)}% — ` +
        'the ETag input has probably become viewer-dependent',
    );
  }
  if (errors > 0) failures.push(`${errors} transport/5xx errors`);

  if (failures.length > 0) {
    for (const f of failures) console.error(`  FAIL ${f}`);
    process.exit(1);
  }
  console.log('[load:poller] OK — meets the §9.1 SLO');
}

void main().catch((e: unknown) => {
  console.error(`[load:poller] aborted: ${(e as Error).message}`);
  process.exit(1);
});
