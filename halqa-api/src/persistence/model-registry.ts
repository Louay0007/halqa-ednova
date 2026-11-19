import type { Connection, Model } from 'mongoose';
import { Learner, LearnerSchema } from './schemas/learner.schema';
import { Circle, CircleSchema } from './schemas/circle.schema';
import { Session, SessionSchema } from './schemas/session.schema';
import { Question, QuestionSchema } from './schemas/question.schema';
import {
  Artifact,
  ArtifactSchema,
  CacheEntry,
  CacheEntrySchema,
  LlmCall,
  LlmCallSchema,
  CircleDailySpend,
  CircleDailySpendSchema,
  QuotaLedger,
  QuotaLedgerSchema,
} from './schemas/ai.schema';
import {
  HintDoc,
  HintSchema,
  PeerAnswer,
  PeerAnswerSchema,
  Poll,
  PollSchema,
  PollVote,
  PollVoteSchema,
} from './schemas/interaction.schema';
import {
  MentorNote,
  MentorNoteSchema,
  Setting,
  SettingSchema,
  TelemetryEvent,
  TelemetryEventSchema,
} from './schemas/telemetry.schema';
import {
  LearnerProgress,
  LearnerProgressSchema,
  XpEntry,
  XpEntrySchema,
} from './schemas/gamification.schema';

/**
 * The single index of every collection the app owns.
 *
 * `PersistenceModule` feeds this list to `forFeature`, and `scripts/migrate-indexes.ts`
 * feeds it to `syncIndexes`. Keeping one list means a new model cannot be added
 * to the app but forgotten by the index migration — the failure mode that leaves
 * production without an index it silently needs.
 */
export const SCHEMA_REGISTRY = [
  { name: Learner.name, schema: LearnerSchema },
  { name: Circle.name, schema: CircleSchema },
  { name: Session.name, schema: SessionSchema },
  { name: Question.name, schema: QuestionSchema },
  { name: PeerAnswer.name, schema: PeerAnswerSchema },
  { name: Poll.name, schema: PollSchema },
  { name: PollVote.name, schema: PollVoteSchema },
  { name: HintDoc.name, schema: HintSchema },
  { name: Artifact.name, schema: ArtifactSchema },
  { name: CacheEntry.name, schema: CacheEntrySchema },
  { name: QuotaLedger.name, schema: QuotaLedgerSchema },
  { name: CircleDailySpend.name, schema: CircleDailySpendSchema },
  { name: LlmCall.name, schema: LlmCallSchema },
  { name: TelemetryEvent.name, schema: TelemetryEventSchema },
  { name: MentorNote.name, schema: MentorNoteSchema },
  { name: Setting.name, schema: SettingSchema },
  { name: LearnerProgress.name, schema: LearnerProgressSchema },
  { name: XpEntry.name, schema: XpEntrySchema },
] as const;

/** Every model, resolved on an existing connection, keyed by collection name. */
export function modelsOn(connection: Connection): Record<string, Model<unknown>> {
  const out: Record<string, Model<unknown>> = {};
  for (const { name, schema } of SCHEMA_REGISTRY) {
    // `name` is the class name Mongoose uses as the key, which is what the app
    // injects with `@InjectModel(...)`.
    out[name] = (connection.models[name] ??
      connection.model(name, schema)) as Model<unknown>;
  }
  return out;
}
