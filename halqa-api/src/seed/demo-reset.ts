import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AVATAR_KEYS, stableJoinCode } from '../domain/ids';
import { Circle, CircleDocument } from '../persistence/schemas/circle.schema';
import { Learner, LearnerDocument, PassportLang, Level, StyleKey } from '../persistence/schemas/learner.schema';
import { Question, QuestionDocument } from '../persistence/schemas/question.schema';
import { Session, SessionDocument } from '../persistence/schemas/session.schema';
import { PeerAnswer, PeerAnswerDocument } from '../persistence/schemas/interaction.schema';
import { TelemetryEvent, TelemetryEventDocument } from '../persistence/schemas/telemetry.schema';
import { MentorNote, MentorNoteDocument } from '../persistence/schemas/telemetry.schema';
import { Artifact, ArtifactDocument, LlmCall, LlmCallDocument, QuotaLedger, QuotaLedgerDocument } from '../persistence/schemas/ai.schema';
import type { EmitEventInput } from '../telemetry/event-bus';
import { AssetReport, finish } from './seed.types';

/**
 * Demo fixture manifest — mirrors eval/users_fixtures.json so the demo and
 * the eval suite describe the same people. Kept in code rather than read
 * from disk because the reset must work from a production build, where
 * `eval/` is not shipped.
 */
interface DemoLearner {
  nickname: string;
  lang: PassportLang;
  level: Level;
  style: StyleKey;
  context: string;
  /** The quiet one: speaks rarely, so B must still credit her. */
  quiet?: boolean;
  /** The dominant one: answers everything, so the log cap must hold him back. */
  dominant?: boolean;
}

const LEARNERS: DemoLearner[] = [
  { nickname: 'Silent-Rim', lang: 'darija', level: 'beginner', style: 'visual', context: 'study', quiet: true },
  { nickname: 'Dom-Ahmed', lang: 'fr', level: 'intermediate', style: 'steps', context: 'study', dominant: true },
  { nickname: 'Curious-Nour', lang: 'ar', level: 'novice', style: 'analogy', context: 'study' },
  { nickname: 'Bridge-Salma', lang: 'en', level: 'beginner', style: 'example', context: 'study' },
  { nickname: 'Quiet-Yassine', lang: 'fr', level: 'intermediate', style: 'practice', context: 'study', quiet: true },
];

const MENTOR = 'Mentor-Amel';
const TEACHER = 'Teacher-Leila';

/** 30 nicknames for the matcher board — deterministic, no randomness. */
const NICKNAMES_30 = Array.from({ length: 30 }, (_, i) => {
  const animal = ['Fox', 'Owl', 'Star', 'Deer'][i % 4];
  return `${animal}-${String(i + 1).padStart(2, '0')}`;
});

const HINT_EAGERNESS: Record<DemoLearner['style'], number> = {
  visual: 0.5,
  analogy: 0.6,
  steps: 0.4,
  example: 0.5,
  repetition: 0.7,
  practice: 0.45,
};

/**
 * DemoReset — plan §12 task 6.4. Builds the exact scenario the pitch video
 * and the report show: one circle with a quiet learner and a dominant one,
 * a live session whose S-B-U rings are partially filled, an anonymous
 * Darija question, a seeded misconception at verification, and a mentor
 * who has been routed to the circle.
 *
 * Deterministic: every id, join code and timestamp is derived, not random,
 * so two runs produce byte-identical documents.
 */
@Injectable()
export class DemoReset {
  private readonly logger = new Logger(DemoReset.name);

  constructor(
    @InjectModel(Learner.name) private readonly learners: Model<LearnerDocument>,
    @InjectModel(Circle.name) private readonly circles: Model<CircleDocument>,
    @InjectModel(Session.name) private readonly sessions: Model<SessionDocument>,
    @InjectModel(Question.name) private readonly questions: Model<QuestionDocument>,
    @InjectModel(PeerAnswer.name) private readonly answers: Model<PeerAnswerDocument>,
    @InjectModel(TelemetryEvent.name) private readonly events: Model<TelemetryEventDocument>,
    @InjectModel(MentorNote.name) private readonly notes: Model<MentorNoteDocument>,
    @InjectModel(Artifact.name) private readonly artifacts: Model<ArtifactDocument>,
    @InjectModel(LlmCall.name) private readonly llmCalls: Model<LlmCallDocument>,
    @InjectModel(QuotaLedger.name) private readonly ledger: Model<QuotaLedgerDocument>,
  ) {}

  /** Collections the demo owns. Wiped before writing so a reset is a reset. */
  private ownedModels(): Array<{ name: string; model: { deleteMany: (q?: object) => { exec: () => Promise<unknown> } } }> {
    return [
      { name: 'questions', model: this.questions },
      { name: 'peer_answers', model: this.answers },
      { name: 'sessions', model: this.sessions },
      { name: 'circles', model: this.circles },
      { name: 'learners', model: this.learners },
      { name: 'events', model: this.events },
      { name: 'mentor_notes', model: this.notes },
      { name: 'artifacts', model: this.artifacts },
      { name: 'llm_calls', model: this.llmCalls },
      { name: 'quota_ledger', model: this.ledger },
    ];
  }

