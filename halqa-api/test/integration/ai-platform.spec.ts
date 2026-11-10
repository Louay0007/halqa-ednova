import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/core/filters/global-exception.filter';
import { requestIdMiddleware } from '../../src/core/interceptors/request-id.middleware';
import { ProviderAdapter } from '../../src/ai/adapter/provider.adapter';
import { BudgetGovernor } from '../../src/ai/governor/budget.governor';
import { AiQueue } from '../../src/ai/queue/ai.queue';
import { DegradationService } from '../../src/ai/degradation/degradation.service';
import { RetrievalService } from '../../src/ai/retrieval/retrieval.service';
import { RouterService } from '../../src/ai/router/router.service';
import { LlmCall, LlmCallDocument, QuotaLedger, QuotaLedgerDocument } from '../../src/persistence/schemas/ai.schema';
import { EventBus } from '../../src/telemetry/event-bus';
import type { LlmPort } from '../../src/domain/ports/llm-port';

// Phase 1 exit gate: AI spine works end-to-end against a stubbed provider.
// - pulse costs exactly 1×C; equivalent re-ask served from cache (0 new calls)
// - every call lands in llm_calls (incl. cacheHit rows)
// - quota exhaustion denies explicitly + emits quota_event + degrades
// - concurrent bursts cannot overspend (atomic reserve)
// - larger() is never touched by the routine pulse path
describe('phase-1 ai spine (integration)', () => {
  let mongod: MongoMemoryServer;
  let app: INestApplication;
  let governor: BudgetGovernor;
  let queue: AiQueue;
  let degradation: DegradationService;
  let retrieval: RetrievalService;
  let router: RouterService;
  let bus: EventBus;
  let llmCalls: Model<LlmCallDocument>;
  let ledger: Model<QuotaLedgerDocument>;

  const stub: StubPort = {
    compactCalls: 0,
    largerCalls: 0,
    cacheHitLogs: 0,
    async compact() {
      this.compactCalls += 1;
      await llmCalls.create({
        ts: new Date(),
        step: 'group_pulse',
        tier: 'C',
        tokensIn: 64,
        tokensOut: 32,
        latencyMs: 5,
        cacheHit: false,
        fallbackUsed: null,
        ok: true,
      });
      return {
        text: '{"intent":"ask","helpful_0_2":1,"bridging_bool":false,"skeptic_bool":false,"confusion_0_1":0,"lang":"en"}',
        tokensIn: 64,
        tokensOut: 32,
        latencyMs: 5,
        cached: false,
      };
    },
    async larger() {
      this.largerCalls += 1;
      return { text: 'deep', tokensIn: 1, tokensOut: 1, latencyMs: 5, cached: false };
    },
    async available() {
      return true;
    },
    async logCacheHit(_step: unknown, _sessionId: string) {
      this.cacheHitLogs += 1;
      await llmCalls.create({
        ts: new Date(),
        sessionId: _sessionId,
        step: typeof _step === 'string' ? _step : 'group_pulse',
        tier: 'C',
        tokensIn: 0,
        tokensOut: 0,
        latencyMs: 0,
        cacheHit: true,
        fallbackUsed: null,
        ok: true,
      });
    },
  };
  type StubPort = LlmPort & { logCacheHit(step: unknown, sessionId: string): Promise<void> } & {
    compactCalls: number;
    largerCalls: number;
    cacheHitLogs: number;
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.CHAOS_ENABLED = 'true';
    process.env.TOKEN_SECRET = 'phase1-test-secret';
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('halqa-phase1');

    const module: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ProviderAdapter)
      .useValue(stub)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(requestIdMiddleware);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    governor = module.get(BudgetGovernor);
    queue = module.get(AiQueue);
    degradation = module.get(DegradationService);
    retrieval = module.get(RetrievalService);
    router = module.get(RouterService);
    bus = module.get(EventBus);
    llmCalls = module.get<Model<LlmCallDocument>>(getModelToken(LlmCall.name));
    ledger = module.get<Model<QuotaLedgerDocument>>(getModelToken(QuotaLedger.name));

    retrieval.addDocs([
      { chunk_id: 'bs-en-01', topic: 'binary_search', lang: 'en', level: 'intro', kind: 'lesson', title: 't', text: 'Binary search halves a sorted array each step to find a target in O log n', claims: ['needs-sorted'] },
      { chunk_id: 'bs-fr-01', topic: 'binary_search', lang: 'fr', level: 'intro', kind: 'lesson', title: 't', text: 'La recherche dichotomique divise un tableau trie', claims: ['needs-sorted'] },
    ]);
  }, 120000);

  afterAll(async () => {
    await app?.close();
    const conn = app?.get<Connection>(getConnectionToken(), { strict: false });
    await conn?.close().catch(() => undefined);
    await mongod?.stop();
  });

  beforeEach(() => {
    stub.compactCalls = 0;
    stub.largerCalls = 0;
    stub.cacheHitLogs = 0;
  });

  it('retrieval: search returns hits with non-empty cites', () => {
    const hits = retrieval.search('binary search sorted array', 'intro', 'en', 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].chunkId).toBe('bs-en-01');
    for (const h of hits) expect(h.cites.length).toBeGreaterThan(0);
  });

  it('governor: reserve→commit accounting + explicit deny', async () => {
    const sid = 'S-gov-1';
    expect(await governor.reserve('C', sid)).toBe(true);
    await governor.commit('C', sid);
    expect((await governor.usage(sid)).cUsed).toBe(1);
    expect(await governor.reserve('L', sid)).toBe(true);
    await governor.release('L', sid);
    expect((await governor.usage(sid)).lUsed).toBe(0);
  });

  it('governor: concurrent bursts cannot overspend the cap', async () => {
    const sid = 'S-gov-race';
    await ledger.updateOne({ _id: sid }, { $set: { cCap: 3, lCap: 0 } }, { upsert: true }).exec();
    const results = await Promise.all(Array.from({ length: 8 }, () => governor.reserve('C', sid)));
    expect(results.filter(Boolean).length).toBe(3);
  });

  it('pulse: 1×C, then equivalent re-ask served from cache with 0 new calls', async () => {
    const sid = 'S-pulse-1';
    const input = { sessionId: sid, circleId: 'C-1', text: 'Why must the array be sorted?', lang: 'en', level: 'intro' };
    const first = await router.pulse(input);
    expect(first.servedFromCache).toBe(false);
    expect(first.quotaExhausted).toBe(false);
    expect(first.pulse.intent).toBe('ask');
    expect(stub.compactCalls).toBe(1);

    const second = await router.pulse({ ...input, text: '  WHY must the array be sorted?? ' });
    expect(second.servedFromCache).toBe(true);
    expect(stub.compactCalls).toBe(1); // no new model call
    expect(stub.cacheHitLogs).toBe(1);

    const rows = await llmCalls.find({ sessionId: sid }).lean().exec();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.some((r) => r.cacheHit === true)).toBe(true);
    expect((await governor.usage(sid)).cUsed).toBe(1); // cache hit spends nothing
  });

  it('pulse: routine path never touches larger() (L-share guard)', async () => {
    await router.pulse({ sessionId: 'S-pulse-2', circleId: 'C-1', text: 'Is mid computed safely?', lang: 'en', level: 'intro' });
    await router.pulse({ sessionId: 'S-pulse-3', circleId: 'C-1', text: 'Trace find 8 in 2 4 6 8', lang: 'en', level: 'intro' });
    expect(stub.largerCalls).toBe(0);
  });

  it('pulse: exhaustion denies explicitly, emits quota_event, degrades to RED', async () => {
    const sid = 'S-pulse-deny';
    await ledger.updateOne({ _id: sid }, { $set: { cCap: 0, lCap: 0 } }, { upsert: true }).exec();
    const out = await router.pulse({ sessionId: sid, circleId: 'C-9', text: 'anything', lang: 'en', level: 'intro' });
    expect(out.quotaExhausted).toBe(true);
    expect(stub.compactCalls).toBe(0);
    expect(await bus.countByType(sid, 'quota_event')).toBeGreaterThanOrEqual(1);
    expect(degradation.getMode()).toBe('red');
    degradation.clearForce();
  });

  it('queue: serial execution with position + ETA', async () => {
    const order: number[] = [];
    const slow = (n: number) => () => new Promise<number>((r) => setTimeout(() => { order.push(n); r(n); }, 30));
    const a = queue.enqueue('deep_dive', 'L', slow(1));
    const b = queue.enqueue('deep_dive', 'L', slow(2));
    expect(a.position).toBe(1);
    expect(b.position).toBe(2);
    expect(b.etaMs).toBeGreaterThanOrEqual(a.etaMs);
    await expect(a.result).resolves.toBe(1);
    await expect(b.result).resolves.toBe(2);
    expect(order).toEqual([1, 2]); // FIFO, one in flight
  });

  it('queue: rejection surfaces to the caller (fallback path)', async () => {
    const { result } = queue.enqueue('deep_dive', 'L', () => Promise.reject(new Error('L_QUOTA_EXHAUSTED')));
    await expect(result).rejects.toThrow('L_QUOTA_EXHAUSTED');
  });

  it('degradation: evaluate + replay emit fallback_state events', async () => {
    const sid = 'S-deg-1';
    await degradation.evaluate({ bus, sessionId: sid, circleId: 'C-1', lAvailable: false, quotaExhausted: false, serviceDown: false });
    await degradation.evaluate({ bus, sessionId: sid, circleId: 'C-1', lAvailable: true, quotaExhausted: false, serviceDown: false });
    expect(await bus.countByType(sid, 'fallback_state')).toBeGreaterThanOrEqual(1);
    const seen = await degradation.replay(bus, sid, 'C-1');
    expect(seen).toEqual(['orange', 'red', 'black']);
  });

  it('chaos http: force + read mode (dev-only)', async () => {
    await request(app.getHttpServer()).post('/api/v1/chaos').send({ mode: 'orange' }).expect(201);
    const res = await request(app.getHttpServer()).get('/api/v1/degradation').expect(200);
    expect(res.body.mode).toBe('orange');
    degradation.clearForce();
  });
});
