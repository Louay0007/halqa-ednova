import { Module } from '@nestjs/common';
import { InjectConnection, MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { APP_CONFIG } from '../core/config/config.module';
import { CoreModule } from '../core/core.module';
import type { AppConfig } from '../core/config/app-config';
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
import { UnitOfWork } from './unit-of-work';

@Module({
  imports: [
    CoreModule,
    MongooseModule.forRootAsync({
      imports: [CoreModule],
      inject: [APP_CONFIG],
      useFactory: (cfg: AppConfig) => ({
        uri: cfg.MONGODB_URI,
        retryWrites: true,
        serverSelectionTimeoutMS: 5000,
      }),
    }),
    MongooseModule.forFeature([
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
      { name: LlmCall.name, schema: LlmCallSchema },
      { name: TelemetryEvent.name, schema: TelemetryEventSchema },
      { name: MentorNote.name, schema: MentorNoteSchema },
      { name: Setting.name, schema: SettingSchema },
    ]),
  ],
  providers: [
    UnitOfWork,
    {
      provide: 'MONGO_READY',
      inject: [getConnectionToken()],
      useFactory: async (conn: Connection) => {
        await conn.asPromise();
        return conn.readyState === 1;
      },
    },
  ],
  exports: [MongooseModule, UnitOfWork],
})
export class PersistenceModule {
  constructor(@InjectConnection() _conn: Connection) {
    void _conn;
  }
}
