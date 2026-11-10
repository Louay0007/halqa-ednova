import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class CircleMember {
  @Prop({ type: String, required: true }) learnerId!: string;
  @Prop({ type: String, required: true, default: 'peer' }) role!: 'host' | 'peer' | 'mentor' | 'observer';
  @Prop({ type: Date, default: () => new Date() }) joinedAt!: Date;
}

@Schema({ collection: 'circles', timestamps: { createdAt: true, updatedAt: true } })
export class Circle {
  @Prop({ type: String }) _id!: string; // "C-3"
  @Prop({ type: String, required: true }) topic!: string;
  @Prop({ type: String, required: true }) title!: string;
  @Prop({ type: String, required: true }) context!: string;
  @Prop({ type: String, required: true }) lang!: string;
  @Prop({ type: String, default: 'open' }) state!: 'open' | 'live' | 'wrapped';
  @Prop({ type: Number, min: 30, max: 90, default: 45 }) windowS!: number;
  @Prop({ type: String, required: true }) hostLearnerId!: string;
  @Prop({ type: [CircleMember], default: [] }) members!: CircleMember[];
  @Prop({ type: String, required: true }) joinCode!: string;
  @Prop({ type: Object }) matcherResult?: Record<string, unknown>;
}

export type CircleDocument = Circle & Document<string>;
export const CircleSchema = SchemaFactory.createForClass(Circle);
CircleSchema.index({ joinCode: 1 }, { unique: true });
CircleSchema.index({ topic: 1, state: 1 });
CircleSchema.index({ 'members.learnerId': 1 });