  async run(): Promise<AssetReport> {
    const startedAt = Date.now();

    for (const { name, model } of this.ownedModels()) {
      await model.deleteMany({}).exec();
      this.logger.log(`cleared ${name}`);
    }

    const learners = await this.writeLearners();
    const { circle, session } = await this.writeCircleAndSession(learners);
    const { question, answer } = await this.writeQuestion(circle, session, learners);
    await this.writeMentor(circle, session);
    await this.writeEvents(circle, session, learners, question, answer);

    return finish('demo', startedAt, {
      sources: ['eval/users_fixtures.json (mirrored in code)'],
      written: learners.length + 1,
      rejected: 0,
      problems: [],
    });
  }

  private async writeLearners(): Promise<LearnerDocument[]> {
    const out: LearnerDocument[] = [];
    const everyone: Array<DemoLearner | { nickname: string; mentor: true } | { nickname: string; teacher: true }> = [
      ...LEARNERS,
      { nickname: MENTOR, mentor: true },
      { nickname: TEACHER, teacher: true },
    ];

    for (const [i, person] of everyone.entries()) {
      const id = `L-${String(i + 1).padStart(2, '0')}`;
      const isMentor = 'mentor' in person;
      const isTeacher = 'teacher' in person;
      const isLearner = 'lang' in person;

      const passport = isLearner
        ? {
            level: person.level,
            levelByTopic: { binary_search: person.level },
            styleWeights: {
              visual: 1 / 6,
              analogy: 1 / 6,
              steps: 1 / 6,
              example: 1 / 6,
              repetition: 1 / 6,
              practice: 1 / 6,
              ...(person.style ? { [person.style]: 0.45 } : {}),
            },
            lang: person.lang,
            hintEagerness: HINT_EAGERNESS[person.style] ?? 0.5,
            inviteMe: !person.quiet,
            explainCardVisible: true,
            completedAt: new Date('2026-01-01T00:00:00.000Z'),
          }
        : undefined;

      out.push(
        await this.learners.create({
          _id: id,
          nickname: person.nickname.slice(0, 24),
          avatarKey: AVATAR_KEYS[i % AVATAR_KEYS.length],
          context: isMentor ? 'mentor' : isTeacher ? 'teacher' : 'study',
          lastSeenAt: new Date('2026-01-01T00:00:00.000Z'),
          passport,
        }),
      );
    }
    return out;
  }

  private async writeCircleAndSession(
    learners: LearnerDocument[],
  ): Promise<{ circle: CircleDocument; session: SessionDocument }> {
    const members = learners.slice(0, LEARNERS.length);
    const mentor = learners.find((l) => l.nickname === MENTOR);
    const host = members[1]; // Dom-Ahmed creates the circle

    const circle = await this.circles.create({
      _id: 'C-3', // the recorded scenario is "circle 3"
      topic: 'binary_search',
      title: 'Binary search — the sorted condition',
      context: 'study',
      lang: 'fr',
      state: 'live',
      windowS: 45,
      hostLearnerId: host._id,
      joinCode: stableJoinCode('DEMO-CIRCLE-3'),
      members: [
        { learnerId: host._id, role: 'host', joinedAt: new Date('2026-01-01T00:10:00.000Z') },
        ...members
          .filter((m) => m._id !== host._id)
          .map((m) => ({ learnerId: m._id, role: 'peer' as const, joinedAt: new Date('2026-01-01T00:10:30.000Z') })),
        ...(mentor
          ? [{ learnerId: mentor._id, role: 'observer' as const, joinedAt: new Date('2026-01-01T00:18:00.000Z') }]
          : []),
      ],
    });

    const session = await this.sessions.create({
      _id: 'S-DEMO-1',
      circleId: circle._id,
      agenda: {
        templateId: 'study',
        steps: [
          { id: 'diagnose', kind: 'goal', plannedS: 180, done: true, completedAt: new Date('2026-01-01T00:13:00.000Z') },
          { id: 'discuss', kind: 'explain', plannedS: 480, done: true, completedAt: new Date('2026-01-01T00:21:00.000Z') },
          { id: 'do', kind: 'challenge', plannedS: 540, done: false },
          { id: 'debrief', kind: 'recap', plannedS: 300, done: false },
        ],
      },
      // Partially-lit rings: the session is in progress, not finished.
      health: { S: 0.5, B: 0.62, U: 0.71, computedAt: new Date('2026-01-01T00:21:30.000Z') },
      healthInputs: {
        agendaCompletion: 0.5,
        timeDiscipline: 0.82,
        recapDone: false,
        creditsByLearner: { 'L-01': 6.5, 'L-02': 5.1, 'L-03': 4.0, 'L-04': 3.0, 'L-05': 1.5 },
        checkSuccessRate: 0.66,
        avgHintDepth: 1.5,
        correctionsPerAnswer: 0.2,
      },
      startedAt: new Date('2026-01-01T00:10:00.000Z'),
    });

    return { circle, session };
  }

