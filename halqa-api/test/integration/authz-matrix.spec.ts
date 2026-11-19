import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import mongoose from 'mongoose';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/core/filters/global-exception.filter';
import { requestIdMiddleware } from '../../src/core/interceptors/request-id.middleware';
import { TokenEpochService } from '../../src/security/token-epoch.service';
import { newCircle, newLearner, newStaff, type Seat } from './support/auth';
import { startReplSet } from './support/mongo';

/**
 * The authz matrix from §12: learner × mentor × admin × anonymous × cross-circle.
 *
 * `roles-coverage.spec.ts` already proves statically that every controller is
 * either guarded or explicitly public. This is the runtime half, and it exists
 * because a decorator can be present and still be wrong: `@Roles('learner')` on a
 * route that reads a body-supplied learner id passes any static check and still
 * lets one learner read another's data. Only an actual request proves that.
 *
 * Each row states the intent in its name, so a failure says which promise broke
 * rather than which status code moved.
 */
// Set at module scope, before AppModule is imported: `loadConfig()` validates the
// environment and throws on a missing TOKEN_SECRET, and that happens at import
// time rather than in a hook.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://placeholder:27017/halqa-authz';
process.env.TOKEN_SECRET = 'integration-test-secret';

let mongod: { uri: string; stop: () => Promise<unknown> };
let app: INestApplication;
let secret: string;

beforeAll(async () => {
  mongod = await startReplSet('halqa-authz');
  process.env.MONGODB_URI = mongod.uri;
  secret = process.env.TOKEN_SECRET as string;

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication({ logger: false });
  app.use(requestIdMiddleware);
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.setGlobalPrefix('api/v1');
  await app.init();
}, 120_000);

afterAll(async () => {
  await app?.close();
  await mongoose.disconnect();
  await mongod.stop();
});

const get = (url: string, seat?: Seat) => {
  const r = request(app.getHttpServer()).get(url);
  return seat ? r.set(seat.headers) : r;
};

describe('authz matrix — anonymous', () => {
  it('cannot read a circle, a session, or anything staff-scoped', async () => {
    const { circleId, sessionId } = await newCircle(app, { topic: 'fractions' });
    // The join code used to be public on this route (§3.3).
    await get(`/api/v1/circles/${circleId}`).expect(401);
    await get(`/api/v1/questions?sessionId=${sessionId}`).expect(401);
    await get('/api/v1/me').expect(401);
    await get('/api/v1/dashboard').expect(401);
    await get('/api/v1/metrics').expect(401);
    await get('/api/v1/prom/metrics').expect(401);
  });

  it('can still read the two genuinely public surfaces', async () => {
    // `/healthz` must stay anonymous or the load balancer cannot probe it, and
    // `/degradation` drives the banner before a learner has any token.
    await get('/api/v1/healthz').expect(200);
    await get('/api/v1/degradation').expect(200);
  });
});

