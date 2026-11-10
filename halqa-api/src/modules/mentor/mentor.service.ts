import { Err } from '../../common/http-errors';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import { LLM_PORT, LlmPort } from '../../domain/ports/llm-port';
import { BudgetGovernor } from '../../ai/governor/budget.governor';
import { Circle, CircleDocument } from '../../persistence/schemas/circle.schema';
import { MentorNote, MentorNoteDocument } from '../../persistence/schemas/telemetry.schema';
import { Artifact, ArtifactDocument } from '../../persistence/schemas/ai.schema';
import { EventBus } from '../../telemetry/event-bus';
import { SbuService } from '../sbu/sbu.service';

/**
 * MentorService — Mentor Seat (F-V2-7). Observer join (no credits, no turns),
 * gentle Mentor Notes, ≤60-word Mentor Briefs (1×C, on demand or needs_human).
 * Mentors never auto-answer — humans decide.
 */
@Injectable()
export class MentorService {
  private readonly logger = new Logger(MentorService.name);

  constructor(
    @InjectModel(Circle.name) private readonly circles: Model<CircleDocument>,
    @InjectModel(MentorNote.name) private readonly notes: Model<MentorNoteDocument>,
    @InjectModel(Artifact.name) private readonly artifacts: Model<ArtifactDocument>,
    private readonly sbu: SbuService,
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly governor: BudgetGovernor,
    private readonly bus: EventBus,
  ) {}

  async join(circleId: string, mentorId: string): Promise<{ ok: boolean; role: string }> {
    const circle = await this.circles.findOne({ _id: circleId }).exec();
    if (!circle) throw Err.missing(`CIRCLE_NOT_FOUND:${circleId}`);
    if (!circle.members.some((m) => m.learnerId === mentorId)) {
      circle.members.push({ learnerId: mentorId, role: 'observer', joinedAt: new Date() });
      await circle.save();
    }
    return { ok: true, role: 'observer' };
  }

  async note(circleId: string, mentorId: string, text: string, sessionId?: string): Promise<{ noteId: string }> {
    const clean = text.slice(0, 500);
    if (!clean.trim()) throw Err.bad('NOTE_EMPTY');
    const doc = await this.notes.create({
      _id: `MN-${randomBytes(3).toString('hex')}`,
      circleId,
      sessionId,
      mentorId,
      text: clean,
      kind: 'note',
      createdAt: new Date(),
    });
    await this.bus.emit({ sessionId: sessionId ?? 'ops', circleId, actor: 'mentor', type: 'mentor_note', payload: { noteId: doc._id } });
    return { noteId: doc._id };
  }

  /** ≤60-word brief: stuck topic + silent learners + open misconceptions. */
  async brief(circleId: string, sessionId: string): Promise<{ brief: string; words: number }> {
    const cached = await this.artifacts.findOne({ sessionId, kind: 'mentor_brief' }).lean().exec();
    if (cached) {
      const body = cached.body as { brief: string };
      return { brief: body.brief, words: body.brief.split(/\s+/).length };
    }
    let brief = `Circle ${circleId}: check the latest S-B-U health and invite quiet learners to vote.`;
    try {
      const view = await this.sbu.recompute(sessionId);
      const facts = `S=${view.S.toFixed(2)} B=${view.B.toFixed(2)} U=${view.U.toFixed(2)} needsHuman=${view.needsHuman}`;
      if (await this.governor.reserve('C', sessionId)) {
        try {
          const res = await this.llm.compact({
            step: 'mentor_brief',
            prompt: `Write a ≤60-word mentor brief for a study circle. Facts: ${facts}. Name the stuck area, silent learners, one gentle nudge.`,
            maxTokens: 100,
          });
          await this.governor.commit('C', sessionId);
          brief = res.text.split(/\s+/).slice(0, 60).join(' ');
        } catch {
          await this.governor.release('C', sessionId);
        }
      }
    } catch {
      // No session yet — keep the generic brief.
    }
    await this.artifacts
      .updateOne(
        { sessionId, kind: 'mentor_brief' },
        { $set: { sessionId, circleId, kind: 'mentor_brief', body: { brief }, tier: 'C', createdAt: new Date() } },
        { upsert: true },
      )
      .exec();
    await this.bus.emit({ sessionId, circleId, actor: 'system', type: 'mentor_brief', payload: { words: brief.split(/\s+/).length } });
    return { brief, words: brief.split(/\s+/).length };
  }
}
