import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreditAction } from '../../domain/credits.math';
import { AnalyticsEventType, TelemetryEvent } from '../../persistence/schemas/telemetry.schema';
import { Session, SessionDocument } from '../../persistence/schemas/session.schema';
import { EventBus } from '../../telemetry/event-bus';
import { EquityService } from '../equity/equity.service';
import { SbuService } from '../sbu/sbu.service';

/**
 * T0 event→credit table. Quality-weighted actions whose classification needs
 * the Group Pulse (bridging, kind_skeptic refinements, sharp-question review)
 * are upgraded in Phase 4; this table is the deterministic floor.
 */
export const EVENT_CREDITS: Partial<Record<AnalyticsEventType, { action: CreditAction; n: number }>> = {
  question_open: { action: 'sharp_question', n: 1 },
  peer_answer: { action: 'good_explanation', n: 1 },
  poll_vote: { action: 'poll_vote', n: 1 },
  me_too: { action: 'me_too', n: 1 },
  capsule_done: { action: 'scribe_note', n: 1 },
  correction: { action: 'kind_skeptic', n: 1 },
};

const LEARNER_ACTOR = /^L-\d{2,4}$/;

/**
 * Projections — every domain event recomputes affected credits + S-B-U
 * (Phase 2 task 2.7). Registered as an EventBus hook (no DI cycle).
 * Unknown sessions are materialised minimally; ops/global events are skipped.
 */
@Injectable()
export class ProjectionsService implements OnModuleInit {
  private readonly logger = new Logger(ProjectionsService.name);

  constructor(
    private readonly bus: EventBus,
    private readonly equity: EquityService,
    private readonly sbu: SbuService,
    @InjectModel(Session.name) private readonly sessions: Model<SessionDocument>,
  ) {}

  onModuleInit(): void {
    this.bus.onEvent((event) => this.project(event));
  }

  async project(event: TelemetryEvent): Promise<void> {
    const { sessionId, circleId, actor, type } = event;
    if (!sessionId || sessionId === 'ops' || sessionId === 'global') return;
    await this.ensureSessionDoc(sessionId, circleId);

    const credit = EVENT_CREDITS[type];
    if (credit && LEARNER_ACTOR.test(actor)) {
      await this.equity.award(sessionId, actor, credit.action, credit.n);
    }
    await this.sbu.recompute(sessionId);
  }

  private async ensureSessionDoc(sessionId: string, circleId: string): Promise<void> {
    await this.sessions
      .updateOne(
        { _id: sessionId },
        {
          $setOnInsert: {
            _id: sessionId,
            circleId,
            agenda: { templateId: 'default', steps: [] },
            health: { S: 0, B: 0.5, U: 0.5, computedAt: new Date() },
            healthInputs: {},
            startedAt: new Date(),
          },
        },
        { upsert: true },
      )
      .exec();
  }
}