describe('authz matrix — learner vs learner (the one that matters)', () => {
  it('a learner in neither circle is refused, not merely filtered', async () => {
    const { sessionId, circleId } = await newCircle(app, { topic: 'binary_search' });
    const outsider = await newLearner(app, 'OutsiderO');

    // 403, not an empty 200: an empty list is indistinguishable from "no questions
    // yet" and would hide the leak from the caller.
    await get(`/api/v1/questions?sessionId=${sessionId}`, outsider).expect(403);
    await get(`/api/v1/circles/${circleId}`, outsider).expect(403);
  });

  it('a peer can read the session but only their own export', async () => {
    const { sessionId, host, peer } = await newCircle(app, { topic: 'fractions' });
    await get(`/api/v1/questions?sessionId=${sessionId}`, peer).expect(200);

    // Export is self-scoped by construction — there is no `:id` form — and the
    // body must be the caller's, never the host's.
    const mine = await get('/api/v1/me/export', peer).expect(200);
    expect(mine.body.learner.id).toBe(peer.learnerId);
    expect(JSON.stringify(mine.body)).not.toContain(host.learnerId);
  });

  it('a peer can poll circle health, and gets aggregates but not per-learner credits', async () => {
    // This was broken: the route was mentor/admin-only while the learner UI polls
    // it every 5 s for the header rings, so every learner got a 403 the client
    // swallowed — the rings silently never rendered.
    const { circleId, peer } = await newCircle(app, { topic: 'fractions' });
    await request(app.getHttpServer()).post(`/api/v1/circles/${circleId}/sessions`).set(peer.headers).expect(201);

    const res = await get(`/api/v1/circles/${circleId}/health`, peer).expect(200);
    expect(typeof res.body.S).toBe('number');
    expect(typeof res.body.B).toBe('number');
    expect(typeof res.body.U).toBe('number');
    // Named children's participation data is staff-only (§3.4).
    expect(res.body.credits).toBeUndefined();
    // §9.2: the polled payload stays inside the 1 KB budget at class size.
    expect(JSON.stringify(res.body).length).toBeLessThan(1024);

    // §9.1: a repeat poll is a bodyless 304, so the 5 s loop costs headers only.
    await get(`/api/v1/circles/${circleId}/health`, peer)
      .set({ 'if-none-match': String(res.headers.etag) })
      .expect(304);
  });

  it('staff polling circle health do get the per-learner credits', async () => {
    const { circleId, peer } = await newCircle(app, { topic: 'binary_search' });
    await request(app.getHttpServer()).post(`/api/v1/circles/${circleId}/sessions`).set(peer.headers).expect(201);
    const mentor = await newStaff(app, secret, 'mentor');

    const res = await get(`/api/v1/circles/${circleId}/health`, mentor).expect(200);
    expect(Array.isArray(res.body.credits)).toBe(true);
  });

  it("the asker's private view is not reachable by a peer", async () => {
    const { sessionId, host, peer } = await newCircle(app, { topic: 'binary_search' });
    const created = await request(app.getHttpServer())
      .post('/api/v1/questions')
      .set(host.headers)
      .send({ sessionId, text: 'Why does halving converge?' })
      .expect(201);
    const qid = created.body.qid as string;

    // §3.2: this route reads the token, so a peer gets 403 regardless of what it
    // sends. Previously `?asker=<host id>` exposed Nova's answer to anyone.
    await get(`/api/v1/questions/${qid}/private`, peer).expect(403);
    await get(`/api/v1/questions/${qid}/private`, host).expect(200);
    // The shared poller is readable by every member, and carries no asker extras.
    const shared = await get(`/api/v1/questions/${qid}/state`, peer).expect(200);
    expect(shared.body.stages).toBeUndefined();
  });
});

describe('authz matrix — staff', () => {
  it('a mentor sees the dashboard but not the spend map; an admin sees both', async () => {
    const { circleId } = await newCircle(app, { topic: 'binary_search' });
    const mentor = await newStaff(app, secret, 'mentor');
    const admin = await newStaff(app, secret, 'admin');

    await get(`/api/v1/dashboard?circleId=${circleId}`, mentor).expect(200);
    // Two different surfaces, deliberately with different audiences:
    //  - `/metrics` (JSON) is what the mentor dashboard reads, so mentor+admin.
    //  - `/prom/metrics` is the scrape endpoint: infrastructure, admin only.
    // Collapsing them into one role would either break the dashboard or widen the
    // scrape credential to every teacher, so the split is the design.
    await get('/api/v1/metrics', mentor).expect(200);
    await get('/api/v1/prom/metrics', mentor).expect(403);
    await get('/api/v1/metrics', admin).expect(200);
    await get('/api/v1/prom/metrics', admin).expect(200);
  });

  it('a learner cannot reach any staff surface', async () => {
    const learner = await newLearner(app, 'CuriousC');
    await get('/api/v1/metrics', learner).expect(403);
    await get('/api/v1/dashboard', learner).expect(403);
    await get('/api/v1/prom/metrics', learner).expect(403);
  });

  it('a learner cannot force the platform into BLACK', async () => {
    const learner = await newLearner(app, 'ChaosC');
    await request(app.getHttpServer())
      .post('/api/v1/chaos')
      .set(learner.headers)
      .send({ mode: 'black' })
      .expect(403);
  });

  it('revocation is immediate: bumping the epoch invalidates a live token', async () => {
    const victim = await newLearner(app, 'RevokedR');
    await get('/api/v1/me', victim).expect(200);

    // Goes through the service, not a direct field write: the epoch is cached for
    // 15 s, and writing the collection behind the cache is the bug this pins.
    const epochs = app.get(TokenEpochService);
    await epochs.bump(victim.learnerId);
    void app.get<import('mongoose').Model<unknown>>(getModelToken('Learner'));

    await get('/api/v1/me', victim).expect(401);
  });
});
