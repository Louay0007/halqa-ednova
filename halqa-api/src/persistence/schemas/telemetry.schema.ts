import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// Analytics taxonomy — mirrors blueprint §2.11 verbatim. Emitting an
// unknown type must be a TYPE error so the taxonomy cannot silently drift.
export const ANALYTICS_EVENTS = [
  'session_start',
  'session_end',
  'dna_done',
  'question_open',
  'peer_answer',
  'nova_verify',
  'hint_L1',
  'hint_L2',
  'hint_L3',
  'hint_L4',
  'skip',
  'poll_open',
  'poll_vote',
  'poll_close',
  'confusion_flag',
  'correction',
  'quiz_answer',
  'capsule_done',
  'whisper_run',
  'drift_found',
  'mentor_note',
  'mentor_brief',
  'cache_hit',
  'quota_event',
  'fallback_state',
  'lang_switch',
  'me_too',
  'explain_card_view',
  'coach_nudge',
  'coverage_check',
  'boss_battle_start',
  'boss_battle_answer',
  'solo_turn',
  'invite_sent',
  'xp_award',
] as const;
export type AnalyticsEventType = (typeof ANALYTICS_EVENTS)[number];

export const ACTORS = ['NOVA', 'mentor', 'system'] as const; // + `L-##` learner ids at runtime

@Schema({ collection: 'events' })
export class TelemetryEvent {
  @Prop({ type: Date, default: () => new Date() }) ts!: Date;
  @Prop({ type: String, required: true }) sessionId!: string;
  @Prop({ type: String, required: true }) circleId!: string;
  @Prop({ type: String, required: true }) actor!: string; // L-## | NOVA | mentor | system
  @Prop({ type: String, required: true }) type!: AnalyticsEventType;
  @Prop({ type: Object, default: {} }) payload!: Record<string, unknown>;
}
export type TelemetryEventDocument = TelemetryEvent & Document;
export const TelemetryEventSchema = SchemaFactory.createForClass(TelemetryEvent);
TelemetryEventSchema.index({ sessionId: 1, ts: 1 });
TelemetryEventSchema.index({ circleId: 1, ts: -1 });
TelemetryEventSchema.index({ type: 1, ts: -1 });

@Schema({ collection: 'mentor_notes' })
export class MentorNote {
  @Prop({ type: String }) _id!: string;
  @Prop({ type: String, required: true }) circleId!: string;
  @Prop({ type: String }) sessionId?: string;
  @Prop({ type: String, required: true }) mentorId!: string;
  @Prop({ type: String, required: true }) text!: string;
  @Prop({ type: String, default: 'note' }) kind!: 'note' | 'prompt';
  @Prop({ type: Date, default: () => new Date() }) createdAt!: Date;
}
export type MentorNoteDocument = MentorNote & Document<string>;
export const MentorNoteSchema = SchemaFactory.createForClass(MentorNote);
MentorNoteSchema.index({ circleId: 1, createdAt: -1 });

@Schema({ collection: 'settings' })
export class Setting {
  @Prop({ type: String }) _id!: string; // 'chaos' | 'config'
  @Prop({ type: Object, required: true }) value!: Record<string, unknown>;
  @Prop({ type: String }) forcedBy?: string;
  @Prop({ type: Date, default: () => new Date() }) updatedAt!: Date;
}
export type SettingDocument = Setting & Document<string>;
export const SettingSchema = SchemaFactory.createForClass(Setting);
