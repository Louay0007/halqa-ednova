import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'peer_answers' })
export class PeerAnswer {
  @Prop({ type: String }) _id!: string;
  @Prop({ type: String, required: true }) questionId!: string;
  @Prop({ type: String, required: true }) authorId!: string;
  @Prop({ type: String, required: true }) text!: string;
  @Prop({ type: String, required: true }) lang!: string;
  @Prop({ type: Number, default: 0 }) creditsAwarded!: number;
  @Prop({ type: Date, default: () => new Date() }) createdAt!: Date;
}
export type PeerAnswerDocument = PeerAnswer & Document<string>;
export const PeerAnswerSchema = SchemaFactory.createForClass(PeerAnswer);
PeerAnswerSchema.index({ questionId: 1, createdAt: 1 });

@Schema({ collection: 'polls' })
export class Poll {
  @Prop({ type: String }) _id!: string;
  @Prop({ type: String, required: true }) sessionId!: string;
  @Prop({ type: String }) questionId?: string;
  @Prop({ type: String, required: true }) claim!: string;
  @Prop({ type: [String], default: [] }) choices!: string[];
  @Prop({ type: String, default: 'open' }) state!: 'open' | 'closed';
  @Prop({ type: Object }) result?: Record<string, unknown>;
  @Prop({ type: String }) reason?: 'auditor_doubt' | 'seeded_error' | 'teaching';
  @Prop({ type: Date, default: () => new Date() }) createdAt!: Date;
}
export type PollDocument = Poll & Document<string>;
export const PollSchema = SchemaFactory.createForClass(Poll);
PollSchema.index({ sessionId: 1, state: 1 });

@Schema({ collection: 'poll_votes' })
export class PollVote {
  @Prop({ type: String }) _id!: string; // `${pollId}:${learnerId}` — natural idempotency key
  @Prop({ type: String, required: true }) pollId!: string;
  @Prop({ type: String, required: true }) learnerId!: string;
  @Prop({ type: String, required: true }) choice!: string;
  @Prop({ type: Date, default: () => new Date() }) createdAt!: Date;
}
export type PollVoteDocument = PollVote & Document<string>;
export const PollVoteSchema = SchemaFactory.createForClass(PollVote);
PollVoteSchema.index({ pollId: 1 });

@Schema({ collection: 'hints' })
export class HintDoc {
  @Prop({ type: String }) _id!: string; // `${questionId}:${level}`
  @Prop({ type: String, required: true }) questionId!: string;
  @Prop({ type: Number, required: true, min: 1, max: 4 }) level!: number;
  @Prop({ type: String, required: true }) text!: string;
  @Prop({ type: [String], default: [] }) cites!: string[];
  @Prop({ type: Date, default: () => new Date() }) createdAt!: Date;
}
export type HintDocument = HintDoc & Document<string>;
export const HintSchema = SchemaFactory.createForClass(HintDoc);
HintSchema.index({ questionId: 1 });
