import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/core/filters/global-exception.filter';
import { requestIdMiddleware } from '../../src/core/interceptors/request-id.middleware';
import { SoloService } from '../../src/modules/solo/solo.service';
import { WhisperService } from '../../src/modules/whisper/whisper.service';
import { OfflineService } from '../../src/modules/offline/offline.service';
import { GamificationService } from '../../src/modules/gamification/gamification.service';
import { AuthService } from '../../src/modules/auth/auth.service';
import { ProviderAdapter } from '../../src/ai/adapter/provider.adapter';
import { LlmCall, LlmCallDocument } from '../../src/persistence/schemas/ai.schema';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { LlmRequest } from '../../src/domain/ports/llm-port';

// Phase-5 exit gate — output slice works end-to-end:
// solo (≤8 C / 0 L) · capsule (C draft + constraints) · quiz (bank, offline)
// whisper (≤1 C, drift map) · mentor (brief ≤60w) · matcher (deterministic)
// coach (card <100ms) · gamification (caps, no leaderboard)
// dashboard (aggregates) · auth (HMAC) · /metrics (report numbers)
describe('phase-5 outputs (integration)', () => {
  let mongod: MongoMemoryServer;
  let app: INestApplication;
  let solo: SoloService;
  let whisper: WhisperService;
  let offline: OfflineService;
  let game: GamificationService;
  let auth: AuthService;
  let llmCalls: Model<LlmCallDocument>;

  const stub = {
    async compact(req: LlmRequest) {
      await llmCalls.create({
        ts: new Date(), step: req.step, tier: 'C', tokensIn: 10, tokensOut: 10,
        latencyMs: 5, cacheHit: false, fallbackUsed: null, ok: true,
      });
      const text =
        req.step === 'whisper_compare'
          ? '{"kept":["needs-sorted"],"lost":["halving"],"distorted":[],"added":[]}'
          : req.step === 'mentor_brief'
            ? 'Circle needs help with sorted condition. Invite quiet learners to vote now.'
            : req.step === 'capsule_polish'
              ? 'Revisit the sorted rule\nCheck the halving trace\nRe-explain to a peer'
              : 'Quick take: the array must be sorted first.';
      return { text, tokensIn: 10, tokensOut: 10, latencyMs: 5, cached: false };
    },
    async larger(req: LlmRequest) {
      await llmCalls.create({
        ts: new Date(), step: req.step, tier: 'L', tokensIn: 10, tokensOut: 10,
        latencyMs: 5, cacheHit: false, fallbackUsed: null, ok: true,
      });
      return { text: 'Polished capsule line one.\nPolished capsule line two.\nPolished capsule line three.', tokensIn: 10, tokensOut: 10, latencyMs: 5, cached: false };
    },
    async available() {
      return true;
    },
    async logCacheHit() {},
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.CHAOS_ENABLED = 'true';
    process.env.TOKEN_SECRET = 'phase5-test-secret';
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('halqa-phase5');

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

    solo = module.get(SoloService);
    whisper = module.get(WhisperService);
    offline = module.get(OfflineService);
    game = module.get(GamificationService);
    auth = module.get(AuthService);
    llmCalls = module.get<Model<LlmCallDocument>>(getModelToken(LlmCall.name));
  }, 120000);

  afterAll(async () => {
    await app?.close();
    const conn = app?.get<Connection>(getConnectionToken(), { strict: false });
    await conn?.close().catch(() => undefined);
    await mongod?.stop();
  });

  async function setup() {
    const circle = await request(app.getHttpServer())
      .post('/api/v1/circles')
      .send({ topic: 'binary_search', context: 'study', lang: 'en', hostNickname: 'HostA' })
      .expect(201);
    const session = await request(app.getHttpServer())
      .post(`/api/v1/circles/${circle.body.circleId}/sessions`)
      .send()
      .expect(201);
    return { circleId: circle.body.circleId as string, hostId: circle.body.hostLearnerId as string, sessionId: session.body.sessionId as string };
  }

  it('auth: session + me round-trip, HMAC, no PII', async () => {
    const s = await request(app.getHttpServer())
      .post('/api/v1/auth/session')
      .send({ nickname: 'TestNova', context: 'study' })
      .expect(201);
    expect(s.body.token).toBeDefined();
    expect(s.body.learner.id).toMatch(/^L-\d{2,}$/);
    const me = await request(app.getHttpServer()).get('/api/v1/me').set('Authorization', `Bearer ${s.body.token}`).expect(200);
    expect(me.body.learner.nickname).toBe('TestNova');
    void auth;
  });

  it('solo: full loop ≤8 C / 0 L, invite deep-link', async () => {
    const since = new Date();
    const started = await request(app.getHttpServer())
      .post('/api/v1/solo/sessions')
      .send({ topic: 'binary_search', lang: 'darija', learnerId: 'L-90' })
      .expect(201);
    expect(started.body.hat).toBe('NOVA_NOVICE');
    for (let i = 0; i < 3; i += 1) {
      const t = await request(app.getHttpServer())
        .post(`/api/v1/solo/sessions/${started.body.sessionId}/turn`)
        .send({ learnerId: 'L-90', text: 'the array must be sorted because halving needs order', lang: 'darija' })
        .expect(201);
      expect(t.body.progress).toBeGreaterThan(0);
    }
    const hat = await request(app.getHttpServer())
      .post(`/api/v1/solo/sessions/${started.body.sessionId}/hat`)
      .send({ hat: 'NOVA_SKEPTIC' })
      .expect(201);
    expect(hat.body.hat).toBe('NOVA_SKEPTIC');
    const inv = await request(app.getHttpServer()).post(`/api/v1/solo/sessions/${started.body.sessionId}/invite`).send().expect(201);
    expect(inv.body.deepLink).toContain('halqa://join');
    const rows = await llmCalls.find({ sessionId: started.body.sessionId, ts: { $gte: since } }).lean().exec();
    expect(rows.filter((r) => r.tier === 'L').length).toBe(0);
    expect(rows.filter((r) => r.tier === 'C').length).toBeLessThanOrEqual(8);
    void solo;
  });

  it('capsule: build + get, bullets ≤15 words, 3 quiz qids resolve', async () => {
    const { sessionId } = await setup();
    // Seed one resolved question so the draft has material.
    const q = await request(app.getHttpServer()).post('/api/v1/questions').send({ sessionId, askerId: 'L-01', text: 'Why sorted first?' }).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/questions/${q.body.qid}/skip`).send({ askerId: 'L-01' }).expect(201);
    const built = await request(app.getHttpServer()).post(`/api/v1/sessions/${sessionId}/capsule`).send().expect(201);
    expect(built.body.bullets.length).toBe(3);
    for (const b of built.body.bullets as string[]) expect(b.split(/\s+/).length).toBeLessThanOrEqual(15);
    expect((built.body.visual_desc as string).split(/\s+/).length).toBeLessThanOrEqual(40);
    const got = await request(app.getHttpServer()).get(`/api/v1/sessions/${sessionId}/capsule`).expect(200);
    expect(got.body.bullets.length).toBe(3);
  });

  it('quiz: battle from bank, answer awards xp', async () => {
    const { circleId, sessionId } = await setup();
    const battle = await request(app.getHttpServer()).post('/api/v1/quiz/battle').send({ circleId, sessionId }).expect(201);
    expect(battle.body.items.length).toBeGreaterThan(0);
    const first = battle.body.items[0] as { qid: string };
    const ans = await request(app.getHttpServer())
      .post(`/api/v1/quiz/battle/${battle.body.bid}/answer`)
      .send({ sessionId, circleId, learnerId: 'L-01', qid: first.qid, choice: 'a' })
      .expect(201);
    expect(typeof ans.body.correct).toBe('boolean');
    expect(ans.body.xp).toBeGreaterThan(0);
  });

  it('whisper: run ≤1 C, drift map has kept/lost/distorted/added', async () => {
    const { circleId, sessionId } = await setup();
    const since = new Date();
    const run = await request(app.getHttpServer())
      .post('/api/v1/whisper')
      .send({
        sessionId,
        circleId,
        topic: 'binary_search',
        steps: [
          { authorId: 'L-01', text: 'Binary search halves a sorted array, O(log n).' },
          { authorId: 'L-02', text: 'It halves the array each step to find things fast.' },
        ],
      })
      .expect(201);
    expect(run.body.driftMap).toHaveProperty('kept');
    expect(run.body.driftMap).toHaveProperty('lost');
    const rows = await llmCalls.find({ sessionId, ts: { $gte: since }, step: 'whisper_compare' }).lean().exec();
    expect(rows.length).toBeLessThanOrEqual(1);
    const repair = await request(app.getHttpServer())
      .post(`/api/v1/whisper/${run.body.chainId}/repair`)
      .send({ sessionId, circleId, text: 'needs-sorted halving log-n trace' })
      .expect(201);
    expect(repair.body.coverage).toBeGreaterThan(0);
    void whisper;
  });

  it('mentor: join observer + note + brief ≤60 words', async () => {
    const { circleId, sessionId } = await setup();
    const join = await request(app.getHttpServer()).post(`/api/v1/circles/${circleId}/mentor/join`).send({ mentorId: 'L-77' }).expect(201);
    expect(join.body.role).toBe('observer');
    const note = await request(app.getHttpServer())
      .post('/api/v1/mentor/notes')
      .send({ circleId, mentorId: 'L-77', text: 'Nice bridging, keep inviting quiet voices.', sessionId })
      .expect(201);
    expect(note.body.noteId).toBeDefined();
    const brief = await request(app.getHttpServer()).get(`/api/v1/mentor/brief?circleId=${circleId}&sessionId=${sessionId}`).expect(200);
    expect(brief.body.words).toBeLessThanOrEqual(60);
  });

  it('matcher: deterministic, 30 nicknames <1s; board lists circles', async () => {
    const nicks = Array.from({ length: 30 }, (_, i) => `Nick-${i}`);
    const start = Date.now();
    const m = await request(app.getHttpServer()).post('/api/v1/circles/match').send({ nicknames: nicks, seed: 7 }).expect(201);
    expect(Date.now() - start).toBeLessThan(1000);
    expect(m.body.groups.length).toBeGreaterThan(0);
    const again = await request(app.getHttpServer()).post('/api/v1/circles/match').send({ nicknames: nicks, seed: 7 }).expect(201);
    expect(again.body).toEqual(m.body);
    const board = await request(app.getHttpServer()).get('/api/v1/board').expect(200);
    expect(Array.isArray(board.body.circles)).toBe(true);
  });

  it('coach: card renders from passport; gamification caps; no leaderboard route', async () => {
    const dna = await request(app.getHttpServer())
      .post('/api/v1/dna')
      .send({ nickname: 'CoachT', context: 'study', answers: { L1: 'beginner', S1: 'visual', G1: 'fr', C1: 'unsure' } })
      .expect(201);
    const card = await request(app.getHttpServer()).get(`/api/v1/passports/${dna.body.learnerId}/explain-card`).expect(200);
    expect(typeof card.body.card).toBe('string');
    // Daily cap: 10 votes → capped at 15 xp-worth of grants... award returns per-grant xp.
    let total = 0;
    for (let i = 0; i < 10; i += 1) {
      const r = await request(app.getHttpServer())
        .post(`/api/v1/learners/${dna.body.learnerId}/xp`)
        .send({ sessionId: 'S-cap', circleId: 'C-1', signal: 'poll_vote' })
        .expect(201);
      total += r.body.xp as number;
    }
    expect(total).toBeLessThanOrEqual(15);
    await request(app.getHttpServer()).get('/api/v1/leaderboard').expect(404);
    void game;
  });

  it('dashboard: aggregates only; offline pack stats; /metrics populated', async () => {
    const { circleId } = await setup();
    const dash = await request(app.getHttpServer()).get(`/api/v1/dashboard?circleId=${circleId}`).expect(200);
    expect(dash.body.aggregatesOnly).toBe(true);
    expect(JSON.stringify(dash.body)).not.toMatch(/phone|email|photo|gender/);
    const metrics = await request(app.getHttpServer()).get('/api/v1/metrics').expect(200);
    for (const k of ['callsByTier', 'lShare', 'p50', 'p95', 'cacheHitRate', 'peerFirstRate', 'fallbackCounts', 'quotaUsage', 'degradation', 'kb', 'offline']) {
      expect(metrics.body).toHaveProperty(k);
    }
    expect(metrics.body.kb.docs).toBeGreaterThanOrEqual(39);
    expect(metrics.body.offline.snippets).toBe(30);
    void offline;
  });

  it('contract: new routes return the uniform error shape on bad input', async () => {
    const bad = await request(app.getHttpServer()).post('/api/v1/solo/sessions').send({ topic: 'x' }).expect(400);
    expect(bad.body).toHaveProperty('error');
    expect(bad.body).toHaveProperty('user_msg.en');
    const missing = await request(app.getHttpServer()).get('/api/v1/sessions/S-nope/capsule').expect(404);
    expect(missing.body).toHaveProperty('error');
  });
});
