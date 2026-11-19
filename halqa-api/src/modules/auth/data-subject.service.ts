import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Err } from '../../common/http-errors';
import { TokenEpochService } from '../../security/token-epoch.service';
import { Learner, LearnerDocument } from '../../persistence/schemas/learner.schema';
import { Circle, CircleDocument } from '../../persistence/schemas/circle.schema';
import { Session, SessionDocument } from '../../persistence/schemas/session.schema';
import { Question, QuestionDocument } from '../../persistence/schemas/question.schema';
import { PeerAnswer, PollVote } from '../../persistence/schemas/interaction.schema';
import {
  LearnerProgress,
  LearnerProgressDocument,
  XpEntry,
  XpEntryDocument,
} from '../../persistence/schemas/gamification.schema';
import { TelemetryEvent } from '../../persistence/schemas/telemetry.schema';

/** Grace period between a learner asking to be forgotten and the data going. */
export const DELETE_GRACE_DAYS = 30;

/**
 * Data-subject export and erasure (§3.10, §8.2).
 *
 * Two deliberate design choices:
 *
 * 1. **Export is a copy of what the learner made, not a dump of the database.**
 *    It includes their own questions, answers, votes and progress, plus a note of
 *    what is *not* stored about them. It excludes other learners' content, even
 *    inside the same circle — an export is not a way to read a neighbour's data.
 * 2. **Deletion is soft first.** A learner who taps delete is having a bad day far
 *    more often than they are exercising a right, so the record is marked and the
 *    purge waits out `DELETE_GRACE_DAYS`. Purge tombstones the id (keeps the row,
 *    blanks the fields) rather than removing it, because XP ledger and telemetry
 *    rows reference it: deleting the row outright would leave dangling references
 *    and silently change historical aggregates.
 */
@Injectable()
export class DataSubjectService {
  constructor(
    @InjectModel(Learner.name) private readonly learners: Model<LearnerDocument>,
    @InjectModel(Circle.name) private readonly circles: Model<CircleDocument>,
    @InjectModel(Session.name) private readonly sessions: Model<SessionDocument>,
    @InjectModel(Question.name) private readonly questions: Model<QuestionDocument>,
    @InjectModel(PeerAnswer.name) private readonly answers: Model<unknown>,
    @InjectModel(PollVote.name) private readonly votes: Model<unknown>,
    @InjectModel(LearnerProgress.name) private readonly progress: Model<LearnerProgressDocument>,
    @InjectModel(XpEntry.name) private readonly ledger: Model<XpEntryDocument>,
    @InjectModel(TelemetryEvent.name) private readonly events: Model<unknown>,
    // Deletion must revoke access now, and the epoch is cached for 15 s. Bumping
    // the field directly would leave a stale cache serving deleted tokens until it
    // expired, so the revocation goes through the service that owns the cache.
    private readonly epochs: TokenEpochService,
  ) {}

