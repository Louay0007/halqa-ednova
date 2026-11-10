import { Injectable, Logger } from '@nestjs/common';

/**
 * In-process FIFO for L (large-model) requests (plan §6.6).
 * Serial executor: every enqueue chains onto the tail, so at most one L call
 * is in flight — no provider stampede on venue Wi-Fi. Position + ETA are
 * returned for the UI. Retry-once is the caller's job (guided retry); after
 * that the caller falls back to C, then to the offline pack.
 */
@Injectable()
export class AiQueue {
  private readonly logger = new Logger(AiQueue.name);
  private tail: Promise<unknown> = Promise.resolve();
  private depth = 0;

  /** Enqueue work. Resolves/rejects with the work's own outcome. */
  enqueue<T>(step: string, tier: 'C' | 'L', run: () => Promise<T>): { result: Promise<T>; position: number; etaMs: number } {
    const position = this.depth + 1;
    this.depth = position;
    const etaMs = this.etaForPosition(tier, position);
    this.logger.verbose(`queued ${tier} request ${step} position=${position} eta=${etaMs}ms`);

    const result = this.tail.then(() => run()).finally(() => {
      this.depth = Math.max(0, this.depth - 1);
    }) as Promise<T>;
    // Chain the tail (swallow errors here — they surface via `result`).
    this.tail = result.catch(() => undefined);
    return { result, position, etaMs };
  }

  /** Current queue depth (for /metrics, Phase 5). */
  getDepth(): number {
    return this.depth;
  }

  private etaForPosition(tier: 'C' | 'L', pos: number): number {
    const perSlot = tier === 'L' ? 3500 : 800;
    return Math.min(pos * perSlot, 30000);
  }
}
