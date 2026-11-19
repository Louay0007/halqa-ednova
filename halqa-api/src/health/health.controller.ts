import { Controller, Get, Res } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import type { Response } from 'express';
import { Public } from '../security/roles.decorator';
import { KnowledgeService } from '../modules/knowledge/knowledge.service';

/** Build identity, so a running pod can be tied to a commit during an incident. */
const BUILD = {
  version: process.env.npm_package_version ?? '0.0.0',
  commit: process.env.GIT_COMMIT ?? 'unknown',
  startedAt: new Date().toISOString(),
};

@Public()
@Controller()
export class HealthController {
  constructor(
    @InjectConnection() private readonly conn: Connection,
    private readonly knowledge: KnowledgeService,
  ) {}

  /**
   * Liveness. Deliberately unconditional: "yes, I am running" is the only thing
   * that should kill and restart a process. Anything that can be temporarily
   * down belongs in readiness, or a blip becomes pod churn.
   */
  @Get('healthz')
  liveness(): { ok: boolean; uptimeS: number } {
    return { ok: true, uptimeS: Math.floor(process.uptime()) };
  }

  /**
   * Readiness — can this instance actually serve a learner right now?
   *
   * `readyState === 1` only says the driver thinks it is connected; it does not
   * prove the server answers, so this pings. The KB count matters because an
   * empty index silently degrades every answer to the offline pack.
   *
   * The AI provider is deliberately NOT checked: a provider outage must trigger
   * degradation (GREEN→ORANGE→RED→BLACK), not remove the pod. Taking the product
   * down because a vendor is slow is the opposite of the design (§7.4).
   */
  @Get('readyz')
  async readiness(@Res({ passthrough: true }) res?: Response): Promise<{
    ok: boolean;
    mongo: string;
    mongoPingMs?: number;
    kbDocs: number;
    version: string;
    commit: string;
    startedAt: string;
  }> {
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    const mongo = states[this.conn.readyState] ?? String(this.conn.readyState);

    let pingOk = false;
    let mongoPingMs: number | undefined;
    if (this.conn.readyState === 1 && this.conn.db) {
      const t0 = Date.now();
      try {
        await this.conn.db.admin().ping();
        pingOk = true;
        mongoPingMs = Date.now() - t0;
      } catch {
        pingOk = false;
      }
    }

    const kbDocs = this.knowledge.stats().docs;
    if (res && !pingOk) res.status(503);

    return { ok: pingOk, mongo, mongoPingMs, kbDocs, ...BUILD };
  }
}
