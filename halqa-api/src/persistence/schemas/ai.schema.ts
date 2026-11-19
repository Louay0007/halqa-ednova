import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export const ARTIFACT_KINDS = ['capsule', 'drift_map', 'mentor_brief', 'boss_battle'] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

@Schema({ collection: 'artifacts' })
export class Artifact {
  @Prop({ type: String }) _id!: string;
  @Prop({ type: String, required: true }) sessionId!: string;
  @Prop({ type: String, required: true }) circleId!: string;
  @Prop({ type: String, required: true }) kind!: ArtifactKind;
  @Prop({ type: Object, required: true }) body!: Record<string, unknown>; // validated by kind schema (Phase 5)
  @Prop({ type: String }) tier?: 'C' | 'L' | 'T0';
  @Prop({ type: Date, default: () => new Date() }) createdAt!: Date;
}
export type ArtifactDocument = Artifact & Document<string>;
export const ArtifactSchema = SchemaFactory.createForClass(Artifact);
ArtifactSchema.index({ sessionId: 1, kind: 1, createdAt: -1 });

@Schema({ collection: 'cache' })
export class CacheEntry {
  @Prop({ type: String }) _id!: string; // sha1(...) — the semantic key IS the _id
  @Prop({ type: Object, required: true }) value!: Record<string, unknown>;
  @Prop({ type: [String], default: [] }) cites!: string[];
  @Prop({ type: String }) tier?: string;
  @Prop({ type: Number, default: 0 }) hits!: number;
  @Prop({ type: Date, default: () => new Date() }) createdAt!: Date;
  @Prop({ type: Date, required: true }) expiresAt!: Date; // TTL index
}
export type CacheEntryDocument = CacheEntry & Document<string>;
export const CacheEntrySchema = SchemaFactory.createForClass(CacheEntry);
CacheEntrySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

@Schema({ collection: 'quota_ledger' })
export class QuotaLedger {
  @Prop({ type: String }) _id!: string; // sessionId
  @Prop({ type: Number, default: 0 }) cUsed!: number;
  @Prop({ type: Number, default: 0 }) lUsed!: number;
  @Prop({ type: Number, default: 20 }) cCap!: number;
  @Prop({ type: Number, default: 5 }) lCap!: number;
  @Prop({ type: Number, default: 0 }) reservedC!: number;
  @Prop({ type: Number, default: 0 }) reservedL!: number;
  @Prop({ type: Date }) exhaustedAt?: Date;
  /**
   * The circle this session belongs to, recorded on first use so `release()` can
   * give the day back without every call site re-passing it.
   */
  @Prop({ type: String }) circleId?: string;
}
export type QuotaLedgerDocument = QuotaLedger & Document<string>;
export const QuotaLedgerSchema = SchemaFactory.createForClass(QuotaLedger);

/**
 * Per-circle, per-day model-call counter (§9.3).
 *
 * `_id` is `${circleId}:${YYYY-MM-DD}` rather than an ObjectId so the daily
 * increment is a single upsert on a known key and the day boundary is explicit:
 * there is no window arithmetic to get wrong and no document to roll over.
 *
 * Rows live 400 days so a term's spend is auditable afterwards; that TTL is a
 * retention decision, not a cache eviction.
 */
@Schema({ collection: 'circle_daily_spend' })
export class CircleDailySpend {
  @Prop({ type: String }) _id!: string; // `${circleId}:${day}`
  @Prop({ type: String, required: true }) circleId!: string;
  @Prop({ type: String, required: true }) day!: string; // YYYY-MM-DD (UTC)
  @Prop({ type: Number, default: 0 }) calls!: number;
  /**
   * TTL anchor. MongoDB only expires documents when the indexed field is a Date:
   * a TTL index on the `day` string would build successfully and never delete
   * anything, which is the quiet way retention silently stops working.
   */
  @Prop({ type: Date, required: true, default: () => new Date() }) createdAt!: Date;
}
export type CircleDailySpendDocument = CircleDailySpend & Document<string>;
export const CircleDailySpendSchema = SchemaFactory.createForClass(CircleDailySpend);
CircleDailySpendSchema.index({ circleId: 1, day: -1 });
CircleDailySpendSchema.index({ createdAt: 1 }, { expireAfterSeconds: 400 * 24 * 60 * 60 });

@Schema({ collection: 'llm_calls' })
export class LlmCall {
  @Prop({ type: Date, default: () => new Date() }) ts!: Date;
  @Prop({ type: String }) sessionId?: string;
  @Prop({ type: String, required: true }) step!: string;
  @Prop({ type: String, required: true }) tier!: 'C' | 'L';
  @Prop({ type: Number, default: 0 }) tokensIn!: number;
  @Prop({ type: Number, default: 0 }) tokensOut!: number;
  @Prop({ type: Number, default: 0 }) latencyMs!: number;
  @Prop({ type: Boolean, default: false }) cacheHit!: boolean;
  @Prop({ type: String, default: null }) fallbackUsed!: string | null;
  @Prop({ type: Boolean, default: true }) ok!: boolean;
  @Prop({ type: String }) errorCode?: string;
}
export type LlmCallDocument = LlmCall & Document;
export const LlmCallSchema = SchemaFactory.createForClass(LlmCall);
LlmCallSchema.index({ ts: -1 });
// Retention (§4.7): prompt metadata is kept longer than telemetry because cost
// reporting and the eval trend read from it, but not forever.
LlmCallSchema.index({ ts: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });
LlmCallSchema.index({ step: 1, ts: -1 });
LlmCallSchema.index({ tier: 1, ts: -1 });
LlmCallSchema.index({ sessionId: 1 });
