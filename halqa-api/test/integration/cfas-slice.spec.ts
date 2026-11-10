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
import { RouterService } from '../../src/ai/router/router.service';
import { PeerWindowService } from '../../src/modules/peer-window/peer-window.service';
import { Question, QuestionDocument } from '../../src/persistence/schemas/question.schema';
import { LlmCall, LlmCallDocument, QuotaLedger, QuotaLedgerDocument } from '../../src/persistence/schemas/ai.schema';
import type { LlmRequest } from '../../src/domain/ports/llm-port';

// Phase 3 exit gate — CF-AS vertical slice with a scripted provider:
//  script A (peers answer)  → auditor verifies → RESOLVED peers_verified, peerFirst
//  script B (nobody)        → hint L1 path → RESOLVED hint_path
//  script C (skip)          → direct Quick Take → RESOLVED skip_direct
//  + poll-first on seeded error, idempotent votes, L4 leak gate,
//    poller <1 KB + ETag/304, L-share <25%, no L without a reservation.
describe('phase-3 cfas vertical slice (integration)', () => {
  let mongod: MongoMemoryServer;
  let app: INestApplication;
  let windows: PeerWindowService;
  let routerSvc: RouterService;
  let questions: Model<QuestionDocument>;
  let llmCalls: Model<LlmCallDocument>;
  let ledger: Model<QuotaLedgerDocument>;
  let lReservedAtCall: number[] = [];

  const stub = {
    compactCalls: 0,
    largerCalls: 0,
    async compact(req: LlmRequest) {
      this.compactCalls += 1;
      await llmCalls.create({
        ts: new Date(), step: req.step, tier: 'C', tokensIn: 10, tokensOut: 10,
        latencyMs: 5, cacheHit: false, fallbackUsed: null, ok: true,
      });
      const text =
        req.step === 'group_pulse'
          ? '{"intent":"ask","helpful_0_2":1,"bridging_bool":false,"skeptic_bool":false,"confusion_0_1":0,"lang":"en"}'
          : req.step === 'quick_take'
            ? 'Quick take: the array must be sorted first, then halve each step.'
            : '{"verdict":"supported","confidence":0.9}';
      return { text, tokensIn: 10, tokensOut: 10, latencyMs: 5, cached: false };
    },
    async larger() {
      this.largerCalls += 1;
      const ledgers = await ledger.find({}).lean().exec().catch(() => []);
      lReservedAtCall.push(ledgers.reduce((a, l) => a + (l.reservedL ?? 0) + (l.lUsed ?? 0), 0));
      await llmCalls.create({
        ts: new Date(), step: 'deep_dive', tier: 'L', tokensIn: 10, tokensOut: 10,
        latencyMs: 5, cacheHit: false, fallbackUsed: null, ok: true,
      });
      return { text: 'Deep dive ready.', tokensIn: 10, tokensOut: 10, latencyMs: 5, cached: false };
    },
    async available() {
      return true;
    },
    async logCacheHit(step: unknown, sessionId: string) {
      await llmCalls.create({
        ts: new Date(), sessionId, step: typeof step === 'string' ? step : 'group_pulse',
        tier: 'C', tokensIn: 0, tokensOut: 0, latencyMs: 0, cacheHit: true, fallbackUsed: null, ok: true,
      });
    },
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.CHAOS_ENABLED = 'true';
    process.env.TOKEN_SECRET = 'phase3-test-secret';
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('halqa-phase3');

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

    windows = module.get(PeerWindowService);
    routerSvc = module.get(RouterService);
    questions = module.get<Model<QuestionDocument>>(getModelToken(Question.name));
    llmCalls = module.get<Model<LlmCallDocument>>(getModelToken(LlmCall.name));
    ledger = module.get<Model<QuotaLedgerDocument>>(getModelToken(QuotaLedger.name));
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
    lReservedAtCall = [];
  });

  /** Build circle + 2 learners + session via HTTP (contract coverage). */
  async function setup(topic = 'binary_search'): Promise<{ circleId: string; askerId: string; peerId: string; sessionId: string }> {
    const circle = await request(app.getHttpServer())
      .post('/api/v1/circles')
      .send({ topic, context: 'study', lang: 'en', hostNickname: 'HostA' })
      .expect(201);
    const join = await request(app.getHttpServer())
      .post(`/api/v1/circles/${circle.body.circleId}/join`)
      .send({ nickname: 'PeerB' })
      .expect(201);
    const session = await request(app.getHttpServer())
      .post(`/api/v1/circles/${circle.body.circleId}/sessions`)
      .send()
      .expect(201);
    return { circleId: circle.body.circleId, askerId: circle.body.hostLearnerId, peerId: join.body.learnerId, sessionId: session.body.sessionId };
  }

  async function waitFor(qid: string, pred: (q: QuestionDocument) => boolean, ms = 5000): Promise<QuestionDocument> {
    const start = Date.now();
    for (;;) {
      const q = (await questions.findOne({ _id: qid }).lean().exec()) as unknown as QuestionDocument;
      if (q && pred(q)) return q;
      if (Date.now() - start > ms) throw new Error(`TIMEOUT waiting for ${qid}`);
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  it('script A (peers answer): verify → RESOLVED peers_verified, peerFirst, credits', async () => {
    const { askerId, peerId, sessionId } = await setup();
    const created = await request(app.getHttpServer())
      .post('/api/v1/questions')
      .send({ sessionId, askerId, text: 'Why must the array be sorted first?' })
      .expect(201);
    expect(created.body.state).toBe('OPEN');
    const qid: string = created.body.qid;

    // Hidden prep engaged: pulse + Quick Take (2×C), no L (benign stub → no escalation... 1 chunk? escalate iff ≥3 chunks; fine either way).
    await waitFor(qid, (q) => !!(q.quickTake as { text?: string } | undefined)?.text);

    await request(app.getHttpServer())
      .post(`/api/v1/questions/${qid}/peer-answer`)
      .send({ authorId: peerId, text: 'Because halving only works when the order tells you which half to keep.' })
      .expect(201);

    await windows.settle(qid);
    const q = (await questions.findOne({ _id: qid }).lean().exec()) as unknown as QuestionDocument;
    expect(q.state).toBe('RESOLVED');
    expect(q.resolution).toBe('peers_verified');
    expect(q.peerFirst).toBe(true);
    expect(q.answer?.text).toContain('halving');

    // Peer-first rate is logged on the doc; credits flowed via projections.
    const credits = await request(app.getHttpServer()).get(`/api/v1/sessions/${sessionId}/credits`).expect(200);
    const byId = new Map(credits.body.credits.map((c: { learnerId: string; total: number }) => [c.learnerId, c.total]));
    expect(byId.get(askerId)).toBe(3); // sharp_question
    expect(byId.get(peerId)).toBe(3); // good_explanation

    // Asker sees stages; payload stays <1 KB.
    const state = await request(app.getHttpServer()).get(`/api/v1/questions/${qid}/state?asker=${askerId}`).expect(200);
    expect(state.body.answer.text).toContain('halving');
    expect(Array.isArray(state.body.stages)).toBe(true);
    expect(JSON.stringify(state.body).length).toBeLessThan(1024);
  });

  it('script B (nobody answers): hint L1 path', async () => {
    const { askerId, sessionId } = await setup();
    const created = await request(app.getHttpServer())
      .post('/api/v1/questions')
      .send({ sessionId, askerId, text: 'Is mid always safe?' })
      .expect(201);
    const qid: string = created.body.qid;
    await waitFor(qid, (q) => !!(q.quickTake as { text?: string } | undefined)?.text);

    await windows.settle(qid);
    const q = (await questions.findOne({ _id: qid }).lean().exec()) as unknown as QuestionDocument;
    expect(q.state).toBe('RESOLVED');
    expect(q.resolution).toBe('hint_path');
    expect(q.peerFirst).toBe(false);
    expect(q.answer?.kind).toBe('hint_L1');

    // Ladder continues: L2 allowed after L1…
    const l2 = await request(app.getHttpServer())
      .post(`/api/v1/questions/${qid}/hint`)
      .send({ askerId, level: 2 })
      .expect(201);
    expect(l2.body.level).toBe(2);
    // …but L4 is locked without L1–L3 or skip (T0 leak gate).
    await request(app.getHttpServer()).post(`/api/v1/questions/${qid}/hint`).send({ askerId, level: 4 }).expect(403);
  });

  it('script C (skip): direct Quick Take answer, skip_direct', async () => {
    const { askerId, sessionId } = await setup();
    const created = await request(app.getHttpServer())
      .post('/api/v1/questions')
      .send({ sessionId, askerId, text: 'Explain O(log n) quickly.' })
      .expect(201);
    const qid: string = created.body.qid;
    await waitFor(qid, (q) => !!(q.quickTake as { text?: string } | undefined)?.text);

    const skipped = await request(app.getHttpServer())
      .post(`/api/v1/questions/${qid}/skip`)
      .send({ askerId })
      .expect(201);
    expect(skipped.body.tierUsed).toBe('C');
    expect(skipped.body.answer).toContain('sorted');
    const q = (await questions.findOne({ _id: qid }).lean().exec()) as unknown as QuestionDocument;
    expect(q.resolution).toBe('skip_direct');
    expect(q.skipPressed).toBe(true);
  });

  it('auditor poll-first: seeded error → poll, idempotent votes, close', async () => {
    const { askerId, peerId, sessionId } = await setup();
    const created = await request(app.getHttpServer())
      .post('/api/v1/questions')
      .send({ sessionId, askerId, text: 'Does it work unsorted?' })
      .expect(201);
    const qid: string = created.body.qid;
    await waitFor(qid, (q) => !!(q.quickTake as { text?: string } | undefined)?.text);

    await request(app.getHttpServer())
      .post(`/api/v1/questions/${qid}/peer-answer`)
      .send({ authorId: peerId, text: 'Yes, binary search works on any array.' })
      .expect(201);
    await windows.settle(qid);
    const q = (await questions.findOne({ _id: qid }).lean().exec()) as unknown as QuestionDocument;
    expect(q.resolution).toBe('poll');
    expect(q.pollId).toBeDefined();

    const v1 = await request(app.getHttpServer()).post(`/api/v1/polls/${q.pollId}/vote`).send({ learnerId: peerId, choice: 'needs-fix' }).expect(201);
    const v2 = await request(app.getHttpServer()).post(`/api/v1/polls/${q.pollId}/vote`).send({ learnerId: peerId, choice: 'needs-fix' }).expect(201);
    expect(v2.body).toEqual(v1.body); // idempotent repeat
    expect(v2.body.tally).toMatchObject({ correct: 0, 'needs-fix': 1 });

    const closed = await request(app.getHttpServer()).post(`/api/v1/polls/${q.pollId}/close`).send().expect(201);
    expect(closed.body.winner).toBe('needs-fix');
  });

  it('poller: ETag/304 + peer view hides asker detail', async () => {
    const { askerId, peerId, sessionId } = await setup();
    const created = await request(app.getHttpServer())
      .post('/api/v1/questions')
      .send({ sessionId, askerId, text: 'Poller visibility check?' })
      .expect(201);
    const qid: string = created.body.qid;

    const peerView = await request(app.getHttpServer()).get(`/api/v1/questions/${qid}/state?asker=${peerId}`).expect(200);
    expect(peerView.body.stages).toBeUndefined();
    expect(peerView.body.quickTakeReady).toBeUndefined();
    expect(JSON.stringify(peerView.body).length).toBeLessThan(1024);

    const etag: string = peerView.headers.etag;
    expect(etag).toBeDefined();
    await request(app.getHttpServer()).get(`/api/v1/questions/${qid}/state?asker=${peerId}`).set('If-None-Match', etag).expect(304);
  });

  it('guards: L-share <25% and every L call holds a reservation', async () => {
    const since = new Date();
    const { askerId, peerId, sessionId } = await setup();
    for (const text of [
      'Guard check one: binary search sorted array halving?',
      'Guard check two: trace find 8 in 2 4 6 8?',
      'Guard check three: why O(log n) and not O(n)?',
    ]) {
      const created = await request(app.getHttpServer())
        .post('/api/v1/questions')
        .send({ sessionId, askerId, text })
        .expect(201);
      await waitFor(created.body.qid, (q) => !!(q.quickTake as { text?: string } | undefined)?.text);
      await request(app.getHttpServer())
        .post(`/api/v1/questions/${created.body.qid}/peer-answer`)
        .send({ authorId: peerId, text: 'Halving works on sorted input.' })
        .expect(201);
      await windows.settle(created.body.qid);
    }

    // Session-level L-share: occasional conflict-driven escalation is correct,
    // the declared target (<25% per session) must hold across the turns.
    const fresh = await llmCalls.find({ ts: { $gte: since } }).lean().exec();
    expect(fresh.length).toBeGreaterThan(0);
    const lShare = fresh.filter((r) => r.tier === 'L').length / fresh.length;
    expect(lShare).toBeLessThan(0.25);

    // Forced L path still runs under a governor reservation (invariant #5).
    // Note: with the real KB ingested, some guard turns escalate to L by
    // design (≥3 chunks + misconception contention), so lUsed is ≥1, not ==1.
    const queued = routerSvc.queueLarger(sessionId, { step: 'deep_dive', prompt: 'forced', maxTokens: 50 });
    await queued.result;
    // Let the commit land.
    await new Promise((r) => setTimeout(r, 100));
    const ledgers = await ledger.find({ _id: sessionId }).lean().exec();
    expect(ledgers[0]?.lUsed).toBeGreaterThanOrEqual(1);
    expect(lReservedAtCall.length).toBeGreaterThanOrEqual(1);
    for (const held of lReservedAtCall) expect(held).toBeGreaterThanOrEqual(1);
  });
});
