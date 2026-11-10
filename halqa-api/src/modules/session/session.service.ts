import { Err } from '../../common/http-errors';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import { contextConfig } from '../../domain/context-modes';
import type { ContextMode } from '../../common/types/api-error';
import { BudgetGovernor } from '../../ai/governor/budget.governor';
import { Circle, CircleDocument } from '../../persistence/schemas/circle.schema';
import { Session, SessionDocument } from '../../persistence/schemas/session.schema';
import { EquityService } from '../equity/equity.service';
import { SbuService } from '../sbu/sbu.service';
import { EventBus } from '../../telemetry/event-bus';

/**
 * SessionService (3.2) — agenda from the context template, start/end,
 * stored health projection, per-session credits + dispersion.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @InjectModel(Session.name) private readonly sessions: Model<SessionDocument>,
    @InjectModel(Circle.name) private readonly circles: Model<CircleDocument>,
    private readonly governor: BudgetGovernor,
    private readonly equity: EquityService,
    private readonly sbu: SbuService,
    private readonly bus: EventBus,
  ) {}

  async start(circleId: string): Promise<SessionDocument> {
    const circle = await this.circles.findOne({ _id: circleId }).lean().exec();
    if (!circle) throw Err.missing(`CIRCLE_NOT_FOUND:${circleId}`);
    const template = contextConfig(circle.context as ContextMode);
    const sessionId = `S-${randomBytes(4).toString('hex')}`;
    const doc = await this.sessions.create({
      _id: sessionId,
      circleId,
      agenda: { templateId: circle.context, steps: template.agenda.map((s) => ({ ...s, done: false })) },
      health: { S: 0, B: 0.5, U: 0.5, computedAt: new Date() },
      healthInputs: {},
      startedAt: new Date(),
    });
    await this.governor.ensureSession(sessionId);
    await this.bus.emit({ sessionId, circleId, actor: 'system', type: 'session_start', payload: { template: circle.context } });
    return doc;
  }

  async get(sessionId: string): Promise<unknown> {
    const session = await this.sessions.findOne({ _id: sessionId }).lean().exec();
    if (!session) throw Err.missing(`SESSION_NOT_FOUND:${sessionId}`);
    const credits = await this.equity.totals(sessionId);
    return { ...session, credits: credits.map((c) => ({ learnerId: c.learnerId, total: c.total })) };
  }

  async end(sessionId: string): Promise<{ endedAt: Date; health: unknown; credits: unknown; usage: unknown }> {
    const session = await this.sessions.findOne({ _id: sessionId }).exec();
    if (!session) throw Err.missing(`SESSION_NOT_FOUND:${sessionId}`);
    session.endedAt = new Date();
    await session.save();
    await this.bus.emit({ sessionId, circleId: session.circleId, actor: 'system', type: 'session_end', payload: {} });
    const health = await this.sbu.recompute(sessionId);
    const credits = await this.equity.totals(sessionId);
    const usage = await this.governor.usage(sessionId);
    return { endedAt: session.endedAt, health, credits, usage };
  }

  async credits(sessionId: string): Promise<{ credits: Array<{ learnerId: string; total: number }>; dispersion: number; dominant: unknown }> {
    const totals = await this.equity.totals(sessionId);
    return {
      credits: totals.map((t) => ({ learnerId: t.learnerId, total: t.total })),
      dispersion: await this.equity.dispersion(sessionId),
      dominant: await this.equity.dominance(sessionId),
    };
  }
}
