import { Controller, Get, Param, Post } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SessionService } from './session.service';
import { LIMITS, RateLimit } from '../../security/rate-limit';
import { Roles } from '../../security/roles.decorator';
import { CurrentUser } from '../../security/current-user.decorator';
import { MembershipService } from '../../security/membership.service';
import { DegradationService } from '../../ai/degradation/degradation.service';
import { QuotaLedger, QuotaLedgerDocument } from '../../persistence/schemas/ai.schema';

@Roles('learner')
@Controller('circles/:circleId/sessions')
export class CircleSessionController {
  constructor(
    private readonly sessions: SessionService,
    private readonly members: MembershipService,
  ) {}

  @RateLimit(LIMITS.write)
  @Post()
  async start(@Param('circleId') circleId: string, @CurrentUser('sub') learnerId: string): Promise<{ sessionId: string }> {
    await this.members.assertMember(circleId, learnerId);
    const s = await this.sessions.start(circleId);
    return { sessionId: s._id };
  }
}

@Roles('learner')
@Controller('sessions')
export class SessionController {
  constructor(
    private readonly sessions: SessionService,
    private readonly members: MembershipService,
    private readonly degradation: DegradationService,
    @InjectModel(QuotaLedger.name) private readonly ledger: Model<QuotaLedgerDocument>,
  ) {}

  @Get(':id')
  async get(@Param('id') id: string, @CurrentUser('sub') learnerId: string): Promise<unknown> {
    await this.members.assertSessionMember(id, learnerId);
    return this.sessions.get(id);
  }

  @RateLimit(LIMITS.write)
  @Post(':id/end')
  async end(@Param('id') id: string, @CurrentUser('sub') learnerId: string): Promise<unknown> {
    await this.members.assertSessionMember(id, learnerId);
    return this.sessions.end(id);
  }

  @Get(':id/credits')
  async credits(@Param('id') id: string, @CurrentUser('sub') learnerId: string): Promise<unknown> {
    await this.members.assertSessionMember(id, learnerId);
    return this.sessions.credits(id);
  }

  /**
   * What the learner's own screens poll every few seconds: the degradation mode
   * behind the banner and this session's quota counters.
   *
   * They used to read `GET /metrics`, which is `@Roles('mentor','admin')` — so a
   * learner's poll was a 403 on every tick, and the banner could not leave green
   * however far the system had degraded. This is the same two fields, scoped to
   * a session the caller has already been checked against.
   */
  @Get(':id/status')
  async status(@Param('id') id: string, @CurrentUser('sub') learnerId: string): Promise<{
    degradation: string;
    quota: { cUsed: number; lUsed: number; cCap: number; lCap: number } | null;
  }> {
    await this.members.assertSessionMember(id, learnerId);
    const g = await this.ledger.findById(id).lean().exec();
    return {
      degradation: this.degradation.getMode(),
      quota: g ? { cUsed: g.cUsed, lUsed: g.lUsed, cCap: g.cCap, lCap: g.lCap } : null,
    };
  }
}
