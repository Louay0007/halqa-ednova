import { Controller, Get, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Session, SessionDocument } from '../../persistence/schemas/session.schema';
import { Learner, LearnerDocument } from '../../persistence/schemas/learner.schema';
import { SbuService } from '../sbu/sbu.service';
import { EquityService } from '../equity/equity.service';

/**
 * DashboardController — teacher/mentor aggregation (F-DASH).
 * Aggregates ONLY: stuck concepts (low-U sessions), talk-share (credits),
 * style mix. No learner PII — nicknames stay circle-local, dashboards show
 * totals and distributions.
 */
@Controller('dashboard')
export class DashboardController {
  constructor(
    @InjectModel(Session.name) private readonly sessions: Model<SessionDocument>,
    @InjectModel(Learner.name) private readonly learners: Model<LearnerDocument>,
    private readonly sbu: SbuService,
    private readonly equity: EquityService,
  ) {}

  @Get()
  async board(@Query('circleId') circleId?: string, @Query('since') _since?: string): Promise<unknown> {
    void _since;
    const filter = circleId ? { circleId } : {};
    const docs = await this.sessions.find(filter).sort({ startedAt: -1 }).limit(20).lean().exec();
    const sessions = [];
    let styleMix: Record<string, number> = {};
    for (const s of docs) {
      const view = await this.sbu.recompute(s._id).catch(() => null);
      const credits = await this.equity.totals(s._id).catch(() => []);
      sessions.push({
        sessionId: s._id,
        circleId: s.circleId,
        health: view ? { S: view.S, B: view.B, U: view.U, needsHuman: view.needsHuman } : null,
        talkShare: credits,
        stuck: view && view.U < 0.45,
      });
    }
    const learnerDocs = await this.learners.find({}).limit(200).lean().exec();
    for (const l of learnerDocs) {
      const w = (l.passport?.styleWeights ?? {}) as Record<string, number>;
      const top = Object.entries(w).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';
      styleMix[top] = (styleMix[top] ?? 0) + 1;
    }
    return { sessions, styleMix, aggregatesOnly: true };
  }
}
