import request from 'supertest';
import type { INestApplication } from '@nestjs/common';

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
