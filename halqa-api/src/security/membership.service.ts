import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Err } from '../common/http-errors';
import { Circle, CircleDocument } from '../persistence/schemas/circle.schema';
import { Session, SessionDocument } from '../persistence/schemas/session.schema';

/**
 * Resource-level authorization.
 *
 * Authentication proves *who* is calling; it says nothing about *what* they may
 * touch. Circle- and session-scoped routes take their ids from the URL, so every
 * one of them has to confirm the caller is actually in that circle. A learner id
 * outside `circle.members` gets `403 NOT_A_MEMBER` rather than a 404, because the
 * circle is not a secret — the caller just has no business in it.
 */
@Injectable()
export class MembershipService {
  constructor(
    @InjectModel(Circle.name) private readonly circles: Model<CircleDocument>,
    @InjectModel(Session.name) private readonly sessions: Model<SessionDocument>,
  ) {}

  async assertMember(circleId: string, learnerId: string): Promise<void> {
    const circle = await this.circles.findOne({ _id: circleId }).select('members').lean().exec();
    if (!circle) throw Err.missing(`CIRCLE_NOT_FOUND:${circleId}`);
    if (!circle.members.some((m) => m.learnerId === learnerId)) throw Err.denied(`NOT_A_MEMBER:${circleId}`);
  }

  /** Every named learner must belong to the circle (used for relay chains). */
  async assertMembers(circleId: string, learnerIds: string[]): Promise<void> {
    const circle = await this.circles.findOne({ _id: circleId }).select('members').lean().exec();
    if (!circle) throw Err.missing(`CIRCLE_NOT_FOUND:${circleId}`);
    const inside = new Set(circle.members.map((m) => m.learnerId));
    for (const id of learnerIds) {
      if (!inside.has(id)) throw Err.denied(`NOT_A_MEMBER:${circleId}`);
    }
  }

  /** Resolve a session's circle, then check membership there. */
  async assertSessionMember(sessionId: string, learnerId: string): Promise<void> {
    const session = await this.sessions.findOne({ _id: sessionId }).select('circleId').lean().exec();
    if (!session) throw Err.missing(`SESSION_NOT_FOUND:${sessionId}`);
    await this.assertMember(session.circleId, learnerId);
  }
}
