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
  /**
   * Denormalised from the circle at creation. The capsule needs a language and
   * used to hardcode English (§5.2), so it reads this instead of inferring.
   */
  @Prop({ type: String, enum: ['en', 'fr', 'ar', 'darija'], default: 'en' }) lang!: string;
  /** Solo sessions: the learner's chosen hat. Explicitly chosen, so it must be
   *  stored rather than derived from turn index (§4.4). */
  @Prop({ type: String }) soloHat?: string;
  /** Solo sessions: turn counter. Derivable from `solo_turn` events, but stored
   *  to avoid a count query on every turn. */
  @Prop({ type: Number, default: 0 }) soloTurn?: number;
  @Prop({ type: Date, default: () => new Date() }) startedAt!: Date;
  @Prop({ type: Date }) endedAt?: Date;
}

export type SessionDocument = Session & Document<string>;
export const SessionSchema = SchemaFactory.createForClass(Session);
SessionSchema.index({ circleId: 1, startedAt: -1 });
SessionSchema.index({ 'health.U': 1 });
