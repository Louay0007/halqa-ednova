import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import request from 'supertest';
import { startReplSet } from './support/mongo';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/core/filters/global-exception.filter';
import { requestIdMiddleware } from '../../src/core/interceptors/request-id.middleware';

// The guard itself is unit-tested; this suite pins the wiring — that the
// decorator is read through `APP_GUARD` and that a refusal keeps the uniform
// error envelope, which is what the PWA relies on to render `user_msg`.
//
// Own module instance on purpose: the limiter is in-process, so exhausting the
// budget here must not leak into the other specs.
describe('rate limit (integration)', () => {
  let mongod: { uri: string; stop: () => Promise<unknown> };
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = 'mongodb://placeholder:27017/halqa-test';
    process.env.TOKEN_SECRET = 'rate-limit-test-secret';
    mongod = await startReplSet('halqa-ratelimit');
    process.env.MONGODB_URI = mongod.uri;

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

  it('refuses the 21st session mint in a minute with a retryable 429', async () => {
    const post = (i: number) =>
      request(app.getHttpServer())
        .post('/api/v1/auth/session')
        .send({ nickname: `RateNova${i}`, context: 'study' });

    for (let i = 0; i < 20; i += 1) await post(i).expect(201);

    const blocked = await post(20).expect(429);
    expect(blocked.body).toMatchObject({ error: 'Request failed', code: 'RATE_LIMITED', retryable: true });
    // The 429 fallback row, not a raw English detail: the PWA renders `user_msg`.
    expect(blocked.body.user_msg.en).toMatch(/Too many requests/);
    expect(blocked.body.user_msg.ar).toMatch(/[\u0600-\u06FF]/);
    expect(blocked.body.requestId).toBeDefined();
  }, 120000);
});
