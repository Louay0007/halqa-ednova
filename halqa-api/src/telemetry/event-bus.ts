import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AnalyticsEventType, TelemetryEvent } from '../persistence/schemas/telemetry.schema';

export interface EmitEventInput {
  sessionId: string;
  circleId: string;
  actor: string; // L-## | NOVA | mentor | system
  type: AnalyticsEventType;
  payload?: Record<string, unknown>;
}

@Injectable()
export class EventBus {
  private readonly hooks: Array<(event: TelemetryEvent) => Promise<void> | void> = [];

  constructor(@InjectModel(TelemetryEvent.name) private readonly model: Model<TelemetryEvent>) {}

  /** Projection modules register here (avoids a DI cycle with the bus). */
  onEvent(hook: (event: TelemetryEvent) => Promise<void> | void): void {
    this.hooks.push(hook);
  }

  async emit(input: EmitEventInput): Promise<TelemetryEvent> {
    const doc = await new this.model({
      ts: new Date(),
      sessionId: input.sessionId,
      circleId: input.circleId,
      actor: input.actor,
      type: input.type,
      payload: input.payload ?? {},
    }).save();
    for (const hook of this.hooks) {
      try {
        await hook(doc);
      } catch (e) {
        // Projections must never break the emit path.
        // eslint-disable-next-line no-console
        console.warn(`[event-bus] projection hook failed: ${(e as Error).message}`);
      }
    }
    return doc;
  }

  async listBySession(sessionId: string, limit = 200): Promise<TelemetryEvent[]> {
    return this.model.find({ sessionId }).sort({ ts: 1 }).limit(limit).lean().exec();
  }

  async countByType(sessionId: string, type: AnalyticsEventType): Promise<number> {
    return this.model.countDocuments({ sessionId, type }).exec();
  }
}
