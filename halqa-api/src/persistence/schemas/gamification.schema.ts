import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * Per-learner XP read model (plan §4.1).
 *
 * The authoritative record is `XpLedger`: an append-only line per grant, so the
 * total is always reconstructable and an audit can answer "why does this learner
 * have 240 XP". This document is the fast read path the UI polls, and it is
 * written in the same transaction as its ledger line.
 */
@Schema({ collection: 'learner_progress', _id: false })
export class LearnerProgress {
  /** Learner id (`L-…`). One row per learner. */
  @Prop({ type: String, required: true }) _id!: string;

  /** Denormalised sum of the ledger. Never written directly outside a grant. */
  @Prop({ type: Number, default: 0, min: 0 }) xp!: number;

  @Prop({ type: [String], default: [] }) badges!: string[];

  /** Consecutive active days, capped by the streak rule. */
  @Prop({ type: Number, default: 0, min: 0 }) streakDays!: number;

  /** `YYYY-MM-DD` of the last grant, used to advance or break the streak. */
  @Prop({ type: String }) lastStreakDay?: string;

  /**
   * Daily counter for the capped signals (poll_vote / me_too / scribe_note),
   * reset by comparing `day` rather than by a scheduled job.
   */
  @Prop({ type: Object, default: { day: '', n: 0 } })
  daily!: { day: string; n: number };

  @Prop({ type: Date, default: () => new Date() }) updatedAt!: Date;
}

export type LearnerProgressDocument = HydratedDocument<LearnerProgress>;
export const LearnerProgressSchema = SchemaFactory.createForClass(LearnerProgress);

/**
 * Append-only XP ledger. Indexed by learner for the audit read, and by session
 * so a debrief can show what this circle earned.
 */
@Schema({ collection: 'xp_ledger' })
export class XpEntry {
  @Prop({ type: String, required: true }) learnerId!: string;
  @Prop({ type: String, required: true }) sessionId!: string;
  @Prop({ type: String, required: true }) circleId!: string;
  /** Learning signal name from XP_TABLE — never a free-text client string. */
  @Prop({ type: String, required: true }) signal!: string;
  /** XP actually granted after the daily cap (0 is a legitimate value). */
  @Prop({ type: Number, required: true, min: 0 }) xp!: number;
  @Prop({ type: Date, default: () => new Date() }) ts!: Date;
}

export type XpEntryDocument = HydratedDocument<XpEntry>;
export const XpEntrySchema = SchemaFactory.createForClass(XpEntry);

XpEntrySchema.index({ learnerId: 1, ts: -1 });
XpEntrySchema.index({ sessionId: 1, ts: -1 });
