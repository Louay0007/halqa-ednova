import { Module } from '@nestjs/common';
import { SeedModule } from './seed/seed.module';
import { CoreModule } from './core/core.module';
import { HealthModule } from './health/health.module';
import { PersistenceModule } from './persistence/persistence.module';
import { SecurityModule } from './security/security.module';
import { AiPlatformModule } from './ai/ai-platform.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { LearningModule } from './modules/learning/learning.module';
import { EquityModule } from './modules/equity/equity.module';
import { SbuModule } from './modules/sbu/sbu.module';
import { ProjectionsModule } from './modules/projections/projections.module';
import { CircleModule } from './modules/circle/circle.module';
import { SessionModule } from './modules/session/session.module';
import { QuestionModule } from './modules/question/question.module';
import { PeerWindowModule } from './modules/peer-window/peer-window.module';
import { HintModule } from './modules/hints/hint.module';
import { AuditorModule } from './modules/auditor/auditor.module';
import { ConsensusModule } from './modules/consensus/consensus.module';
import { OfflineModule } from './modules/offline/offline.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { CapsuleModule } from './modules/capsule/capsule.module';
import { QuizModule } from './modules/quiz/quiz.module';
import { SoloModule } from './modules/solo/solo.module';
import { MentorModule } from './modules/mentor/mentor.module';
import { WhisperModule } from './modules/whisper/whisper.module';
import { MatcherModule } from './modules/matcher/matcher.module';
import { WorkshopModule } from './modules/workshop/workshop.module';
import { CoachModule } from './modules/coach/coach.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    CoreModule,
    PersistenceModule,
    SecurityModule,
    HealthModule,
    TelemetryModule,
    SeedModule,
    AiPlatformModule,
    KnowledgeModule,
    LearningModule,
    EquityModule,
    SbuModule,
    ProjectionsModule,
    CircleModule,
    SessionModule,
    QuestionModule,
    PeerWindowModule,
    HintModule,
    AuditorModule,
    ConsensusModule,
    OfflineModule,
    AnalyticsModule,
    CapsuleModule,
    QuizModule,
    SoloModule,
    MentorModule,
    WhisperModule,
    MatcherModule,
    WorkshopModule,
    CoachModule,
    GamificationModule,
    DashboardModule,
    AuthModule,
  ],
})
export class AppModule {}