  /**
   * Everything stored about this learner, in one JSON document.
   *
   * `NOT_STORED` is part of the payload rather than only the privacy page: an
   * export that lists what exists but not what was deliberately never collected
   * leaves the reader unable to tell the difference between "absent" and "we
   * deleted it".
   */
  async export(learnerId: string): Promise<unknown> {
    const learner = await this.learners.findOne({ _id: learnerId }).lean().exec();
    if (!learner) throw Err.missing(`LEARNER_NOT_FOUND:${learnerId}`);

    // `select: false` keeps the credential off every normal read; an export has to
    // include it to be complete, but only as a salted hash — never the passphrase.
    const credential = await this.learners
      .findOne({ _id: learnerId })
      .select('handle secretSalt secretHash')
      .lean()
      .exec();

    const [progress, ledger, questions, answers, votes, events, memberships] = await Promise.all([
      this.progress.findOne({ learnerId }).lean().exec(),
      this.ledger.find({ learnerId }).sort({ ts: 1 }).lean().exec(),
      this.questions.find({ askerId: learnerId }).select('text createdAt state').lean().exec(),
      this.answers.find({ authorId: learnerId }).select('text createdAt').lean().exec(),
      this.votes.find({ learnerId }).select('pollId createdAt').lean().exec(),
      // Telemetry is keyed by actor, which is the learner id for learner actions.
      this.events.find({ actor: learnerId }).sort({ ts: 1 }).lean().exec(),
      this.circles.find({ 'members.learnerId': learnerId }).select('topic createdAt members').lean().exec(),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      formatVersion: 1,
      learner: {
        id: learner._id,
        nickname: learner.nickname,
        avatarKey: learner.avatarKey,
        context: learner.context,
        createdAt: (learner as unknown as { createdAt?: Date }).createdAt,
        lastSeenAt: learner.lastSeenAt,
        handle: credential?.handle ?? null,
        // A hash, not the passphrase: exporting a reusable secret would create a
        // new leak in the name of transparency.
        credentialHash: credential?.secretHash ?? null,
        credentialSalt: credential?.secretSalt ?? null,
      },
      passport: learner.passport ?? null,
      progress: progress ?? null,
      xpLedger: ledger,
      questions: questions.map((q) => ({ text: q.text, state: q.state, createdAt: (q as unknown as { createdAt?: Date }).createdAt })),
      peerAnswers: answers,
      pollVotes: votes,
      telemetry: events,
      circles: memberships.map((c) => ({
        circleId: c._id,
        topic: c.topic,
        // The learner's own join time, not the circle's creation time: two members
        // of the same circle joined at different points and each should see theirs.
        role: c.members.find((m) => m.learnerId === learnerId)?.role,
        joinedAt: c.members.find((m) => m.learnerId === learnerId)?.joinedAt,
      })),
      notStored: [
        'real name',
        'email or phone',
        'photo or avatar image (only a neutral icon key)',
        'gender, age or birth date',
        'country, region or GPS location',
        'institution or class roster',
        'any free text you did not type into an answer, question or note',
      ],
      modelCalls: {
        note: 'Model calls store metadata only (step, tier, token counts, latency, cache hit, fallback). No prompt or learner text is retained with them.',
      },
    };
  }

  /**
   * Mark the record for deletion and sign it out everywhere immediately.
   *
   * The epoch bump is the part that has to happen now: the grace period is about
   * data, not access, so a deleted account must stop working the moment the
   * learner asks.
   */
  async requestDeletion(learnerId: string): Promise<{ ok: true; purgeAfter: string }> {
    const purgeAfter = new Date(Date.now() + DELETE_GRACE_DAYS * 86_400_000);
    const doc = await this.learners
      .findOneAndUpdate(
        { _id: learnerId, deletedAt: { $exists: false } } as never,
        { $set: { deletedAt: new Date(), purgeAfter } },
        { new: true },
      )
      .select('_id')
      .lean()
      .exec();
    if (!doc) {
      // Either the learner does not exist or deletion was already requested; both
      // are "nothing more to do", but an unknown id should not look successful.
      const exists = await this.learners.exists({ _id: learnerId }).exec();
      if (!exists) throw Err.missing(`LEARNER_NOT_FOUND:${learnerId}`);
    }
    // Immediately, not on the next cache expiry: asking to be forgotten has to
    // stop the session on this device too.
    await this.epochs.bump(learnerId);
    return { ok: true, purgeAfter: purgeAfter.toISOString() };
  }

  /** Undo inside the grace window. */
  async cancelDeletion(learnerId: string): Promise<{ ok: true }> {
    const res = await this.learners
      .updateOne({ _id: learnerId } as never, { $unset: { deletedAt: '', purgeAfter: '' } })
      .exec();
    if (res.matchedCount === 0) throw Err.missing(`LEARNER_NOT_FOUND:${learnerId}`);
    return { ok: true };
  }

  /**
   * Erase the personal fields of every record whose grace period has elapsed.
   *
   * Tombstones rather than deletes: the `_id` survives so `xp_ledger` and
   * telemetry keep referring to something, and historical aggregates stay
   * arithmetically correct. What goes is everything that describes a person —
   * nickname, avatar, passport, credential, and the free text they wrote.
   */
  async purgeDue(now = new Date()): Promise<{ purged: number }> {
    const due = await this.learners
      .find({ purgeAfter: { $lte: now } })
      .select('_id')
      .lean()
      .exec();
    if (due.length === 0) return { purged: 0 };

    const ids = due.map((d) => d._id);
    for (const id of ids) {
      const tombstone = `deleted-${id}`;
      await Promise.all([
        this.learners
          .updateOne(
            { _id: id } as never,
            {
              $set: {
                nickname: 'Deleted learner',
                avatarKey: 'owl',
                // Keep the handle slot released so the pseudonym can be reused.
                passport: undefined,
                purgedAt: now,
              },
              $unset: { handle: '', secretSalt: '', secretHash: '', passport: '', deletedAt: '', purgeAfter: '' },
            } as never,
          )
          .exec(),
        // Free text is the actual personal content; the structural rows (votes,
        // credits) stay so aggregates do not shift under the teacher's feet.
        this.questions.updateMany({ askerId: id } as never, { $set: { text: '[deleted]' } } as never).exec(),
        this.answers.updateMany({ authorId: id } as never, { $set: { text: '[deleted]' } } as never).exec(),
        this.events.updateMany({ actor: id } as never, { $set: { actor: tombstone } } as never).exec(),
      ]);
    }
    return { purged: ids.length };
  }
}
