import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { signToken } from '../../../src/security/tokens';

/**
 * Auth is default-deny, so every integration spec has to present a real token.
 * These helpers mint learners through the anonymous entry points
 * (`POST /circles`, `POST /auth/session`) and hand back the bearer header.
 */
export type Headers = Record<string, string>;

export const bearer = (token: string): Headers => ({ Authorization: `Bearer ${token}` });

export interface Seat {
  learnerId: string;
  token: string;
  headers: Headers;
}

function seat(learnerId: string, token: string): Seat {
  return { learnerId, token, headers: bearer(token) };
}

/**
 * A mentor or admin seat.
 *
 * These roles have no self-service entry point on purpose (nobody should be able
 * to grant themselves teacher access), so a test signs a token directly with the
 * same HMAC the app verifies. Gated routes (§3.4, /metrics, /dashboard,
 * /telemetry, /chaos) are exercised with this seat.
 */
export async function newStaff(
  app: INestApplication,
  secret: string,
  role: 'mentor' | 'admin',
  id?: string,
): Promise<Seat> {
  const sub = id ?? (role === 'admin' ? 'A-01' : 'M-01');
  // The role lives in the token, but the epoch check still requires a learner row
  // — that is the point of the revocation design, so the fixture must create one
  // rather than bypass it.
  const model = app.get<import('mongoose').Model<unknown>>(getModelToken('Learner'));
  await model.updateOne(
    { _id: sub },
    {
      $setOnInsert: {
        _id: sub,
        nickname: role === 'admin' ? 'AdminK' : 'MentorN',
        avatarKey: 'owl',
        context: 'mentor',
        tokenEpoch: 0,
      },
    } as never,
    { upsert: true },
  ).exec();

  const token = signToken({ sub, role, ep: 0 }, secret);
  return seat(sub, token);
}

/** Anonymous visitor: mints a learner with no circle. */
export async function newLearner(app: INestApplication, nickname: string): Promise<Seat> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/session')
    .send({ nickname, context: 'study' })
    .expect(201);
  return seat(res.body.learner.id as string, res.body.token as string);
}

export interface CircleSeat {
  circleId: string;
  sessionId: string;
  host: Seat;
  peer: Seat;
}

/** Host + peer + live session, each carrying the token their role was issued. */
export async function newCircle(
  app: INestApplication,
  opts: { topic?: string; hostNickname?: string; peerNickname?: string } = {},
): Promise<CircleSeat> {
  const circle = await request(app.getHttpServer())
    .post('/api/v1/circles')
    .send({ topic: opts.topic ?? 'binary_search', context: 'study', lang: 'en', hostNickname: opts.hostNickname ?? 'HostA' })
    .expect(201);
  const circleId = circle.body.circleId as string;
  const host = seat(circle.body.hostLearnerId as string, circle.body.token as string);

  const join = await request(app.getHttpServer())
    .post(`/api/v1/circles/${circleId}/join`)
    .send({ nickname: opts.peerNickname ?? 'PeerB' })
    .expect(201);
  const peer = seat(join.body.learnerId as string, join.body.token as string);

  const session = await request(app.getHttpServer())
    .post(`/api/v1/circles/${circleId}/sessions`)
    .set(host.headers)
    .send()
    .expect(201);

  return { circleId, sessionId: session.body.sessionId as string, host, peer };
}
