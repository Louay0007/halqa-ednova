import { Err } from '../../common/http-errors';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Poll, PollDocument, PollVote, PollVoteDocument } from '../../persistence/schemas/interaction.schema';
import { Question, QuestionDocument } from '../../persistence/schemas/question.schema';
import { Session, SessionDocument } from '../../persistence/schemas/session.schema';
import { EventBus } from '../../telemetry/event-bus';

export interface PollTally {
  tally: Record<string, number>;
  total: number;
}

let pollSeq = 0;

/**
 * ConsensusModule — polls with idempotent votes (F-AUD poll-first, F-V2-1).
 * One row per (poll, voter): first choice sticks ($setOnInsert), so repeats
 * are idempotent and vote-changing is impossible in Phase 1.
 */
@Injectable()
export class ConsensusService {
  private readonly logger = new Logger(ConsensusService.name);

  constructor(
    @InjectModel(Poll.name) private readonly polls: Model<PollDocument>,
    @InjectModel(PollVote.name) private readonly votes: Model<PollVoteDocument>,
    @InjectModel(Question.name) private readonly questions: Model<QuestionDocument>,
    @InjectModel(Session.name) private readonly sessions: Model<SessionDocument>,
    private readonly bus: EventBus,
  ) {}

  private async circleOf(sessionId: string): Promise<string> {
    const s = await this.sessions.findOne({ _id: sessionId }).lean().exec();
    return s?.circleId ?? 'unknown';
  }

  async create(input: {
    sessionId: string;
    circleId: string;
    questionId?: string;
    claim: string;
    choices: string[];
    reason?: 'auditor_doubt' | 'seeded_error' | 'teaching';
  }): Promise<PollDocument> {
    pollSeq += 1;
    const doc = await this.polls.create({
      _id: `P-${Date.now().toString(36)}${(pollSeq % 1296).toString(36).padStart(2, '0')}`,
      sessionId: input.sessionId,
      questionId: input.questionId,
      claim: input.claim,
      choices: input.choices,
      state: 'open',
      reason: input.reason ?? 'teaching',
      createdAt: new Date(),
    });
    await this.bus.emit({
      sessionId: input.sessionId,
      circleId: input.circleId,
      actor: 'NOVA',
      type: 'poll_open',
      payload: { pid: doc._id, qid: input.questionId, claim: input.claim },
    });
    return doc;
  }

  /** Idempotent vote: repeats return the same tally; first choice sticks. */
  async vote(pollId: string, learnerId: string, choice: string): Promise<PollTally> {
    const poll = await this.polls.findOne({ _id: pollId }).lean().exec();
    if (!poll) throw Err.missing(`POLL_NOT_FOUND:${pollId}`);
    if (poll.state !== 'open') throw Err.conflict(`POLL_CLOSED:${pollId}`);
    if (!poll.choices.includes(choice)) throw Err.bad(`POLL_BAD_CHOICE:${choice}`);
    await this.votes
      .updateOne(
        { _id: `${pollId}:${learnerId}` },
        { $setOnInsert: { _id: `${pollId}:${learnerId}`, pollId, learnerId, choice, createdAt: new Date() } },
        { upsert: true },
      )
      .exec();
    await this.bus.emit({
      sessionId: poll.sessionId,
      circleId: await this.circleOf(poll.sessionId),
      actor: learnerId,
      type: 'poll_vote',
      payload: { pid: pollId, choice },
    });
    return this.tally(pollId, poll.choices);
  }

  async tally(pollId: string, choices?: string[]): Promise<PollTally> {
    const poll = choices ? { choices } : await this.polls.findOne({ _id: pollId }).lean().exec();
    if (!poll) throw Err.missing(`POLL_NOT_FOUND:${pollId}`);
    const tally: Record<string, number> = {};
    for (const c of poll.choices) tally[c] = 0;
    const rows = await this.votes.find({ pollId }).lean().exec();
    for (const r of rows) tally[r.choice] = (tally[r.choice] ?? 0) + 1;
    return { tally, total: rows.length };
  }

  async close(pollId: string): Promise<{ tally: Record<string, number>; winner: string }> {
    const poll = await this.polls.findOne({ _id: pollId }).exec();
    if (!poll) throw Err.missing(`POLL_NOT_FOUND:${pollId}`);
    const { tally } = await this.tally(pollId, poll.choices);
    const winner = poll.choices.reduce((a, b) => (tally[b] > tally[a] ? b : a));
    poll.state = 'closed';
    poll.result = { tally, winner, closedAt: new Date() };
    await poll.save();
    await this.bus.emit({
      sessionId: poll.sessionId,
      circleId: await this.circleOf(poll.sessionId),
      actor: 'NOVA',
      type: 'poll_close',
      payload: { pid: pollId, winner },
    });
    return { tally, winner };
  }

  async get(pollId: string): Promise<PollDocument> {
    const poll = await this.polls.findOne({ _id: pollId }).exec();
    if (!poll) throw Err.missing(`POLL_NOT_FOUND:${pollId}`);
    return poll;
  }

  /** Resolve session/circle scope from an explicit session or a linked question. */
  async resolveContext(input: { sessionId?: string; questionId?: string }): Promise<{ sessionId: string; circleId: string }> {
    if (input.questionId) {
      const q = await this.questions.findOne({ _id: input.questionId }).lean().exec();
      if (!q) throw Err.missing(`QUESTION_NOT_FOUND:${input.questionId}`);
      return { sessionId: q.sessionId, circleId: q.circleId };
    }
    if (!input.sessionId) throw Err.bad('POLL_NEEDS_SESSION_OR_QUESTION');
    return { sessionId: input.sessionId, circleId: await this.circleOf(input.sessionId) };
  }
}
