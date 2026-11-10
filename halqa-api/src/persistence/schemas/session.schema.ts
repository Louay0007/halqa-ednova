import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class AgendaStep {
  @Prop({ type: String, required: true }) id!: string;
  @Prop({ type: String, required: true }) kind!: 'goal' | 'explain' | 'challenge' | 'teachback' | 'recap';
  @Prop({ type: Number, default: 0 }) plannedS!: number;
  @Prop({ type: Boolean, default: false }) done!: boolean;
  @Prop({ type: Date }) completedAt?: Date;
}

@Schema({ _id: false })
export class SessionHealth {
  @Prop({ type: Number, min: 0, max: 1, default: 0 }) S!: number;
  @Prop({ type: Number, min: 0, max: 1, default: 0 }) B!: number;
  @Prop({ type: Number, min: 0, max: 1, default: 0 }) U!: number;
  @Prop({ type: Date, default: () => new Date() }) computedAt!: Date;
}

@Schema({ collection: 'sessions' })
export class Session {
  @Prop({ type: String }) _id!: string; // quota ledger key
  @Prop({ type: String, required: true }) circleId!: string;
  @Prop({ type: Object, default: { templateId: 'default', steps: [] } }) agenda!: {
    templateId: string;
    steps: AgendaStep[];
  };
  @Prop({ type: SessionHealth, default: () => ({}) }) health!: SessionHealth;
  @Prop({ type: Object, default: {} }) healthInputs!: Record<string, unknown>;
  @Prop({ type: Date, default: () => new Date() }) startedAt!: Date;
  @Prop({ type: Date }) endedAt?: Date;
}

export type SessionDocument = Session & Document<string>;
export const SessionSchema = SchemaFactory.createForClass(Session);
SessionSchema.index({ circleId: 1, startedAt: -1 });
SessionSchema.index({ 'health.U': 1 });
