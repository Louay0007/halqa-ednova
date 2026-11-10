import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Controller()
export class HealthController {
  constructor(@InjectConnection() private readonly conn: Connection) {}

  @Get('healthz')
  liveness(): { ok: boolean; uptimeS: number } {
    return { ok: true, uptimeS: Math.floor(process.uptime()) };
  }

  @Get('readyz')
  readiness(): { ok: boolean; mongo: string } {
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    const ok = this.conn.readyState === 1;
    return { ok, mongo: states[this.conn.readyState] ?? String(this.conn.readyState) };
  }
}
