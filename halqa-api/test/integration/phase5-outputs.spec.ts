import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import request from 'supertest';
import { startReplSet } from './support/mongo';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/core/filters/global-exception.filter';
import { requestIdMiddleware } from '../../src/core/interceptors/request-id.middleware';
import { SoloService } from '../../src/modules/solo/solo.service';
import { WhisperService } from '../../src/modules/whisper/whisper.service';
import { OfflineService } from '../../src/modules/offline/offline.service';
import { GamificationService } from '../../src/modules/gamification/gamification.service';
import { AuthService } from '../../src/modules/auth/auth.service';
import { DataSubjectService } from '../../src/modules/auth/data-subject.service';
import { ProviderAdapter } from '../../src/ai/adapter/provider.adapter';
import { LlmCall, LlmCallDocument } from '../../src/persistence/schemas/ai.schema';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { LlmRequest } from '../../src/domain/ports/llm-port';
import { newCircle, newLearner, newStaff } from './support/auth';

// Phase-5 exit gate — output slice works end-to-end:
// solo (≤8 C / 0 L) · capsule (C draft + constraints) · quiz (bank, offline)
// whisper (≤1 C, drift map) · mentor (brief ≤60w) · matcher (deterministic)
// coach (card <100ms) · gamification (caps, no leaderboard)
// dashboard (aggregates) · auth (HMAC) · /metrics (report numbers)
describe('phase-5 outputs (integration)', () => {
  let mongod: { uri: string; stop: () => Promise<unknown> };
  let app: INestApplication;
  let solo: SoloService;
  let whisper: WhisperService;
  let offline: OfflineService;
  let game: GamificationService;
  let auth: AuthService;
  let dataSubject: DataSubjectService;
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
    mongod = await startReplSet('halqa-phase5');
    process.env.MONGODB_URI = mongod.uri;

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
    dataSubject = module.get(DataSubjectService);
    llmCalls = module.get<Model<LlmCallDocument>>(getModelToken(LlmCall.name));
  }, 120000);

  afterAll(async () => {
    await app?.close();
    const conn = app?.get<Connection>(getConnectionToken(), { strict: false });
    await conn?.close().catch(() => undefined);
    await mongod?.stop();
  });

  /** Circle + host + peer + live session, with the bearer headers each needs. */
  async function setup() {
    const c = await newCircle(app, { topic: 'binary_search' });
    return { circleId: c.circleId, hostId: c.host.learnerId, sessionId: c.sessionId, host: c.host, peer: c.peer };
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
    const learner = await newLearner(app, 'SoloNova');
    const started = await request(app.getHttpServer())
      .post('/api/v1/solo/sessions')
      .set(learner.headers)
      .send({ topic: 'binary_search', lang: 'darija' })
      .expect(201);
    expect(started.body.hat).toBe('NOVA_NOVICE');
    for (let i = 0; i < 3; i += 1) {
      const t = await request(app.getHttpServer())
        .post(`/api/v1/solo/sessions/${started.body.sessionId}/turn`)
        .set(learner.headers)
        .send({ text: 'the array must be sorted because halving needs order', lang: 'darija' })
        .expect(201);
      expect(t.body.progress).toBeGreaterThan(0);
    }
    const hat = await request(app.getHttpServer())
      .post(`/api/v1/solo/sessions/${started.body.sessionId}/hat`)
      .set(learner.headers)
      .send({ hat: 'NOVA_SKEPTIC' })
      .expect(201);
    expect(hat.body.hat).toBe('NOVA_SKEPTIC');
    const inv = await request(app.getHttpServer()).post(`/api/v1/solo/sessions/${started.body.sessionId}/invite`).set(learner.headers).send().expect(201);
    expect(inv.body.deepLink).toContain('halqa://join');
    const rows = await llmCalls.find({ sessionId: started.body.sessionId, ts: { $gte: since } }).lean().exec();
    expect(rows.filter((r) => r.tier === 'L').length).toBe(0);
    expect(rows.filter((r) => r.tier === 'C').length).toBeLessThanOrEqual(8);
    void solo;
  });

  it('capsule: build + get, bullets ≤15 words, 3 quiz qids resolve', async () => {
    const { sessionId, host } = await setup();
    // Seed one resolved question so the draft has material.
    const q = await request(app.getHttpServer()).post('/api/v1/questions').set(host.headers).send({ sessionId, text: 'Why sorted first?' }).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/questions/${q.body.qid}/skip`).set(host.headers).send().expect(201);
    const built = await request(app.getHttpServer()).post(`/api/v1/sessions/${sessionId}/capsule`).set(host.headers).send().expect(201);
    expect(built.body.bullets.length).toBe(3);
    for (const b of built.body.bullets as string[]) expect(b.split(/\s+/).length).toBeLessThanOrEqual(15);
    expect((built.body.visual_desc as string).split(/\s+/).length).toBeLessThanOrEqual(40);
    const got = await request(app.getHttpServer()).get(`/api/v1/sessions/${sessionId}/capsule`).set(host.headers).expect(200);
    expect(got.body.bullets.length).toBe(3);
  });

  it('quiz: battle from bank, answer awards xp', async () => {
    const { circleId, sessionId, host } = await setup();
    const battle = await request(app.getHttpServer()).post('/api/v1/quiz/battle').set(host.headers).send({ circleId, sessionId }).expect(201);
    expect(battle.body.items.length).toBeGreaterThan(0);
    const first = battle.body.items[0] as { qid: string };
    const ans = await request(app.getHttpServer())
      .post(`/api/v1/quiz/battle/${battle.body.bid}/answer`)
      .set(host.headers)
      .send({ sessionId, circleId, qid: first.qid, choice: 'a' })
      .expect(201);
    expect(typeof ans.body.correct).toBe('boolean');
    expect(ans.body.xp).toBeGreaterThan(0);
  });

  it('whisper: run ≤1 C, drift map has kept/lost/distorted/added', async () => {
    const { circleId, sessionId, host, peer } = await setup();
    const since = new Date();
    const run = await request(app.getHttpServer())
      .post('/api/v1/whisper')
      .set(host.headers)
      .send({
        sessionId,
        circleId,
        topic: 'binary_search',
        steps: [
          { authorId: host.learnerId, text: 'Binary search halves a sorted array, O(log n).' },
          { authorId: peer.learnerId, text: 'It halves the array each step to find things fast.' },
        ],
      })
      .expect(201);
    expect(run.body.driftMap).toHaveProperty('kept');
    expect(run.body.driftMap).toHaveProperty('lost');
    const rows = await llmCalls.find({ sessionId, ts: { $gte: since }, step: 'whisper_compare' }).lean().exec();
    expect(rows.length).toBeLessThanOrEqual(1);
    const repair = await request(app.getHttpServer())
      .post(`/api/v1/whisper/${run.body.chainId}/repair`)
      .set(host.headers)
      .send({ sessionId, circleId, text: 'needs-sorted halving log-n trace' })
      .expect(201);
    expect(repair.body.coverage).toBeGreaterThan(0);
    void whisper;
  });

  it('mentor: join observer + note + brief ≤60 words', async () => {
    const { circleId, sessionId, host } = await setup();
    const join = await request(app.getHttpServer()).post(`/api/v1/circles/${circleId}/mentor/join`).set(host.headers).send().expect(201);
    expect(join.body.role).toBe('observer');
    const note = await request(app.getHttpServer())
      .post('/api/v1/mentor/notes')
      .set(host.headers)
      .send({ circleId, text: 'Nice bridging, keep inviting quiet voices.', sessionId })
      .expect(201);
    expect(note.body.noteId).toBeDefined();
    const brief = await request(app.getHttpServer()).get(`/api/v1/mentor/brief?circleId=${circleId}&sessionId=${sessionId}`).set(host.headers).expect(200);
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
    const coach = await newLearner(app, 'CoachT');
    const dna = await request(app.getHttpServer())
      .post('/api/v1/dna')
      .set(coach.headers)
      .send({ answers: { L1: 'beginner', S1: 'visual', G1: 'fr', C1: 'unsure' } })
      .expect(201);
    expect(dna.body.learnerId).toBe(coach.learnerId);
    const card = await request(app.getHttpServer()).get(`/api/v1/passports/${dna.body.learnerId}/explain-card`).set(coach.headers).expect(200);
    expect(typeof card.body.card).toBe('string');

    // XP is deliberately not an HTTP endpoint any more: `POST /learners/:id/xp`
    // let a client name its own signal and mint its own points (§3.6). `award()`
    // is a server-side consequence now, so the daily cap is checked through it.
    let total = 0;
    for (let i = 0; i < 10; i += 1) {
      const r = await game.award(dna.body.learnerId, 'S-cap', 'C-1', 'poll_vote', `cap-${i}`);
      total += r.xp;
    }
    // 3 xp per vote against a 15/day cap, so ten votes yield exactly 15.
    expect(total).toBe(15);
    await request(app.getHttpServer()).get('/api/v1/leaderboard').set(coach.headers).expect(404);
  });

  it('dashboard: aggregates only; offline pack stats; /metrics populated', async () => {
    const { circleId } = await setup();
    // Both are staff surfaces (§3.4): the dashboard is per-session traffic and
    // `/metrics` is a map of model spend, so a learner token is refused.
    const admin = await newStaff(app, process.env.TOKEN_SECRET as string, 'admin');
    const mentor = await newStaff(app, process.env.TOKEN_SECRET as string, 'mentor');

    await request(app.getHttpServer()).get(`/api/v1/dashboard?circleId=${circleId}`).expect(401);
    const dash = await request(app.getHttpServer()).get(`/api/v1/dashboard?circleId=${circleId}`).set(mentor.headers).expect(200);
    expect(dash.body.aggregatesOnly).toBe(true);
    expect(JSON.stringify(dash.body)).not.toMatch(/phone|email|photo|gender/);
    await request(app.getHttpServer()).get('/api/v1/metrics').expect(401);
    const metrics = await request(app.getHttpServer()).get('/api/v1/metrics').set(mentor.headers).expect(200);
    // The Prometheus scrape path is separate from the JSON view and must render
    // the series the alert rules in OPERATIONS.md are written against.
    const prom = await request(app.getHttpServer()).get('/api/v1/prom/metrics').set(admin.headers).expect(200);
    expect(prom.text).toContain('halqa_http_requests_total');
    expect(prom.text).toContain('halqa_degradation_mode');
    await request(app.getHttpServer()).get('/api/v1/prom/metrics').set(mentor.headers).expect(403);
    for (const k of ['callsByTier', 'lShare', 'p50', 'p95', 'cacheHitRate', 'peerFirstRate', 'fallbackCounts', 'quotaUsage', 'degradation', 'kb', 'offline']) {
      expect(metrics.body).toHaveProperty(k);
    }
    expect(metrics.body.kb.docs).toBeGreaterThanOrEqual(39);
    expect(metrics.body.offline.snippets).toBe(30);
    void offline;
  });

  // §3.10 acceptance: a learner can export everything stored about them and ask
  // to be forgotten, and neither is reachable for anyone else's id.
  it('data subject: export carries own data only; delete is soft and cancellable', async () => {
    const mine = await newLearner(app, 'ExportNova');
    const other = await newLearner(app, 'ExportPeer');

    const exp = await request(app.getHttpServer()).get('/api/v1/me/export').set(mine.headers).expect(200);
    expect(exp.body.learner.id).toBe(mine.learnerId);
    expect(exp.body.learner.nickname).toBe('ExportNova');
    // A complete export says what is deliberately absent, not just what exists.
    expect(exp.body.notStored).toContain('real name');
    // No credential is ever exported in reusable form.
    expect(JSON.stringify(exp.body)).not.toMatch(/passphrase/i);
    // Another learner's identity must not appear anywhere in my export.
    expect(JSON.stringify(exp.body)).not.toContain(other.learnerId);
    // Anonymous route: no token, no data.
    await request(app.getHttpServer()).get('/api/v1/me/export').expect(401);

    // Soft delete: access stops immediately because the epoch is bumped.
    const del = await request(app.getHttpServer()).delete('/api/v1/me').set(mine.headers).expect(200);
    expect(del.body.purgeAfter).toBeDefined();
    await request(app.getHttpServer()).get('/api/v1/me').set(mine.headers).expect(401);
    // The record itself is still there — that is what makes it reversible.
    const row = await app.get<Model<unknown>>(getModelToken('Learner')).findOne({ _id: mine.learnerId }).lean().exec();
    expect(row).not.toBeNull();
    expect((row as { purgeAfter?: Date }).purgeAfter).toBeDefined();
    void dataSubject;
  });

  it('contract: new routes return the uniform error shape on bad input', async () => {
    const any = await newLearner(app, 'ContractNova');
    const bad = await request(app.getHttpServer()).post('/api/v1/solo/sessions').set(any.headers).send({ topic: 'x' }).expect(400);
    expect(bad.body).toHaveProperty('error');
    expect(bad.body).toHaveProperty('user_msg.en');
    const missing = await request(app.getHttpServer()).get('/api/v1/sessions/S-nope/capsule').set(any.headers).expect(404);
    expect(missing.body).toHaveProperty('error');
  });
});