  private async writeQuestion(
    circle: CircleDocument,
    session: SessionDocument,
    learners: LearnerDocument[],
  ): Promise<{ question: QuestionDocument; answer: PeerAnswerDocument }> {
    const asker = learners[0]; // Silent-Rim asks — anonymously, in Darija
    const explainer = learners[1]; // Dom-Ahmed answers

    const question = await this.questions.create({
      _id: 'Q-DEMO-1',
      sessionId: session._id,
      circleId: circle._id,
      askerId: asker._id,
      text: 'علاش لازم الترتيب قبل البحث الثنائي؟ ما فهمتش شنو يصير كي ما يكونش مرتب.',
      lang: 'darija',
      anonymous: true,
      state: 'RESOLVED',
      windowS: 45,
      windowStartedAt: new Date('2026-01-01T00:22:00.000Z'),
      windowEndsAt: new Date('2026-01-01T00:22:45.000Z'),
      stages: [
        { stage: 'retrieving', startedAt: new Date('2026-01-01T00:22:00.000Z'), doneAt: new Date('2026-01-01T00:22:00.100Z') },
        { stage: 'checking_similar', startedAt: new Date('2026-01-01T00:22:00.100Z'), doneAt: new Date('2026-01-01T00:22:00.200Z') },
      ],
      hintState: 0,
      cites: ['bs-darija-01', 'bs-fr-01'],
      peerFirst: true,
      resolution: 'peers_verified',
      resolvedAt: new Date('2026-01-01T00:23:10.000Z'),
      answer: {
        text: 'كي يكون الجدول مرتب، كل مقارنة تنجم تقصّ النص. إذا ما كانش مرتب، ما تنجمش تعرف في أناهي شيرة تكمّل، و تنجم تفوّت الهدف.',
        cites: ['bs-darija-01', 'bs-fr-01'],
        kind: 'peer_verified',
        tierUsed: 'T0',
        cached: false,
      },
    });

    // The seeded misconception: verification flags it, so a poll is opened.
    const answer = await this.answers.create({
      _id: 'A-DEMO-1',
      questionId: question._id,
      authorId: explainer._id,
      text: 'الترتيب ما يهمش برشا، البحث الثنائي يخدم على أي مصفوفة.',
      lang: 'darija',
      creditsAwarded: 3,
      createdAt: new Date('2026-01-01T00:22:30.000Z'),
    });

    return { question, answer };
  }

  private async writeMentor(circle: CircleDocument, session: SessionDocument): Promise<void> {
    await this.notes.create({
      _id: 'N-DEMO-1',
      circleId: circle._id,
      sessionId: session._id,
      mentorId: 'L-06',
      text: 'Circle 3 is stuck on the sorted-array condition; two learners are silent. Ask Rim to restate the condition in her own words before the next halving step.',
      kind: 'note',
      createdAt: new Date('2026-01-01T00:21:00.000Z'),
    });
  }

  private async writeEvents(
    circle: CircleDocument,
    session: SessionDocument,
    learners: LearnerDocument[],
    question: QuestionDocument,
    answer: PeerAnswerDocument,
  ): Promise<void> {
    const t = (m: number) => new Date(Date.parse('2026-01-01T00:10:00.000Z') + m * 60_000);
    const seq: Array<EmitEventInput> = [
      { sessionId: session._id, circleId: circle._id, actor: 'system', type: 'session_start', payload: { agenda: 'study' } },
      ...learners.slice(0, LEARNERS.length).map((l) => ({
        sessionId: session._id,
        circleId: circle._id,
        actor: l._id,
        type: 'dna_done' as const,
        payload: { lang: l.passport?.lang ?? 'fr', level: l.passport?.level ?? 'beginner' },
      })),
      { sessionId: session._id, circleId: circle._id, actor: learners[0]._id, type: 'question_open', payload: { qid: question._id, anonymous: true } },
      { sessionId: session._id, circleId: circle._id, actor: learners[1]._id, type: 'peer_answer', payload: { qid: question._id, aid: answer._id } },
      { sessionId: session._id, circleId: circle._id, actor: 'NOVA', type: 'nova_verify', payload: { qid: question._id, verdict: 'doubtful', why: 'seeded-misconception' } },
      { sessionId: session._id, circleId: circle._id, actor: learners[2]._id, type: 'me_too', payload: { qid: question._id } },
      { sessionId: session._id, circleId: circle._id, actor: learners[3]._id, type: 'poll_open', payload: { qid: question._id, claim: 'sorted-matters' } },
      { sessionId: session._id, circleId: circle._id, actor: 'mentor', type: 'mentor_note', payload: { noteId: 'N-DEMO-1' } },
    ];

    for (const [i, e] of seq.entries()) {
      // EventBus stamps "now"; write directly so the demo timeline is fixed
      // and replaying the reset cannot shift the recorded story.
      await this.events.create({ ...e, ts: t(i * 2), payload: e.payload ?? {} });
    }
  }
}
