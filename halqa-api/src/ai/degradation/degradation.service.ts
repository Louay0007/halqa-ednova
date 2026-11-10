import { Injectable, Logger } from '@nestjs/common';
import { EventBus } from '../../telemetry/event-bus';

export type DegradationMode = 'green' | 'orange' | 'red' | 'black';

/**
 * Degradation state machine (plan §6.7). Single source of truth for the mode —
 * the SecurityModule ChaosController delegates here (dev-only forcing).
 *
 *  GREEN  normal
 *  ORANGE L slow/unavailable → L queued + ETA, C continues
 *  RED    quota exhausted     → C-only + simplified labels
 *  BLACK  service down        → offline pack + polls/roles/flashcards, sync later
 * Every transition = banner event (fallback_state) + metrics counter.
 */
@Injectable()
export class DegradationService {
  private readonly logger = new Logger(DegradationService.name);
  private forced: DegradationMode | null = null;
  private derived: DegradationMode = 'green';

  getMode(): DegradationMode {
    return this.forced ?? this.derived;
  }

  /** Dev-only forcing (gated by CHAOS_ENABLED at the controller). */
  force(mode: DegradationMode): DegradationMode {
    this.forced = mode;
    this.logger.log(`degradation forced → ${mode}`);
    return this.getMode();
  }

  clearForce(): DegradationMode {
    this.forced = null;
    return this.getMode();
  }

  /** Derive the mode from live health signals (provider + quota). */
  async evaluate(args: {
    bus: EventBus;
    sessionId: string;
    circleId: string;
    lAvailable: boolean;
    quotaExhausted: boolean;
    serviceDown: boolean;
  }): Promise<DegradationMode> {
    const next: DegradationMode = args.serviceDown
      ? 'black'
      : args.quotaExhausted
        ? 'red'
        : args.lAvailable
          ? 'green'
          : 'orange';
    const prev = this.derived;
    this.derived = next;
    if (prev !== next) {
      await args.bus.emit({
        sessionId: args.sessionId,
        circleId: args.circleId,
        actor: 'system',
        type: 'fallback_state',
        payload: { from: prev, to: next },
      });
      this.logger.log(`degradation ${prev} → ${next} (session=${args.sessionId})`);
    }
    return this.getMode();
  }

  /** Convenience: walk orange→red→black emitting events (video rehearsal). */
  async replay(bus: EventBus, sessionId: string, circleId: string): Promise<DegradationMode[]> {
    const seen: DegradationMode[] = [];
    for (const mode of ['orange', 'red', 'black'] as DegradationMode[]) {
      const prev = this.derived;
      this.derived = mode;
      await bus.emit({
        sessionId,
        circleId,
        actor: 'system',
        type: 'fallback_state',
        payload: { from: prev, to: mode },
      });
      seen.push(mode);
    }
    return seen;
  }
}
