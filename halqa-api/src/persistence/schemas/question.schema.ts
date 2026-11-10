import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class PipelineStage {
  @Prop({ type: String, required: true }) stage!: string; // retrieving|checking_similar|writing|verifying
  @Prop({ type: Date }) startedAt?: Date;
  @Prop({ type: Date }) doneAt?: Date;
}

@Schema({ collection: 'questions' })
export class Question {
  @Prop({ type: String }) _id!: string;
  @Prop({ type: String, required: true }) sessionId!: string;
  @Prop({ type: String, required: true }) circleId!: string;
  @Prop({ type: String, required: true }) askerId!: string; // hidden from circle when anonymous
  @Prop({ type: String, required: true }) text!: string; // PII-screened at write
  @Prop({ type: String, required: true }) lang!: string;
  @Prop({ type: Boolean, default: false }) anonymous!: boolean;
  @Prop({ type: String, default: 'OPEN' }) state!: 'OPEN' | 'NOVA_THINKING' | 'RESOLVED' | 'CLOSED_UNANSWERED';
  @Prop({ type: Number, default: 45 }) windowS!: number;
  @Prop({ type: Date }) windowStartedAt?: Date;
  @Prop({ type: Date }) windowEndsAt?: Date; // expiry worker index
  @Prop({ type: [PipelineStage], default: [] }) stages!: PipelineStage[];
  @Prop({ type: Number, min: 0, max: 4, default: 0 }) hintState!: number;
  @Prop({ type: Object }) quickTake?: Record<string, unknown>; // prepared silently
  @Prop({ type: Object }) deepDive?: Record<string, unknown>;
  @Prop({ type: [String], default: [] }) cites!: string[];
  @Prop({ type: Boolean, default: false }) escalated!: boolean;
  @Prop({ type: String }) resolution?: 'peers_verified' | 'hint_path' | 'skip_direct' | 'poll';
  @Prop({ type: Date }) resolvedAt?: Date;
  @Prop({ type: Object }) answer?: {
    text: string;
    cites: string[];
    kind: 'peer_verified' | 'hint_L1' | 'quick_take' | 'deep_dive' | 'unavailable';
    tierUsed?: 'C' | 'L' | 'T0';
    cached?: boolean;
    truncated?: boolean;
  };
  @Prop({ type: Boolean, default: false }) skipPressed!: boolean; // T0 leak-gate input for hint L4
  @Prop({ type: Boolean, default: false }) peerFirst!: boolean; // peer-first rate metric
  @Prop({ type: String }) pollId?: string;
  @Prop({ type: Date, default: () => new Date() }) createdAt!: Date;
}

export type QuestionDocument = Question & Document<string>;
export const QuestionSchema = SchemaFactory.createForClass(Question);
QuestionSchema.index({ sessionId: 1, state: 1, createdAt: -1 }); // the poller
QuestionSchema.index({ askerId: 1, createdAt: -1 });
QuestionSchema.index({ windowEndsAt: 1 }); // expiry worker
