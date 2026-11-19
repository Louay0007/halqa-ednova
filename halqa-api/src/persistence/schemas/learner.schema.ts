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
  /** Bumped on sign-out; tokens carrying an older epoch are rejected. */
  @Prop({ type: Number, default: 0 }) tokenEpoch!: number;

  /**
   * Account credential. A learner without one entered anonymously and can only
   * be resumed through the token on this device; setting a credential is what
   * turns the record into an account other devices can sign in to.
   * `handle` is a chosen pseudonym, never a real-world identifier.
   */
  @Prop({ type: String, lowercase: true, trim: true }) handle?: string;
  @Prop({ type: String, select: false }) secretSalt?: string;
  @Prop({ type: String, select: false }) secretHash?: string;

  /**
   * Erasure lifecycle (§3.10). `deletedAt` is set the moment the learner asks and
   * bumps the token epoch, so access stops immediately while the data waits out
   * the grace window. `purgeAfter` is the deadline the purge job queries.
   * `purgedAt` marks a tombstone: the row survives so the XP ledger and telemetry
   * keep a valid reference, but every field describing a person is gone.
   */
  @Prop({ type: Date }) deletedAt?: Date;
  @Prop({ type: Date }) purgeAfter?: Date;
  @Prop({ type: Date }) purgedAt?: Date;
}
// NOTE: no name/photo/gender/region/birth/age/address/phone/email fields.
// The schema gate test (test/schema-gate.spec.ts) fails the build if they appear.
export type LearnerDocument = Learner & Document<string>;
export const LearnerSchema = SchemaFactory.createForClass(Learner);
LearnerSchema.index({ lastSeenAt: -1 });
LearnerSchema.index({ 'passport.lang': 1 });
// Anonymous learners carry no handle; a partial index keeps those untouched while
// making "one account per handle" a database-enforced invariant.
LearnerSchema.index({ handle: 1 }, { unique: true, partialFilterExpression: { handle: { $type: 'string' } } });
// The purge job asks "who is due?" once a day; a partial index keeps that a lookup
// rather than a collection scan, and stays tiny because almost nobody is deleted.
LearnerSchema.index({ purgeAfter: 1 }, { partialFilterExpression: { purgeAfter: { $type: 'date' } } });
