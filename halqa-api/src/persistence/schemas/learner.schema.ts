import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type StyleKey = 'visual' | 'analogy' | 'steps' | 'example' | 'repetition' | 'practice';
export type Level = 'novice' | 'beginner' | 'intermediate' | 'advanced';
export type PassportLang = 'ar' | 'darija' | 'fr' | 'en';

@Schema({ _id: false })
export class StyleWeights {
  @Prop({ type: Number, default: 1 / 6 }) visual!: number;
  @Prop({ type: Number, default: 1 / 6 }) analogy!: number;
  @Prop({ type: Number, default: 1 / 6 }) steps!: number;
  @Prop({ type: Number, default: 1 / 6 }) example!: number;
  @Prop({ type: Number, default: 1 / 6 }) repetition!: number;
  @Prop({ type: Number, default: 1 / 6 }) practice!: number;
}

@Schema({ _id: false })
export class Passport {
  @Prop({ type: String, default: 'beginner' }) level!: Level;
  @Prop({ type: Object, default: {} }) levelByTopic!: Record<string, Level>;
  @Prop({ type: StyleWeights, default: () => ({}) }) styleWeights!: StyleWeights;
  @Prop({ type: String, default: 'fr' }) lang!: PassportLang;
  @Prop({ type: Number, min: 0, max: 1, default: 0.5 }) hintEagerness!: number;
  @Prop({ type: Boolean, default: true }) inviteMe!: boolean;
  @Prop({ type: Boolean, default: false }) explainCardVisible!: boolean;
  @Prop({ type: Date }) completedAt?: Date;
}

@Schema({ collection: 'learners', timestamps: { createdAt: true, updatedAt: false } })
export class Learner {
  @Prop({ type: String }) _id!: string; // "L-01" — assigned, never PII
  @Prop({ type: String, required: true, maxlength: 24 }) nickname!: string;
  @Prop({ type: String, required: true }) avatarKey!: string; // neutral icon key only
  @Prop({ type: String, required: true }) context!: string;
  @Prop({ type: Date }) lastSeenAt?: Date;
  @Prop({ type: Passport }) passport?: Passport;
}
// NOTE: no name/photo/gender/region/birth/age/address/phone/email fields.
// The schema gate test (test/schema-gate.spec.ts) fails the build if they appear.
export type LearnerDocument = Learner & Document<string>;
export const LearnerSchema = SchemaFactory.createForClass(Learner);
LearnerSchema.index({ lastSeenAt: -1 });
LearnerSchema.index({ 'passport.lang': 1 });
