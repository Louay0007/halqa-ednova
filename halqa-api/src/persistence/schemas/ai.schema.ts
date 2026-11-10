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
}
export type QuotaLedgerDocument = QuotaLedger & Document<string>;
export const QuotaLedgerSchema = SchemaFactory.createForClass(QuotaLedger);

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
LlmCallSchema.index({ step: 1, ts: -1 });
LlmCallSchema.index({ tier: 1, ts: -1 });
LlmCallSchema.index({ sessionId: 1 });
