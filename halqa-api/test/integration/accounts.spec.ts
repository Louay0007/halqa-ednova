import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/core/filters/global-exception.filter';
import { requestIdMiddleware } from '../../src/core/interceptors/request-id.middleware';
import { bearer, newLearner } from './support/auth';

// The account layer: an anonymous learner record becomes an account by claiming
// a handle and a passphrase. No e-mail, no name — the platform's PII-free
// promise is enforced by `schema-gate.spec.ts`, so these are the only fields
// credentials can live in.
describe('accounts (integration)', () => {
  let mongod: MongoMemoryServer;
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = 'mongodb://placeholder:27017/halqa-test';
    process.env.TOKEN_SECRET = 'accounts-test-secret';
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('halqa-test');

    const module: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(requestIdMiddleware);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  }, 120000);

  afterAll(async () => {
    await app?.close();
    const conn = app?.get<Connection>(getConnectionToken(), { strict: false });
    await conn?.close().catch(() => undefined);
    await mongod?.stop();
  });

  const register = (body: Record<string, unknown>, headers?: Record<string, string>) => {
    const req = request(app.getHttpServer()).post('/api/v1/auth/register');
    if (headers) req.set(headers);
    return req.send(body);
  };
  const login = (body: Record<string, unknown>) => request(app.getHttpServer()).post('/api/v1/auth/login').send(body);
  const me = (token: string) => request(app.getHttpServer()).get('/api/v1/me').set(bearer(token));

  it('registers an account, then signs back in from a fresh client', async () => {
    const created = await register({ handle: 'Rim_07', passphrase: 'orbital-lantern-9', context: 'study' }).expect(201);
    expect(created.body.learner).toMatchObject({ handle: 'rim_07' });
    expect(created.body.learner.id).toMatch(/^L-\d{2,}$/);
    expect(created.body.learner).not.toHaveProperty('secretHash');
    expect(JSON.stringify(created.body)).not.toContain('orbital-lantern-9');

    // The device that registered is signed in.
    await me(created.body.token).expect(200);

    // A second device starts with no token at all and proves only the passphrase.
    const back = await login({ handle: '  RIM_07 ', passphrase: 'orbital-lantern-9' }).expect(201);
    expect(back.body.learner.id).toBe(created.body.learner.id);
    const profile = await me(back.body.token).expect(200);
    // The handle normalises for lookup; the display nickname keeps the casing typed.
    expect(profile.body.learner.handle).toBe('rim_07');
    expect(profile.body.learner.nickname).toBe('Rim_07');
  });

  it('answers a wrong passphrase and an unknown handle with the same refusal', async () => {
    await register({ handle: 'wrongpair', passphrase: 'orbital-lantern-9' }).expect(201);

    const wrongPass = await login({ handle: 'wrongpair', passphrase: 'orbital-lantern-8' }).expect(403);
    const noSuchUser = await login({ handle: 'nobodyhere', passphrase: 'orbital-lantern-8' }).expect(403);

    // Identical code and status: the endpoint must not be an account oracle.
    expect(wrongPass.body.code).toBe('LOGIN_FAILED');
    expect(noSuchUser.body.code).toBe('LOGIN_FAILED');
    expect(wrongPass.body.user_msg).toEqual(noSuchUser.body.user_msg);
  });

  it('refuses a handle that is already taken', async () => {
    await register({ handle: 'takenname', passphrase: 'orbital-lantern-9' }).expect(201);
    const clash = await register({ handle: 'takenname', passphrase: 'another-secret-1' }).expect(409);
    expect(clash.body.code).toBe('ACCOUNT_EXISTS');
    // The original credential still works: the clash changed nothing.
    await login({ handle: 'takenname', passphrase: 'orbital-lantern-9' }).expect(201);
  });

  it('rejects handles the schema cannot index and passphrases below the floor', async () => {
    expect((await register({ handle: 'no spaces', passphrase: 'orbital-lantern-9' }).expect(400)).body.code).toBe('HANDLE_INVALID');
    expect((await register({ handle: 'ok_handle', passphrase: 'short' }).expect(400)).body.code).toBe('PASSPHRASE_LENGTH');
  });

  it('upgrades a guest in place, keeping the same learner id and revoking the guest token', async () => {
    const guest = await newLearner(app, 'GuestNova');
    const upgraded = await register(
      { handle: 'upgrader', passphrase: 'orbital-lantern-9', nickname: 'GuestNova' },
      guest.headers,
    ).expect(201);

    // Same record, now an account — progress made as a guest is not orphaned.
    expect(upgraded.body.learner.id).toBe(guest.learnerId);
    expect(upgraded.body.learner.handle).toBe('upgrader');

    // The pre-credential token was minted at a lower epoch and is now dead.
    await me(guest.token).expect(401);
    await me(upgraded.body.token).expect(200);
  });

  it('refuses to let an existing account claim a second handle with its own token', async () => {
    const created = await register({ handle: 'alreadyhas', passphrase: 'orbital-lantern-9' }).expect(201);
    const second = await register({ handle: 'greedyhandle', passphrase: 'orbital-lantern-9' }, bearer(created.body.token)).expect(409);
    expect(second.body.code).toBe('ACCOUNT_EXISTS');
  });

  it('rotates the passphrase and signs out every other device', async () => {
    const created = await register({ handle: 'rotator', passphrase: 'orbital-lantern-9' }).expect(201);
    const other = await login({ handle: 'rotator', passphrase: 'orbital-lantern-9' }).expect(201);

    const rotated = await request(app.getHttpServer())
      .post('/api/v1/auth/passphrase')
      .set(bearer(created.body.token))
      .send({ current: 'orbital-lantern-9', next: 'orbital-lantern-10' })
      .expect(201);

    // The bump signed out the other device and the pre-change token…
    await me(created.body.token).expect(401);
    await me(other.body.token).expect(401);
    // …while the device that changed it is handed a token at the new epoch.
    await me(rotated.body.token).expect(200);

    await login({ handle: 'rotator', passphrase: 'orbital-lantern-9' }).expect(403);
    const fresh = await login({ handle: 'rotator', passphrase: 'orbital-lantern-10' }).expect(201);
    await me(fresh.body.token).expect(200);
  });

  it('refuses a passphrase change that cannot prove the current one', async () => {
    const created = await register({ handle: 'guardian', passphrase: 'orbital-lantern-9' }).expect(201);
    const bad = await request(app.getHttpServer())
      .post('/api/v1/auth/passphrase')
      .set(bearer(created.body.token))
      .send({ current: 'not-my-passphrase', next: 'orbital-lantern-10' })
      .expect(403);
    expect(bad.body.code).toBe('LOGIN_FAILED');
    // The refused attempt left the account usable with the real passphrase.
    await login({ handle: 'guardian', passphrase: 'orbital-lantern-9' }).expect(201);
  });

  it('requires an account before a passphrase can be changed', async () => {
    const guest = await newLearner(app, 'NoAccountNova');
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/passphrase')
      .set(guest.headers)
      .send({ current: 'anything-at-all', next: 'orbital-lantern-10' })
      .expect(400);
    expect(res.body.code).toBe('ACCOUNT_REQUIRED');
  });
});
