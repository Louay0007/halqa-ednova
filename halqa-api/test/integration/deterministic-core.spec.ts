import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/core/filters/global-exception.filter';
import { requestIdMiddleware } from '../../src/core/interceptors/request-id.middleware';
import { EquityService } from '../../src/modules/equity/equity.service';
import { SbuService } from '../../src/modules/sbu/sbu.service';
import { LearningService } from '../../src/modules/learning/learning.service';
import { EventBus } from '../../src/telemetry/event-bus';
import { Session, SessionDocument } from '../../src/persistence/schemas/session.schema';

// Phase 2 exit gate: deterministic core works end-to-end.
// - KB seeds load (≥24 bs, ≥12 frac) with claims; SOURCES 100% (unit suite)
// - DNA → passport write; bandit update shifts weights
// - credits worked example: quality (7) > volume (12 plain → ≈2.56)
// - every event recomputes S-B-U; rings reproducible from healthInputs
describe('phase-2 deterministic core (integration)', () => {
  let mongod: MongoMemoryServer;
  let app: INestApplication;
  let equity: EquityService;
  let sbu: SbuService;
  let learning: LearningService;
  let bus: EventBus;
  let sessions: Model<SessionDocument>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.CHAOS_ENABLED = 'true';
    process.env.TOKEN_SECRET = 'phase2-test-secret';
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('halqa-phase2');

    const module: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(requestIdMiddleware);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    equity = module.get(EquityService);
    sbu = module.get(SbuService);
    learning = module.get(LearningService);
    bus = module.get(EventBus);
    sessions = module.get<Model<SessionDocument>>(getModelToken(Session.name));
  }, 120000);

  afterAll(async () => {
    await app?.close();
    const conn = app?.get<Connection>(getConnectionToken(), { strict: false });
    await conn?.close().catch(() => undefined);
    await mongod?.stop();
  });

  it('knowledge: binary_search ≥24 chunks, all with claims', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/kb/chunks?topic=binary_search').expect(200);
    expect(res.body.chunks.length).toBeGreaterThanOrEqual(24);
    for (const c of res.body.chunks) {
      expect(c.chunk_id).toBeDefined();
      expect(Array.isArray(c.claims)).toBe(true);
    }
    const langs = new Set(res.body.chunks.map((c: { lang: string }) => c.lang));
    expect([...langs].sort()).toEqual(['ar', 'darija', 'en', 'fr']);
  });

  it('knowledge: fractions ≥12 chunks + stats', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/kb/chunks?topic=fractions').expect(200);
    expect(res.body.chunks.length).toBeGreaterThanOrEqual(12);
    const stats = await request(app.getHttpServer()).get('/api/v1/kb/stats').expect(200);
    expect(stats.body.docs).toBeGreaterThanOrEqual(39);
  });

  it('dna: items + completion writes passport', async () => {
    const items = await request(app.getHttpServer()).get('/api/v1/dna/items').expect(200);
    expect(items.body.items.map((i: { id: string }) => i.id)).toEqual(['L1', 'S1', 'G1', 'C1']);

    const res = await request(app.getHttpServer())
      .post('/api/v1/dna')
      .send({ nickname: 'TestRim', context: 'study', answers: { L1: 'beginner', S1: 'visual', G1: 'darija', C1: 'lost' } })
      .expect(201);
    expect(res.body.learnerId).toMatch(/^L-\d{2,}$/);
    expect(res.body.passport).toMatchObject({ level: 'beginner', lang: 'darija', hintEagerness: 0.9, inviteMe: true });
    expect(res.body.passport.styleWeights.visual).toBeGreaterThan(1 / 6);
  });

  it('dna: invalid answers → uniform 400 error shape', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/dna')
      .send({ nickname: 'X', context: 'study', answers: { L1: 'expert', S1: 'visual', G1: 'en', C1: 'sure' } })
      .expect(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('user_msg.en');
  });

  it('bandit: successful checks shift weights toward the style', async () => {
    const { learnerId } = await learning.completeDna({
      nickname: 'Bandit',
      context: 'study',
      answers: { L1: 'novice', S1: 'analogy', G1: 'fr', C1: 'unsure' },
    });
    let top = 'analogy';
    for (let i = 0; i < 8; i += 1) {
      const out = await learning.recordCheck(learnerId, 'steps', 1);
      top = out.top;
    }
    expect(top).toBe('steps');
  });

  it('credits: worked example — 1Q+1bridge+1vote (7) beats 12 plain (≈2.56)', async () => {
    const sid = 'S-credits-1';
    await sessions.create({ _id: sid, circleId: 'C-1', agenda: { templateId: 't', steps: [] }, health: { S: 0, B: 0.5, U: 0.5, computedAt: new Date() }, healthInputs: {}, startedAt: new Date() });
    await equity.award(sid, 'L-01', 'sharp_question');
    await equity.award(sid, 'L-01', 'bridging');
    await equity.award(sid, 'L-01', 'poll_vote');
    for (let i = 0; i < 12; i += 1) await equity.award(sid, 'L-02', 'plain_message');
    const totals = await equity.totals(sid);
    expect(totals[0]).toMatchObject({ learnerId: 'L-01', total: 7 });
    expect(totals[1].total).toBeCloseTo(2.56, 2);
  });

  it('projections: events → credits + S-B-U recompute, reproducible', async () => {
    const sid = 'S-proj-1';
    await bus.emit({ sessionId: sid, circleId: 'C-1', actor: 'system', type: 'session_start', payload: {} });
    await bus.emit({ sessionId: sid, circleId: 'C-1', actor: 'L-01', type: 'question_open', payload: {} });
    await bus.emit({ sessionId: sid, circleId: 'C-1', actor: 'L-02', type: 'peer_answer', payload: {} });
    await bus.emit({ sessionId: sid, circleId: 'C-1', actor: 'L-03', type: 'poll_vote', payload: {} });
    await bus.emit({ sessionId: sid, circleId: 'C-1', actor: 'L-02', type: 'me_too', payload: {} });

    const doc = await sessions.findOne({ _id: sid }).lean().exec();
    expect(doc).toBeDefined();
    const inputs = (doc?.healthInputs ?? {}) as Record<string, Record<string, Record<string, number>>>;
    expect(inputs.creditsByLearner).toMatchObject({ 'L-01': 3, 'L-02': 4, 'L-03': 1 });
    expect(doc?.health).toMatchObject({ S: expect.any(Number), B: expect.any(Number), U: expect.any(Number) });
    expect((inputs.sbu as unknown as { creditsByLearner: unknown }).creditsByLearner).toEqual(inputs.creditsByLearner);

    // Reproducibility: recompute twice → identical rings.
    const first = await sbu.recompute(sid);
    const second = await sbu.recompute(sid);
    expect(second).toEqual(first);
    expect(first.tiers).toEqual({ S: expect.any(String), B: expect.any(String), U: expect.any(String) });
  });
});
